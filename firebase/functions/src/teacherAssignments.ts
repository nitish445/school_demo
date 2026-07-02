import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

interface TeacherAssignment {
  classId: string;
  subjectId: string;
}

interface SetTeacherAssignmentsInput {
  schoolId: string;
  teacherId: string;
  assignments: TeacherAssignment[];
  classTeacherOf: string | null;
}

/**
 * Updates which classes/subjects a teacher is assigned to, and whether
 * they're a home-room (class) teacher. Admin-only.
 *
 * Also recomputes:
 * - `assignedClassIds`, a denormalized flat list of `assignments[].classId`,
 *   since Firestore security rules can't filter a list of maps by one key
 *   (see `teachesInClass` in /firebase/firestore.rules).
 * - The `role` custom claim: it flips to `classTeacher` when `classTeacherOf`
 *   is set and `subjectTeacher` otherwise, since the rules' `isMyClass`
 *   check requires the claim and the profile doc to agree. A teacher who is
 *   also a subject teacher for other classes keeps those `assignments`
 *   either way -- `isTeacher()` covers both roles for general read access.
 */
export const setTeacherAssignments = onCall<SetTeacherAssignmentsInput>(async (request) => {
  const claims = request.auth?.token;
  const { schoolId, teacherId, assignments, classTeacherOf } = request.data;

  if (!claims || claims.role !== "admin") {
    throw new HttpsError("permission-denied", "Only a school admin can do this.");
  }
  if (claims.schoolId !== schoolId) {
    throw new HttpsError("permission-denied", "Cannot manage another school's data.");
  }

  const assignedClassIds = Array.from(new Set(assignments.map((a) => a.classId)));
  const role = classTeacherOf ? "classTeacher" : "subjectTeacher";

  await getFirestore()
    .doc(`schools/${schoolId}/teachers/${teacherId}`)
    .update({
      assignments,
      assignedClassIds,
      classTeacherOf: classTeacherOf ?? null,
    });

  await getAuth().setCustomUserClaims(teacherId, { schoolId, role });
  await getFirestore().doc(`users/${teacherId}`).update({ role });

  return { ok: true };
});
