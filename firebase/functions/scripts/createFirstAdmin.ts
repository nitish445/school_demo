/**
 * One-time bootstrap script -- NOT deployed as a Cloud Function.
 *
 * There's a chicken-and-egg problem: `createStaffOrParentAccount` requires an
 * existing admin to call it, but on day one there is no admin yet. This
 * script uses a service account key you download yourself (Firebase Console
 * -> Project settings -> Service accounts -> Generate new private key) to
 * create the very first school + admin account directly with the Admin SDK,
 * run from your own machine. It is intentionally not exposed as a public
 * Cloud Function so nobody else can call it to mint themselves an admin
 * account.
 *
 * Usage (from /firebase/functions):
 *   npm install
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
 *     npx ts-node scripts/createFirstAdmin.ts \
 *     --schoolId my-school --schoolName "My School" \
 *     --email admin@example.com --password "ChangeMe123!" --name "Jane Doe"
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function arg(name: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) {
    throw new Error(`Missing required --${name} argument.`);
  }
  return process.argv[idx + 1];
}

async function main() {
  const schoolId = arg("schoolId");
  const schoolName = arg("schoolName");
  const email = arg("email");
  const password = arg("password");
  const name = arg("name");

  initializeApp({ credential: applicationDefault() });
  const auth = getAuth();
  const db = getFirestore();

  const existing = await db.doc(`schools/${schoolId}`).get();
  if (existing.exists) {
    throw new Error(
      `schools/${schoolId} already exists. Refusing to overwrite -- use the ` +
        `createStaffOrParentAccount Cloud Function to add more accounts instead.`
    );
  }

  const userRecord = await auth.createUser({ email, password, displayName: name });
  await auth.setCustomUserClaims(userRecord.uid, { schoolId, role: "admin" });

  const batch = db.batch();
  batch.set(db.doc(`schools/${schoolId}`), {
    name: schoolName,
    academicYear: new Date().getFullYear().toString(),
    workingDays: [1, 2, 3, 4, 5],
    holidays: [],
  });
  batch.set(db.doc(`users/${userRecord.uid}`), {
    schoolId,
    role: "admin",
    displayName: name,
    email,
    status: "active",
  });
  await batch.commit();

  console.log(`Created school "${schoolName}" (${schoolId}) and admin ${email} (uid: ${userRecord.uid}).`);
  console.log("You can now log in to the web app with this email/password.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
