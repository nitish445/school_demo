export type Role = "admin" | "classTeacher" | "subjectTeacher" | "parent";

export interface AppUser {
  uid: string;
  schoolId: string;
  role: Role;
  displayName: string;
  email: string;
  phone?: string;
  status: "active" | "disabled";
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
  employeeId: string;
  // Which classes/subjects this teacher teaches as a subject teacher.
  assignments: TeacherAssignment[];
  // Denormalized `assignments[].classId`, deduped. Firestore security rules
  // can't filter a list of maps by one key, so this flat list lets rules
  // check "does this teacher teach in this class" in a single `in` lookup.
  // Kept in sync by the setTeacherAssignments Cloud Function.
  assignedClassIds: string[];
  // The one class this teacher is the class (home-room) teacher for, if any.
  classTeacherOf: string | null;
  // Denormalized from users/{uid}.status by the setAccountStatus Cloud
  // Function, since admins can't `list` the top-level users collection.
  status: "active" | "disabled";
}

export interface Parent {
  id: string; // == uid
  name: string;
  childStudentIds: string[];
  status: "active" | "disabled";
}

export interface SchoolClass {
  id: string;
  grade: string;
  section: string;
  // No classTeacherId here on purpose: `teachers/{uid}.classTeacherOf` is the
  // single source of truth (security rules depend on it). Look up the class
  // teacher by finding the teacher whose classTeacherOf equals this class id.
}

export interface Subject {
  id: string;
  name: string;
  code: string;
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

export interface Exam {
  id: string;
  name: string;
  term: string;
  subjects: { subjectId: string; date: string; maxMarks: number }[];
  published: boolean;
}

export interface Marks {
  id: string; // `${examId}_${studentId}`
  studentId: string;
  examId: string;
  subjectMarks: Record<string, number>;
  remarks?: string;
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
