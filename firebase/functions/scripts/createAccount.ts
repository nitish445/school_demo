/**
 * Creates (or reuses) a single Teacher or Parent account. There's no admin
 * web UI for this on the free Spark plan (no Cloud Functions to safely do
 * it from the browser), so run this from your own machine instead.
 *
 * Against the live project (from /firebase/functions):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
 *     npm run create-account -- --schoolId demo-school --kind parent \
 *     --email jane@example.com --password TempPass123 --name "Jane Doe"
 *
 * Against the local emulator instead, set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 * and FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 in place of
 * GOOGLE_APPLICATION_CREDENTIALS (see scripts/createFirstAdmin.ts).
 *
 * Optional: --phone, and --employeeId (teachers only).
 */
import { arg, optionalArg } from "./lib/args";
import { createOrReuseAccount, type AccountKind } from "./lib/accounts";
import { initAdmin } from "./lib/init";

async function main() {
  initAdmin();

  const schoolId = arg("schoolId");
  const kind = arg("kind");
  if (kind !== "teacher" && kind !== "parent") {
    throw new Error("--kind must be teacher or parent.");
  }
  const email = arg("email");
  const password = arg("password");
  const name = arg("name");
  const phone = optionalArg("phone");
  const employeeId = optionalArg("employeeId");

  const { uid, reused } = await createOrReuseAccount(schoolId, {
    email,
    password,
    displayName: name,
    phone,
    kind: kind as AccountKind,
    employeeId,
  });

  console.log(
    reused
      ? `Reused existing ${kind} account for ${email} (uid: ${uid}).`
      : `Created ${kind} account for ${email} (uid: ${uid}).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
