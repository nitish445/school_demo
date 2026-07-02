import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type StaffOrParentRole = "classTeacher" | "subjectTeacher" | "parent";

interface CreateAccountInput {
  schoolId: string;
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  role: StaffOrParentRole;
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
 */
export const createStaffOrParentAccount = onCall<CreateAccountInput>(async (request) => {
  const { schoolId, email, password, displayName, phone, role, employeeId } = request.data;
  assertCallerIsAdminOf(request, schoolId);

  if (!["classTeacher", "subjectTeacher", "parent"].includes(role)) {
    throw new HttpsError("invalid-argument", "role must be classTeacher, subjectTeacher, or parent.");
  }
  if (!email || !password || !displayName) {
    throw new HttpsError("invalid-argument", "email, password, and displayName are required.");
  }

  const auth = getAuth();
  const db = getFirestore();

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

  if (role === "parent") {
    batch.set(db.doc(`schools/${schoolId}/parents/${userRecord.uid}`), {
      name: displayName,
      childStudentIds: [],
    });
  } else {
    batch.set(db.doc(`schools/${schoolId}/teachers/${userRecord.uid}`), {
      name: displayName,
      employeeId: employeeId ?? "",
      assignments: [],
      assignedClassIds: [],
      classTeacherOf: null,
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

  await getAuth().updateUser(uid, { disabled: status === "disabled" });
  await getFirestore().doc(`users/${uid}`).update({ status });
  return { ok: true };
});
