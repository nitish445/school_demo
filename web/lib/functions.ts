import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { firebaseApp } from "@/lib/firebase";

export const functions = getFunctions(firebaseApp);

if (
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" &&
  typeof window !== "undefined" &&
  !(globalThis as { __FUNCTIONS_EMULATOR_CONNECTED__?: boolean }).__FUNCTIONS_EMULATOR_CONNECTED__
) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  (globalThis as { __FUNCTIONS_EMULATOR_CONNECTED__?: boolean }).__FUNCTIONS_EMULATOR_CONNECTED__ = true;
}

export interface CreateStaffOrParentAccountInput {
  schoolId: string;
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  kind: "teacher" | "parent";
  employeeId?: string;
}

export const createStaffOrParentAccount = httpsCallable<
  CreateStaffOrParentAccountInput,
  { uid: string }
>(functions, "createStaffOrParentAccount");

export interface SetAccountStatusInput {
  schoolId: string;
  uid: string;
  status: "active" | "disabled";
}

export const setAccountStatus = httpsCallable<SetAccountStatusInput, { ok: true }>(
  functions,
  "setAccountStatus"
);

export interface SetTeacherAssignmentsInput {
  schoolId: string;
  teacherId: string;
  assignments: { classId: string; subjectId: string }[];
  classTeacherOf: string | null;
}

export const setTeacherAssignments = httpsCallable<SetTeacherAssignmentsInput, { ok: true }>(
  functions,
  "setTeacherAssignments"
);
