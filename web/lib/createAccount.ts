"use client";

import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, writeBatch } from "firebase/firestore";
import { firebaseApp, db } from "@/lib/firebase";

export type AccountKind = "teacher" | "parent" | "admin";

export interface CreateAccountInput {
  schoolId: string;
  email: string;
  displayName: string;
  phone?: string;
  kind: AccountKind;
  employeeId?: string;
}

/**
 * Creates the Firebase Auth login via a throwaway secondary app instance,
 * so it doesn't sign the admin out of their own session on the primary app
 * (the client SDK auto-signs-in whoever `createUserWithEmailAndPassword`
 * just created). There's no Admin SDK involved -- and therefore no custom
 * claims get set -- but that's fine, since security rules read the
 * `users/{uid}` Firestore doc instead (see writeAccountProfile below and
 * firebase/firestore.rules).
 */
export async function createAuthUser(email: string, password: string): Promise<string> {
  const secondaryApp = initializeApp(firebaseApp.options, `account-creation-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
      connectAuthEmulator(secondaryAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = credential.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

/**
 * Writes the `users/{uid}` pointer doc and the role profile doc
 * (`teachers/{uid}` or `parents/{uid}`) for an already-created Auth user.
 * Split out from `createAuthUser` so a failure here (e.g. a dropped
 * connection) can be retried against the same uid without minting a second,
 * orphaned Auth account for the same email.
 */
export async function writeAccountProfile(uid: string, input: CreateAccountInput): Promise<void> {
  const { schoolId, displayName, phone, kind, employeeId, email } = input;
  const role = kind === "parent" ? "parent" : kind === "admin" ? "admin" : "subjectTeacher";

  const batch = writeBatch(db);
  batch.set(doc(db, `users/${uid}`), {
    schoolId,
    role,
    displayName,
    email,
    phone: phone ?? null,
    status: "active",
    // Admins default to the plain "teacher" title; the Principal can later
    // re-designate them as Incharge / Lab Assistant from the Admins page.
    ...(kind === "admin" ? { designation: "teacher" } : {}),
  });

  if (kind === "parent") {
    batch.set(doc(db, `schools/${schoolId}/parents/${uid}`), {
      name: displayName,
      email,
      phone: phone ?? null,
      childStudentIds: [],
      status: "active",
    });
  } else if (kind === "admin") {
    batch.set(doc(db, `schools/${schoolId}/admins/${uid}`), {
      name: displayName,
      email,
      status: "active",
      designation: "teacher",
    });
    // Admins (and the Principal) are teachers too -- this lets them be
    // assigned classes/subjects and show up in the Teacher Directory,
    // reusing the exact same teachers/{uid} shape as a regular teacher.
    batch.set(doc(db, `schools/${schoolId}/teachers/${uid}`), {
      name: displayName,
      email,
      employeeId: employeeId ?? "",
      assignments: [],
      assignedClassIds: [],
      classTeacherOf: null,
      status: "active",
    });
  } else {
    batch.set(doc(db, `schools/${schoolId}/teachers/${uid}`), {
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

export function describeAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered. Use a different email, or use the terminal script if you're trying to reuse an existing account.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    default:
      return "Could not create the account. Please try again.";
  }
}
