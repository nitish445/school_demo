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
 * Creates a Teacher or Parent account: a Firebase Auth user, a `users/{uid}`
 * pointer doc, a role profile doc (`teachers/{uid}` or `parents/{uid}`), and
 * custom claims. Only callable by an existing admin of the same school --
 * there is no public self-signup in this app.
 *
 * New teachers start with the `subjectTeacher` role and no assignments; use
 * `setTeacherAssignments` afterwards to assign classes/subjects or promote
 * them to a class (home-room) teacher.
 */
export const createStaffOrParentAccount = onCall<CreateAccountInput>(async (request) => {
  const { schoolId, email, password, displayName, phone, kind, employeeId } = request.data;
  assertCallerIsAdminOf(request, schoolId);

  if (!["teacher", "parent"].includes(kind)) {
    throw new HttpsError("invalid-argument", "kind must be teacher or parent.");
  }
  if (!email || !password || !displayName) {
    throw new HttpsError("invalid-argument", "email, password, and displayName are required.");
  }

  const auth = getAuth();
  const db = getFirestore();
  const role = kind === "parent" ? "parent" : "subjectTeacher";

  const userRecord = await auth.createUser({ email, password, displayName });
  await auth.setCustomUserClaims(userRecord.uid, { schoolId, role });

  const batch = db.batch();
  batch.set(db.doc(`users/${userRecord.uid}`), {
    schoolId,
    role,
    displayName,
    email,
    phone: phone ?? null,
    status: "active",
  });

  if (kind === "parent") {
    batch.set(db.doc(`schools/${schoolId}/parents/${userRecord.uid}`), {
      name: displayName,
      childStudentIds: [],
      status: "active",
    });
  } else {
    batch.set(db.doc(`schools/${schoolId}/teachers/${userRecord.uid}`), {
      name: displayName,
      employeeId: employeeId ?? "",
      assignments: [],
      assignedClassIds: [],
      classTeacherOf: null,
      status: "active",
    });
  }

  await batch.commit();
  return { uid: userRecord.uid };
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
