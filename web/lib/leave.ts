import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Leave } from "@/types/models";

function toUtcDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Built entirely from Date.UTC/setUTCDate/toISOString (never the local-time
// constructor) -- parsing "2026-07-06T00:00:00" as local time and then
// reading it back with toISOString() shifts the date by a day in any
// timezone ahead of UTC, which is exactly the bug this avoids.
function enumerateDates(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const end = toUtcDate(toDate);
  const cursor = toUtcDate(fromDate);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Approves a leave request and auto-marks attendance as `medicalLeave` for
 * every day in the leave's date range. Mirrors how unmarked attendance
 * already defaults to `present` on the attendance-marking screen -- this is
 * just a sensible starting point, not a lock; the class teacher (or admin)
 * can still overwrite any of these days from Mark Attendance afterward.
 */
export async function approveLeave(schoolId: string, leave: Leave, approverUid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, `schools/${schoolId}/leaves/${leave.id}`), {
    status: "approved",
    approvedBy: approverUid,
  });

  for (const date of enumerateDates(leave.fromDate, leave.toDate)) {
    const recordId = `${leave.studentId}_${date}`;
    batch.set(
      doc(db, `schools/${schoolId}/attendance/${recordId}`),
      {
        studentId: leave.studentId,
        classId: leave.classId,
        date,
        status: "medicalLeave",
        markedBy: approverUid,
        markedAt: Date.now(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

export async function rejectLeave(schoolId: string, leaveId: string, approverUid: string): Promise<void> {
  await updateDoc(doc(db, `schools/${schoolId}/leaves/${leaveId}`), {
    status: "rejected",
    approvedBy: approverUid,
  });
}
