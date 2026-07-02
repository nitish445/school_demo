import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export type AccountKind = "teacher" | "parent";

export interface AccountInput {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  kind: AccountKind;
  employeeId?: string;
}

/**
 * Creates a Firebase Auth user, `users/{uid}` pointer doc, role profile doc
 * (`teachers/{uid}` or `parents/{uid}`), and custom claims for one account.
 *
 * If the email already belongs to an existing Auth user who is already a
 * `kind` account in this school, that account is reused instead of erroring
 * -- lets these scripts be re-run safely without creating duplicates. Any
 * other email collision (different school, different role, or an unrelated
 * account) is a hard error.
 */
export async function createOrReuseAccount(
  schoolId: string,
  input: AccountInput
): Promise<{ uid: string; reused: boolean }> {
  const { email, password, displayName, phone, kind, employeeId } = input;

  if (kind !== "teacher" && kind !== "parent") {
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
        email,
        childStudentIds: [],
        status: "active",
      });
    } else {
      batch.set(db.doc(`schools/${schoolId}/teachers/${uid}`), {
        name: displayName,
        email,
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
