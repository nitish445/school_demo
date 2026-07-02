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

export interface Teacher {
  id: string; // == uid
  name: string;
  employeeId: string;
  subjectIds: string[];
  classTeacherOf: string | null;
}

export interface Parent {
  id: string; // == uid
  name: string;
  childStudentIds: string[];
}

export interface SchoolClass {
  id: string;
  grade: string;
  section: string;
  classTeacherId: string | null;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "halfDay" | "medicalLeave";

export interface AttendanceRecord {
  date: string; // ISO date, also the doc id
  studentStatuses: Record<string, AttendanceStatus>;
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
  fromDate: string;
  toDate: string;
  reason: string;
  medicalCertUrl?: string;
  status: LeaveStatus;
  approvedBy?: string;
}
