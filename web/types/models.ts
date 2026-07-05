export type Role = "admin" | "classTeacher" | "subjectTeacher" | "parent";

// A title for admin-role staff -- distinct from `Role`, which stays "admin"
// for all of these so the existing isAdmin() rules/permissions don't need to
// change. "principal" is the one designation with extra powers (see
// isPrincipal() in firestore.rules); the rest are purely descriptive.
export type AdminDesignation = "principal" | "incharge" | "labAssistant" | "teacher";

export interface AppUser {
  uid: string;
  schoolId: string;
  role: Role;
  displayName: string;
  email: string;
  phone?: string;
  status: "active" | "disabled";
  designation?: AdminDesignation; // only set when role === "admin"
  photoUrl?: string;
}

export interface School {
  id: string;
  name: string;
  address?: string;
  logoUrl?: string;
  academicYear: string;
  workingDays: number[]; // 0 (Sun) - 6 (Sat)
  holidays: string[]; // ISO dates
}

export interface Student {
  id: string;
  name: string;
  admissionNo: string;
  rollNo: string;
  classId: string;
  sectionId: string;
  dob?: string;
  gender?: "male" | "female" | "other";
  parentIds: string[];
  address?: string;
  emergencyContact?: string;
  medicalNotes?: string;
  status: "active" | "archived";
}

export interface TeacherAssignment {
  classId: string;
  subjectId: string;
}

export interface Teacher {
  id: string; // == uid
  name: string;
  // Denormalized from users/{uid}.email at account-creation time, since
  // admins can't `list` the top-level users collection to look it up.
  email?: string;
  employeeId: string;
  // Which classes/subjects this teacher teaches as a subject teacher.
  assignments: TeacherAssignment[];
  // Denormalized `assignments[].classId`, deduped. Firestore security rules
  // can't filter a list of maps by one key, so this flat list lets rules
  // check "does this teacher teach in this class" in a single `in` lookup.
  // Kept in sync client-side whenever the admin edits assignments.
  assignedClassIds: string[];
  // The one class this teacher is the class (home-room) teacher for, if any.
  classTeacherOf: string | null;
  // Denormalized from users/{uid}.status at account-creation time; the admin
  // updates both copies together when toggling enable/disable.
  status: "active" | "disabled";
  photoUrl?: string;
}

export interface Parent {
  id: string; // == uid
  name: string;
  // Denormalized from users/{uid}.email at account-creation time, since
  // admins can't `list` the top-level users collection to look it up. Lets
  // the Students CSV import match a row's parentEmail against an existing
  // parent purely from client-side reads.
  email?: string;
  // Denormalized from users/{uid}.phone the same way, so the Students page
  // can show a linked parent's contact details without a separate lookup.
  phone?: string;
  childStudentIds: string[];
  status: "active" | "disabled";
  photoUrl?: string;
}

export interface SchoolClass {
  id: string;
  grade: string;
  section: string;
  year: string; // academic year, e.g. "2026-2027"
  // No classTeacherId here on purpose: `teachers/{uid}.classTeacherOf` is the
  // single source of truth (security rules depend on it). Look up the class
  // teacher by finding the teacher whose classTeacherOf equals this class id.
  status: "active" | "disabled";
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  year: string; // academic year, e.g. "2026-2027"
  status: "active" | "disabled";
}

export type AttendanceStatus = "present" | "absent" | "late" | "halfDay" | "medicalLeave";

export interface AttendanceRecord {
  id: string; // `${studentId}_${date}`
  studentId: string;
  classId: string;
  date: string; // ISO date
  status: AttendanceStatus;
  markedBy: string;
  markedAt: number;
}

export type HomeworkSubmissionStatus = "pending" | "submitted" | "completed";

export interface Homework {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  description: string;
  attachmentUrls: string[];
  dueDate: string;
  createdBy: string;
  // Snapshot of the class roster at creation time, kept in sync by the
  // class-teacher UI when the roster changes. Lets Firestore security rules
  // grant a parent read access via `studentIds.hasAny(childStudentIds)`
  // without needing per-student documents.
  studentIds: string[];
  submissions: Record<string, HomeworkSubmissionStatus>;
}

export interface ExamComponent {
  id: string; // client-generated (crypto.randomUUID()), stable across edits
  title: string; // e.g. "Continuous Assessment Test - I"
  maxMark: number;
  weightage: number; // percentage points this component contributes toward the subject total
}

export interface ExamScheduleEntry {
  // Scheduled by grade (e.g. "5"), not a specific section -- applies to
  // every class (5-A, 5-B, ...) in that grade, so admin doesn't have to add
  // one row per section.
  grade: string;
  subjectId: string;
  date: string;
}

// Admin-owned: name, term, and which class+subject sits which exam on which
// date. Deliberately has no marks-weighting info -- that's the subject
// teacher's call (see ExamComponentSet).
export interface Exam {
  id: string;
  name: string;
  term: string;
  schedule: ExamScheduleEntry[];
  published: boolean;
}

// Subject-teacher-owned: the weighted assessment breakdown (CAT-I, Quiz-I,
// FAT, ...) for one class+subject within one exam. Kept separate from Exam
// so Firestore rules can grant write access per class+subject
// (teachesClassSubject) without also granting it over the admin-owned
// schedule -- a single teacher-writable array field on Exam couldn't be
// scoped that precisely.
export interface ExamComponentSet {
  id: string; // `${examId}_${classId}_${subjectId}`
  examId: string;
  classId: string;
  subjectId: string;
  components: ExamComponent[];
  // Gate before a parent can see these marks -- only an admin or the
  // class's own class teacher can set this true; the subject teacher who
  // entered the marks cannot self-approve. Any further edit by the subject
  // teacher resets this to false, forcing re-review.
  approved?: boolean;
  approvedBy?: string;
  approvedAt?: number;
}

export interface Marks {
  id: string; // `${examId}_${studentId}`
  studentId: string;
  examId: string;
  // subjectId -> componentId -> scored mark
  componentMarks: Record<string, Record<string, number>>;
  // subjectId -> the subject teacher's remark for this exam
  remarks?: Record<string, string>;
}

export type AnnouncementAudience = "all" | "class" | "role";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  classId?: string;
  role?: Role;
  createdBy: string;
  createdAt: number;
}

export interface FeePayment {
  id: string;
  amount: number;
  date: string;
  mode: "cash" | "cheque" | "online" | "other";
  receiptNo: string;
}

export interface FeeRecord {
  id: string; // == studentId
  feeStructureRef?: string;
  totalDue: number;
  totalPaid: number;
}

export type LeaveStatus = "pending" | "approved" | "rejected";

export interface Leave {
  id: string;
  studentId: string;
  classId: string; // denormalized from the student, for security rules + queries
  fromDate: string;
  toDate: string;
  reason: string;
  medicalCertUrl?: string;
  status: LeaveStatus;
  approvedBy?: string;
}

export type BehaviourNoteType = "good" | "lateComing" | "misconduct" | "achievement";

export interface BehaviourNote {
  id: string;
  studentId: string;
  classId: string; // denormalized, for security rules + queries
  type: BehaviourNoteType;
  note: string;
  date: string; // ISO date
  createdBy: string;
}

export interface DiaryEntry {
  id: string; // `${classId}_${date}`
  classId: string;
  date: string; // ISO date
  topicsCovered: string;
  bringTomorrow: string;
  specialNotes: string;
  createdBy: string;
  // Snapshot of the class roster, same rationale as Homework.studentIds:
  // lets Firestore rules grant parent read access via `hasAny`.
  studentIds: string[];
}

export interface Admin {
  id: string; // == uid
  name: string;
  email?: string;
  status: "active" | "disabled";
  designation?: AdminDesignation;
  photoUrl?: string;
}

export interface TimetablePeriod {
  day: number; // 0 (Sun) - 6 (Sat), matches School.workingDays numbering
  period: number; // 1-based slot index
  subjectId?: string; // omitted for non-teaching slots (assembly, lunch, etc.)
  label?: string; // free text, only used when there's no subjectId
  startTime?: string; // "HH:mm"
  endTime?: string; // "HH:mm"
}

export interface Timetable {
  id: string; // == classId
  classId: string;
  periods: TimetablePeriod[];
}

export type CalendarEventType = "holiday" | "exam" | "ptm" | "event" | "other";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO date, start date
  endDate?: string; // ISO date, only set for multi-day events (inclusive span)
  type: CalendarEventType;
  createdBy: string;
}

export interface AuditLogEntry {
  id: string;
  action: "create" | "update" | "delete";
  entity: string;
  entityLabel: string;
  actorUid: string;
  actorEmail: string;
  createdAt: { toDate: () => Date } | null; // Firestore Timestamp (null briefly, before the server resolves it)
}
