import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { collection, doc, getDoc, getDocs, query, where, type QueryConstraint } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Exam, ExamComponentSet, Marks, School, SchoolClass, Student, Subject, Teacher } from "@/types/models";
import {
  computeAllSubjectResults,
  computeOverallSummary,
  computeSubjectResult,
  gradeForPercentage,
  GRADING_SCALE,
} from "@/lib/grading";

const PAGE_MARGIN = 14;
const CONTENT_WIDTH = 182; // A4 width (210mm) minus left+right margins
const FRAME_MARGIN = 8;

// Indigo, matching the web app's own theme -- so a printed marksheet still
// reads as "this school's system", not a generic gray table.
const ACCENT: [number, number, number] = [67, 56, 202]; // indigo-700
const ACCENT_DARK: [number, number, number] = [30, 27, 75]; // indigo-950
const ACCENT_LIGHT: [number, number, number] = [238, 242, 255]; // indigo-50
const ACCENT_BORDER: [number, number, number] = [199, 210, 254]; // indigo-200
const MUTED: [number, number, number] = [100, 100, 110];

async function fetchCollection<T>(path: string, constraints: QueryConstraint[] = []) {
  const snap = await getDocs(query(collection(db, path), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
}

function getFinalY(pdf: jsPDF): number {
  return (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function drawPageFrame(pdf: jsPDF) {
  pdf.setDrawColor(...ACCENT_BORDER);
  pdf.setLineWidth(0.5);
  pdf.rect(FRAME_MARGIN, FRAME_MARGIN, 210 - FRAME_MARGIN * 2, 297 - FRAME_MARGIN * 2);
}

/** School name/address/title letterhead at the top of each student's report. */
function drawLetterhead(pdf: jsPDF, school: (School & { id: string }) | undefined): number {
  let y = 20;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(...ACCENT_DARK);
  pdf.text(school?.name ?? "School", 105, y, { align: "center" });
  y += 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  const subline = [school?.address, school?.academicYear ? `Academic Year ${school.academicYear}` : undefined]
    .filter(Boolean)
    .join("  ·  ");
  if (subline) {
    pdf.text(subline, 105, y, { align: "center" });
    y += 6;
  }

  y += 2;
  pdf.setDrawColor(...ACCENT);
  pdf.setLineWidth(0.7);
  pdf.line(PAGE_MARGIN, y, 210 - PAGE_MARGIN, y);
  y += 7;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12.5);
  pdf.setTextColor(...ACCENT);
  pdf.text("ACADEMIC REPORT CARD", 105, y, { align: "center", charSpace: 0.5 });
  y += 3;
  pdf.setDrawColor(...ACCENT);
  pdf.setLineWidth(0.3);
  pdf.line(PAGE_MARGIN, y, 210 - PAGE_MARGIN, y);
  y += 9;

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);
  return y;
}

/** Bordered student-details grid, mirroring a printed marksheet's info box. */
function drawStudentInfo(
  pdf: jsPDF,
  y: number,
  student: Student & { id: string },
  classLabel: (SchoolClass & { id: string }) | undefined
): number {
  autoTable(pdf, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    body: [
      ["Student Name", student.name, "Class", classLabel ? `${classLabel.grade}-${classLabel.section}` : "-"],
      ["Roll No.", student.rollNo, "Admission No.", student.admissionNo],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.6, textColor: [0, 0, 0] },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: ACCENT_LIGHT, cellWidth: 34 },
      1: { cellWidth: 57 },
      2: { fontStyle: "bold", fillColor: ACCENT_LIGHT, cellWidth: 34 },
      3: { cellWidth: 57 },
    },
  });
  return getFinalY(pdf) + 7;
}

/** Overall Average / Overall Grade as boxed stat tiles instead of plain text. */
function drawSummaryTiles(pdf: jsPDF, y: number, averagePercentage: number, overallGrade: string): number {
  const gap = 6;
  const tileWidth = (CONTENT_WIDTH - gap) / 2;
  const tileHeight = 17;

  pdf.setFillColor(...ACCENT_LIGHT);
  pdf.roundedRect(PAGE_MARGIN, y, tileWidth, tileHeight, 2, 2, "F");
  pdf.roundedRect(PAGE_MARGIN + tileWidth + gap, y, tileWidth, tileHeight, 2, 2, "F");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MUTED);
  pdf.text("OVERALL AVERAGE", PAGE_MARGIN + 4, y + 6);
  pdf.text("OVERALL GRADE", PAGE_MARGIN + tileWidth + gap + 4, y + 6);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(...ACCENT_DARK);
  pdf.text(`${averagePercentage.toFixed(1)}%`, PAGE_MARGIN + 4, y + 13.5);
  pdf.text(overallGrade, PAGE_MARGIN + tileWidth + gap + 4, y + 13.5);

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);
  return y + tileHeight + 6;
}

function drawGradingScale(pdf: jsPDF, y: number): number {
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  const lines = pdf.splitTextToSize(
    `Grading scale:  ${GRADING_SCALE.map((g) => `${g.grade} ${g.range}`).join("   ·   ")}`,
    CONTENT_WIDTH
  );
  pdf.text(lines, PAGE_MARGIN, y);
  pdf.setTextColor(0, 0, 0);
  return y + 3.6 * lines.length + 6;
}

/** Signature lines + generation timestamp, anchored near the bottom of the page. */
function drawSignatureFooter(pdf: jsPDF, y: number): void {
  const footerY = y > 246 ? 262 : Math.max(y + 14, 262);
  if (y > 246) {
    pdf.addPage();
    drawPageFrame(pdf);
  }

  pdf.setDrawColor(160, 160, 160);
  pdf.setLineWidth(0.2);
  pdf.line(PAGE_MARGIN + 4, footerY, PAGE_MARGIN + 4 + 62, footerY);
  pdf.line(210 - PAGE_MARGIN - 4 - 62, footerY, 210 - PAGE_MARGIN - 4, footerY);

  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  pdf.text("Class Teacher's Signature", PAGE_MARGIN + 4, footerY + 4.5);
  pdf.text("Principal's Signature", 210 - PAGE_MARGIN - 4 - 62, footerY + 4.5);

  pdf.setFontSize(7);
  const generatedOn = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  pdf.text(`Generated on ${generatedOn}`, 105, footerY + 13, { align: "center" });
  pdf.setTextColor(0, 0, 0);
}

/**
 * Builds one PDF, drawn directly with jsPDF/autoTable (no DOM screenshotting)
 * -- an earlier html2canvas/html-to-image approach was unreliable here: this
 * app's Tailwind v4 styling uses oklch() colors that html2canvas can't parse,
 * and the html-to-image SVG-foreignObject fallback silently produced blank
 * pages. Drawing directly from data sidesteps both, and mirrors the exact
 * grouping/approval logic in components/ReportCard.tsx so the PDF always
 * matches what a parent sees on screen.
 */
export async function buildMarksheetsPdf(schoolId: string, students: Student[]): Promise<jsPDF> {
  const schoolSnap = await getDoc(doc(db, "schools", schoolId));
  const school = schoolSnap.exists() ? ({ ...(schoolSnap.data() as School), id: schoolSnap.id }) : undefined;
  const exams = await fetchCollection<Exam>(`schools/${schoolId}/exams`, [where("published", "==", true)]);
  const subjects = await fetchCollection<Subject>(`schools/${schoolId}/subjects`);
  const classes = await fetchCollection<SchoolClass>(`schools/${schoolId}/classes`);
  const teachers = await fetchCollection<Teacher>(`schools/${schoolId}/teachers`);
  const componentSets = await fetchCollection<ExamComponentSet>(`schools/${schoolId}/examComponents`);

  const pdf = new jsPDF("p", "mm", "a4");
  let firstPage = true;

  for (const student of students) {
    const marks = await fetchCollection<Marks>(`schools/${schoolId}/marks`, [where("studentId", "==", student.id)]);
    const classLabel = classes.find((c) => c.id === student.classId);

    const allResults = computeAllSubjectResults(exams, marks, componentSets, student.classId, classLabel?.grade);
    const summary = computeOverallSummary(allResults);

    if (firstPage) {
      firstPage = false;
    } else {
      pdf.addPage();
    }
    drawPageFrame(pdf);

    let y = drawLetterhead(pdf, school);
    y = drawStudentInfo(pdf, y, student, classLabel);
    y = drawSummaryTiles(pdf, y, summary.averagePercentage, summary.overallGrade);
    y = drawGradingScale(pdf, y);

    // Group by subject (approved only) -- marks aren't final until an admin
    // or class teacher approves them. Anything submitted but not yet
    // approved goes in a separate pending bucket instead of being silently
    // omitted, same as the parent-facing Report Card.
    const subjectIds: string[] = [];
    const examsBySubject = new Map<string, Exam[]>();
    const pendingSubjectIds: string[] = [];
    const pendingExamsBySubject = new Map<string, Exam[]>();

    for (const exam of exams) {
      const record = marks.find((m) => m.examId === exam.id);
      for (const entry of exam.schedule) {
        if (entry.grade !== classLabel?.grade) continue;
        const cs = componentSets.find(
          (c) => c.examId === exam.id && c.classId === student.classId && c.subjectId === entry.subjectId
        );
        const hasMarks = !!cs && cs.components.some((c) => record?.componentMarks?.[entry.subjectId]?.[c.id] !== undefined);
        if (!hasMarks) continue;
        if (!cs!.approved) {
          if (!pendingExamsBySubject.has(entry.subjectId)) {
            pendingSubjectIds.push(entry.subjectId);
            pendingExamsBySubject.set(entry.subjectId, []);
          }
          pendingExamsBySubject.get(entry.subjectId)!.push(exam);
          continue;
        }
        if (!examsBySubject.has(entry.subjectId)) {
          subjectIds.push(entry.subjectId);
          examsBySubject.set(entry.subjectId, []);
        }
        examsBySubject.get(entry.subjectId)!.push(exam);
      }
    }

    for (const subjectId of pendingSubjectIds) {
      if (y > 265) {
        pdf.addPage();
        drawPageFrame(pdf);
        y = 20;
      }
      const subject = subjects.find((s) => s.id === subjectId);
      const examList = pendingExamsBySubject.get(subjectId)!;
      pdf.setFillColor(255, 251, 235);
      pdf.setDrawColor(252, 211, 77);
      pdf.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 8, "FD");
      pdf.setFontSize(8);
      pdf.setTextColor(120, 53, 15);
      pdf.text(
        `${subject?.name ?? subjectId} -- ${examList.map((e) => `${e.name} (${e.term})`).join(", ")} -- Pending teacher approval`,
        PAGE_MARGIN + 2,
        y + 5.5
      );
      pdf.setTextColor(0, 0, 0);
      y += 12;
    }

    for (const subjectId of subjectIds) {
      if (y > 235) {
        pdf.addPage();
        drawPageFrame(pdf);
        y = 20;
      }
      const subject = subjects.find((s) => s.id === subjectId);
      const teacher = teachers.find((t) =>
        t.assignments.some((a) => a.classId === student.classId && a.subjectId === subjectId)
      );
      y = renderSubjectSection(pdf, y, {
        subjectId,
        approvedExams: examsBySubject.get(subjectId)!,
        marks,
        componentSets,
        studentClassId: student.classId,
        subject,
        classLabel,
        teacher,
      });
    }

    if (subjectIds.length === 0 && pendingSubjectIds.length === 0) {
      pdf.setFontSize(10);
      pdf.text("No published results yet.", PAGE_MARGIN, y);
      y += 8;
    }

    drawSignatureFooter(pdf, y);
  }

  // Page numbers, added last since the total page count isn't known until
  // the whole document is built.
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(`Page ${i} of ${pageCount}`, 210 - PAGE_MARGIN, 297 - FRAME_MARGIN - 3, { align: "right" });
    pdf.setTextColor(0, 0, 0);
  }

  return pdf;
}

export async function downloadMarksheetsPdf(schoolId: string, students: Student[], filename: string) {
  const pdf = await buildMarksheetsPdf(schoolId, students);
  pdf.save(filename);
}

function renderSubjectSection(
  pdf: jsPDF,
  startY: number,
  opts: {
    subjectId: string;
    approvedExams: Exam[];
    marks: (Marks & { id: string })[];
    componentSets: (ExamComponentSet & { id: string })[];
    studentClassId: string;
    subject: (Subject & { id: string }) | undefined;
    classLabel: (SchoolClass & { id: string }) | undefined;
    teacher: (Teacher & { id: string }) | undefined;
  }
): number {
  const { subjectId, approvedExams, marks, componentSets, studentClassId, subject, classLabel, teacher } = opts;

  const rows: (string | number)[][] = [];
  let serial = 0;
  let combinedMax = 0,
    combinedWeightage = 0,
    combinedScored = 0,
    combinedWeightageMark = 0,
    combinedLost = 0;

  for (const exam of approvedExams) {
    const cs = componentSets.find(
      (c) => c.examId === exam.id && c.classId === studentClassId && c.subjectId === subjectId
    );
    if (!cs || cs.components.length === 0) continue;
    const record = marks.find((m) => m.examId === exam.id);
    const result = computeSubjectResult(subjectId, cs.components, record?.componentMarks[subjectId]);
    if (!result.components.some((c) => c.present)) continue;

    combinedMax += result.totalMax;
    combinedWeightage += result.totalWeightage;
    combinedScored += result.totalScored;
    combinedWeightageMark += result.totalWeightageMark;
    combinedLost += result.lostWeightage;

    const remark = record?.remarks?.[subjectId];
    result.components.forEach((c, i) => {
      serial += 1;
      rows.push([
        serial,
        i === 0 ? `${exam.name} (${exam.term})` : "",
        c.title,
        c.maxMark,
        c.weightage,
        c.present ? "Present" : "Absent",
        c.scored?.toFixed(1) ?? "-",
        c.weightageMark?.toFixed(1) ?? "-",
        i === 0 ? remark ?? "" : "",
      ]);
    });
  }

  if (rows.length === 0) return startY;

  let y = startY;
  pdf.setFillColor(...ACCENT);
  pdf.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 7.5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8.5);
  const headerParts = [
    subject?.code ?? subjectId,
    subject?.name ?? "-",
    classLabel ? `${classLabel.grade}-${classLabel.section}` : undefined,
    teacher?.name,
  ].filter(Boolean);
  pdf.text(headerParts.join("   ·   "), PAGE_MARGIN + 3, y + 5.2);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);
  y += 7.5;

  autoTable(pdf, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [["Sl.No", "Exam", "Mark Title", "Max", "Wt %", "Status", "Scored", "Wt Mark", "Remark"]],
    body: rows,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: ACCENT_LIGHT, textColor: ACCENT_DARK, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    theme: "grid",
  });
  y = getFinalY(pdf);

  const combinedPercentage = combinedWeightage > 0 ? (combinedWeightageMark / combinedWeightage) * 100 : 0;
  const combinedGrade = gradeForPercentage(combinedPercentage);

  pdf.setFillColor(...ACCENT_LIGHT);
  pdf.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 7.5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...ACCENT_DARK);
  pdf.text(
    `Total: ${combinedScored.toFixed(2)} / ${combinedMax.toFixed(2)} (${combinedWeightageMark.toFixed(2)} / ${combinedWeightage.toFixed(2)}) -- Lost ${combinedLost.toFixed(2)}`,
    PAGE_MARGIN + 3,
    y + 5.2
  );
  pdf.text(`Grade: ${combinedGrade}`, PAGE_MARGIN + CONTENT_WIDTH - 3, y + 5.2, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);
  y += 11;

  return y;
}
