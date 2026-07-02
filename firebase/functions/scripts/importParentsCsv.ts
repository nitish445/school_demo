/**
 * Bulk-creates Parent accounts from a CSV file. Columns: name, email,
 * password, phone (phone optional). See /templates/parents_template.csv.
 *
 * Against the live project (from /firebase/functions):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
 *     npm run import-parents -- --schoolId demo-school --file /path/to/parents.csv
 *
 * Against the local emulator instead, set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 * and FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 in place of
 * GOOGLE_APPLICATION_CREDENTIALS.
 */
import { readFileSync } from "fs";
import { arg } from "./lib/args";
import { createOrReuseAccount } from "./lib/accounts";
import { parseCsv } from "./lib/csv";
import { initAdmin } from "./lib/init";

async function main() {
  initAdmin();

  const schoolId = arg("schoolId");
  const file = arg("file");

  const { rows } = parseCsv(readFileSync(file, "utf8"));
  if (rows.length === 0) {
    throw new Error("No data rows found in that file.");
  }

  let created = 0;
  let reused = 0;
  let failed = 0;
  const seenEmails = new Set<string>();

  for (const [i, row] of rows.entries()) {
    const rowNum = i + 2;
    const name = row.name ?? "";
    const email = (row.email ?? "").trim().toLowerCase();
    const password = row.password ?? "";
    const phone = row.phone ?? "";

    if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) {
      console.error(`Row ${rowNum}: skipped (missing/invalid name or email).`);
      failed++;
      continue;
    }
    if (!password || password.length < 6) {
      console.error(`Row ${rowNum}: skipped (password must be at least 6 characters).`);
      failed++;
      continue;
    }
    if (seenEmails.has(email)) {
      console.error(`Row ${rowNum}: skipped (duplicate email in file).`);
      failed++;
      continue;
    }
    seenEmails.add(email);

    try {
      const { reused: wasReused } = await createOrReuseAccount(schoolId, {
        email,
        password,
        displayName: name,
        phone: phone || undefined,
        kind: "parent",
      });
      wasReused ? reused++ : created++;
      console.log(`Row ${rowNum}: ${wasReused ? "reused" : "created"} ${email}`);
    } catch (err) {
      failed++;
      console.error(`Row ${rowNum}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  console.log(`\nDone. ${created} created, ${reused} reused, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
