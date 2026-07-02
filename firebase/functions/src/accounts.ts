import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type AccountKind = "teacher" | "parent";

interface CreateAccountInput {
  schoolId: string;
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  kind: AccountKind;
  employeeId?: string; // teachers only
}

function assertCallerIsAdminOf(request: { auth?: { token: Record<string, unknown> } }, schoolId: string) {
  const claims = request.auth?.token;
  if (!claims || claims.role !== "admin") {
    throw new HttpsError("permission-denied", "Only a school admin can do this.");
  }
  if (claims.schoolId !== schoolId) {
    throw new HttpsError("permission-denied", "Cannot manage another school's data.");
  }
}

/**
 * Creates a Firebase Auth user, `users/{uid}` pointer doc, role profile doc
 * (`teachers/{uid}` or `parents/{uid}`), and custom claims for one account.
 *
 * If the email already belongs to an existing Auth user who is already a
 * `kind` account in this school, that account is reused instead of erroring
 * -- lets bulk CSV imports be re-run safely without creating duplicates.
 * Any other email collision (different school, different role, or an
 * unrelated account) is a hard error.
 */
async function createOrReuseAccount(
  schoolId: string,
  input: { email: string; password: string; displayName: string; phone?: string; kind: AccountKind; employeeId?: string }
): Promise<{ uid: string; reused: boolean }> {
  const { email, password, displayName, phone, kind, employeeId } = input;

  if (!["teacher", "parent"].includes(kind)) {
    throw new Error("kind must be teacher or parent.");
  }
  if (!email || !password || !displayName) {
    throw new Error("email, password, and displayName are required.");
  }

  const auth = getAuth();
  const db = getFirestore();
  const role = kind === "parent" ? "parent" : "subjectTeacher";

  let uid: string;
  let reused = false;
  try {
    const userRecord = await auth.createUser({ email, password, displayName });
    uid = userRecord.uid;
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/email-already-exists") {
      throw err;
    }
    const existing = await auth.getUserByEmail(email);
    const existingDoc = await db.doc(`users/${existing.uid}`).get();
    const existingData = existingDoc.data();
    if (!existingDoc.exists || existingData?.schoolId !== schoolId || existingData?.role !== role) {
      throw new Error(`${email} is already in use by a different account.`);
    }
    uid = existing.uid;
    reused = true;
  }

  if (!reused) {
    await auth.setCustomUserClaims(uid, { schoolId, role });

    const batch = db.batch();
    batch.set(db.doc(`users/${uid}`), {
      schoolId,
      role,
      displayName,
      email,
      phone: phone ?? null,
      status: "active",
    });

    if (kind === "parent") {
      batch.set(db.doc(`schools/${schoolId}/parents/${uid}`), {
        name: displayName,
        childStudentIds: [],
        status: "active",
      });
    } else {
      batch.set(db.doc(`schools/${schoolId}/teachers/${uid}`), {
        name: displayName,
        employeeId: employeeId ?? "",
        assignments: [],
        assignedClassIds: [],
        classTeacherOf: null,
        status: "active",
      });
    }

    await batch.commit();
  }

  return { uid, reused };
}

/**
 * Creates a Teacher or Parent account. Only callable by an existing admin of
 * the same school -- there is no public self-signup in this app.
 *
 * New teachers start with the `subjectTeacher` role and no assignments; use
 * `setTeacherAssignments` afterwards to assign classes/subjects or promote
 * them to a class (home-room) teacher.
 */
export const createStaffOrParentAccount = onCall<CreateAccountInput>(async (request) => {
  const { schoolId, email, password, displayName, phone, kind, employeeId } = request.data;
  assertCallerIsAdminOf(request, schoolId);

  try {
    const { uid } = await createOrReuseAccount(schoolId, { email, password, displayName, phone, kind, employeeId });
    return { uid };
  } catch (err) {
    throw new HttpsError("invalid-argument", err instanceof Error ? err.message : "Could not create account.");
  }
});

interface BulkAccountInput {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  kind: AccountKind;
  employeeId?: string;
}

interface BulkCreateAccountsInput {
  schoolId: string;
  accounts: BulkAccountInput[];
}

interface BulkAccountResult {
  index: number;
  email: string;
  ok: boolean;
  uid?: string;
  reused?: boolean;
  error?: string;
}

/**
 * CSV-import entry point: creates/reuses up to 500 Teacher or Parent
 * accounts in one call. Each row is independent -- a failure on one row
 * doesn't abort the rest -- so the caller can show a per-row result table.
 */
export const bulkCreateAccounts = onCall<BulkCreateAccountsInput>(async (request) => {
  const { schoolId, accounts } = request.data;
  assertCallerIsAdminOf(request, schoolId);

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new HttpsError("invalid-argument", "accounts must be a non-empty array.");
  }
  if (accounts.length > 500) {
    throw new HttpsError("invalid-argument", "Import at most 500 accounts at a time.");
  }

  const results: BulkAccountResult[] = [];
  for (let index = 0; index < accounts.length; index++) {
    const account = accounts[index];
    try {
      const { uid, reused } = await createOrReuseAccount(schoolId, account);
      results.push({ index, email: account.email, ok: true, uid, reused });
    } catch (err) {
      results.push({
        index,
        email: account.email,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }

  return { results };
});

interface SetAccountStatusInput {
  schoolId: string;
  uid: string;
  status: "active" | "disabled";
}

/** Enables/disables sign-in for a teacher or parent account. Admin-only. */
export const setAccountStatus = onCall<SetAccountStatusInput>(async (request) => {
  const { schoolId, uid, status } = request.data;
  assertCallerIsAdminOf(request, schoolId);

  const db = getFirestore();
  const userDoc = await db.doc(`users/${uid}`).get();
  const role = userDoc.data()?.role;
  if (userDoc.data()?.schoolId !== schoolId) {
    throw new HttpsError("not-found", "No such account in this school.");
  }

  await getAuth().updateUser(uid, { disabled: status === "disabled" });

  const batch = db.batch();
  batch.update(db.doc(`users/${uid}`), { status });
  const profileCollection = role === "parent" ? "parents" : "teachers";
  batch.update(db.doc(`schools/${schoolId}/${profileCollection}/${uid}`), { status });
  await batch.commit();

  return { ok: true };
});
