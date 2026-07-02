import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/**
 * Keeps `parents/{uid}.childStudentIds` in sync with `students/{id}.parentIds`
 * whenever the admin adds/edits/transfers a student. Firestore security
 * rules read `childStudentIds` to decide what a parent can see (see
 * `isMyChild` in /firebase/firestore.rules), so this cache must stay
 * accurate; `parentIds` on the student doc remains the source of truth.
 */
export const onStudentWrite = onDocumentWritten(
  "schools/{schoolId}/students/{studentId}",
  async (event) => {
    const { schoolId, studentId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    const beforeParents: string[] = before?.parentIds ?? [];
    const afterParents: string[] = after?.parentIds ?? [];

    const added = afterParents.filter((id) => !beforeParents.includes(id));
    const removed = beforeParents.filter((id) => !afterParents.includes(id));

    if (added.length === 0 && removed.length === 0) return;

    const db = getFirestore();
    const batch = db.batch();

    for (const parentId of added) {
      batch.set(
        db.doc(`schools/${schoolId}/parents/${parentId}`),
        { childStudentIds: FieldValue.arrayUnion(studentId) },
        { merge: true }
      );
    }
    for (const parentId of removed) {
      batch.set(
        db.doc(`schools/${schoolId}/parents/${parentId}`),
        { childStudentIds: FieldValue.arrayRemove(studentId) },
        { merge: true }
      );
    }

    await batch.commit();
  }
);
