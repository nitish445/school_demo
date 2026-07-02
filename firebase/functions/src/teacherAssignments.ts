import { HttpsError, onCall } from "firebase-functions/v2/https";
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
 * Updates which classes/subjects a teacher is assigned to. Recomputes the
 * denormalized `assignedClassIds` list that Firestore security rules rely on
 * (see /firebase/firestore.rules `teachesInClass`). Admin-only.
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

  await getFirestore()
    .doc(`schools/${schoolId}/teachers/${teacherId}`)
    .update({
      assignments,
      assignedClassIds,
      classTeacherOf: classTeacherOf ?? null,
    });

  return { ok: true };
});
