/**
 * Bulk-creates Students from a CSV file, auto-creating (or reusing) a
 * Parent account per row and linking it in the same step.
 *
 * Columns: name, admissionNo, rollNo, grade, section, dob, gender,
 *          emergencyContact, medicalNotes, parentName, parentEmail,
 *          parentPassword, parentPhone
 * See /templates/students_template.csv. grade/section must match a class
 * already created on the admin Classes page. Leave the parent* columns
 * blank to import a student with no parent linked.
 *
 * Against the live project (from /firebase/functions):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
 *     npm run import-students -- --schoolId demo-school --file /path/to/students.csv
 *
 * Against the local emulator instead, set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 * and FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 in place of
 * GOOGLE_APPLICATION_CREDENTIALS.
 */
import { readFileSync } from "fs";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { arg } from "./lib/args";
import { createOrReuseAccount } from "./lib/accounts";
import { parseCsv } from "./lib/csv";
import { initAdmin } from "./lib/init";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function main() {
  initAdmin();

  const schoolId = arg("schoolId");
  const file = arg("file");
  const db = getFirestore();

  const { rows } = parseCsv(readFileSync(file, "utf8"));
  if (rows.length === 0) {
    throw new Error("No data rows found in that file.");
  }

  const classesSnap = await db.collection(`schools/${schoolId}/classes`).get();
  const classByKey = new Map<string, string>();
  classesSnap.forEach((doc) => {
    const data = doc.data();
    classByKey.set(`${data.grade}|${data.section}`.trim().toLowerCase(), doc.id);
  });

  const studentsSnap = await db.collection(`schools/${schoolId}/students`).get();
  const existingAdmissionNos = new Set(
    studentsSnap.docs.map((d) => String(d.data().admissionNo ?? "").trim().toLowerCase())
  );
  const seenAdmissionNos = new Set<string>();
  const parentEmailToUid = new Map<string, string>();

  let created = 0;
  let failed = 0;

  for (const [i, row] of rows.entries()) {
    const rowNum = i + 2;
    const name = row.name ?? "";
    const admissionNo = row.admissionNo ?? "";
    const admissionKey = admissionNo.trim().toLowerCase();
    const grade = row.grade ?? "";
    const section = row.section ?? "";
    const classId = classByKey.get(`${grade}|${section}`.trim().toLowerCase());
    const dob = row.dob ?? "";
    const gender = (row.gender ?? "").trim().toLowerCase();
    const parentName = row.parentName ?? "";
    const parentEmail = (row.parentEmail ?? "").trim().toLowerCase();
    const parentPassword = row.parentPassword ?? "";
    const parentPhone = row.parentPhone ?? "";

    let error: string | undefined;
    if (!name) error = "missing name";
    else if (!admissionNo) error = "missing admission number";
    else if (existingAdmissionNos.has(admissionKey)) error = "admission number already exists";
    else if (seenAdmissionNos.has(admissionKey)) error = "duplicate admission number in file";
    else if (!classId) error = `no class matches grade "${grade}" section "${section}"`;
    else if (dob && !DATE_RE.test(dob)) error = "invalid date of birth (use YYYY-MM-DD)";
    else if (gender && !["male", "female", "other"].includes(gender)) error = "gender must be male/female/other";
    else if (parentEmail && !EMAIL_RE.test(parentEmail)) error = "invalid parent email";
    else if (parentEmail && !parentName) error = "parent name required when parent email is set";
    else if (parentEmail && (!parentPassword || parentPassword.length < 6))
      error = "parent password must be at least 6 characters";

    if (error) {
      console.error(`Row ${rowNum}: skipped (${error}).`);
      failed++;
      continue;
    }
    seenAdmissionNos.add(admissionKey);

    let parentUid: string | undefined;
    if (parentEmail) {
      if (!parentEmailToUid.has(parentEmail)) {
        try {
          const { uid, reused } = await createOrReuseAccount(schoolId, {
            email: parentEmail,
            password: parentPassword,
            displayName: parentName,
            phone: parentPhone || undefined,
            kind: "parent",
          });
          parentEmailToUid.set(parentEmail, uid);
          console.log(`Row ${rowNum}: ${reused ? "reused" : "created"} parent ${parentEmail}`);
        } catch (err) {
          console.error(
            `Row ${rowNum}: parent account failed (${err instanceof Error ? err.message : "error"}); ` +
              `student will be created without a parent link.`
          );
        }
      }
      parentUid = parentEmailToUid.get(parentEmail);
    }

    const studentRef = db.collection(`schools/${schoolId}/students`).doc();
    await studentRef.set({
      name,
      admissionNo,
      rollNo: row.rollNo ?? "",
      classId,
      sectionId: section,
      dob: dob || null,
      gender: gender || null,
      parentIds: parentUid ? [parentUid] : [],
      emergencyContact: row.emergencyContact || null,
      medicalNotes: row.medicalNotes || null,
      status: "active",
    });

    if (parentUid) {
      await db
        .doc(`schools/${schoolId}/parents/${parentUid}`)
        .set({ childStudentIds: FieldValue.arrayUnion(studentRef.id) }, { merge: true });
    }

    created++;
    console.log(`Row ${rowNum}: created student ${name} (${admissionNo}).`);
  }

  console.log(`\nDone. ${created} students created, ${failed} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
