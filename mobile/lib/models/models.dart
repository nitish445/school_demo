// Mirrors /web/types/models.ts -- kept in sync by hand since the mobile app
// and web app share the same Firestore schema but not a code generator.

import 'package:cloud_firestore/cloud_firestore.dart' show Timestamp;

enum AppRole { admin, classTeacher, subjectTeacher, parent, unknown }

AppRole appRoleFromString(String? value) {
  switch (value) {
    case 'admin':
      return AppRole.admin;
    case 'classTeacher':
      return AppRole.classTeacher;
    case 'subjectTeacher':
      return AppRole.subjectTeacher;
    case 'parent':
      return AppRole.parent;
    default:
      return AppRole.unknown;
  }
}

class School {
  final String id;
  final String name;
  final String? address;
  final String academicYear;
  final List<int> workingDays; // 0 (Sun) - 6 (Sat)
  final List<String> holidays; // ISO dates

  School({
    required this.id,
    required this.name,
    this.address,
    required this.academicYear,
    required this.workingDays,
    required this.holidays,
  });

  factory School.fromMap(String id, Map<String, dynamic> map) {
    return School(
      id: id,
      name: map['name'] as String? ?? '',
      address: map['address'] as String?,
      academicYear: map['academicYear'] as String? ?? '',
      workingDays:
          ((map['workingDays'] as List<dynamic>?) ?? [1, 2, 3, 4, 5, 6])
              .map((d) => (d as num).toInt())
              .toList(),
      holidays: List<String>.from(map['holidays'] as List<dynamic>? ?? []),
    );
  }
}

class TeacherAssignment {
  final String classId;
  final String subjectId;

  TeacherAssignment({required this.classId, required this.subjectId});

  factory TeacherAssignment.fromMap(Map<String, dynamic> map) {
    return TeacherAssignment(
      classId: map['classId'] as String? ?? '',
      subjectId: map['subjectId'] as String? ?? '',
    );
  }
}

class Teacher {
  final String id;
  final String name;
  final String? email;
  final String employeeId;
  final List<TeacherAssignment> assignments;
  final List<String> assignedClassIds;
  final String? classTeacherOf;
  final String status;
  final String? photoUrl;

  Teacher({
    required this.id,
    required this.name,
    this.email,
    required this.employeeId,
    required this.assignments,
    required this.assignedClassIds,
    required this.classTeacherOf,
    required this.status,
    this.photoUrl,
  });

  factory Teacher.fromMap(String id, Map<String, dynamic> map) {
    return Teacher(
      id: id,
      name: map['name'] as String? ?? '',
      email: map['email'] as String?,
      employeeId: map['employeeId'] as String? ?? '',
      assignments: ((map['assignments'] as List<dynamic>?) ?? [])
          .map((a) =>
              TeacherAssignment.fromMap(Map<String, dynamic>.from(a as Map)))
          .toList(),
      assignedClassIds:
          List<String>.from(map['assignedClassIds'] as List<dynamic>? ?? []),
      classTeacherOf: map['classTeacherOf'] as String?,
      status: map['status'] as String? ?? 'active',
      photoUrl: map['photoUrl'] as String?,
    );
  }
}

const Map<String, String> adminDesignationLabels = {
  'principal': 'Principal',
  'incharge': 'Incharge',
  'labAssistant': 'Lab Assistant',
  'teacher': 'Admin',
};

class Admin {
  final String id;
  final String name;
  final String? email;
  final String status;
  final String? designation;
  final String? photoUrl;

  Admin({
    required this.id,
    required this.name,
    this.email,
    required this.status,
    this.designation,
    this.photoUrl,
  });

  factory Admin.fromMap(String id, Map<String, dynamic> map) {
    return Admin(
      id: id,
      name: map['name'] as String? ?? '',
      email: map['email'] as String?,
      status: map['status'] as String? ?? 'active',
      designation: map['designation'] as String?,
      photoUrl: map['photoUrl'] as String?,
    );
  }
}

/// The top-level `users/{uid}` doc -- the canonical display profile shared
/// across every role. Mirrors /web/types/models.ts `AppUser`; mobile only
/// needs it for Admin (Teacher/Parent already have richer per-school docs).
class AppUserProfile {
  final String uid;
  final String displayName;
  final String email;
  final String status;
  final String? designation;
  final String? photoUrl;

  AppUserProfile({
    required this.uid,
    required this.displayName,
    required this.email,
    required this.status,
    this.designation,
    this.photoUrl,
  });

  factory AppUserProfile.fromMap(String id, Map<String, dynamic> map) {
    return AppUserProfile(
      uid: id,
      displayName: map['displayName'] as String? ?? '',
      email: map['email'] as String? ?? '',
      status: map['status'] as String? ?? 'active',
      designation: map['designation'] as String?,
      photoUrl: map['photoUrl'] as String?,
    );
  }
}

class ParentProfile {
  final String id;
  final String name;
  final String? email;
  final String? phone;
  final List<String> childStudentIds;
  final String status;
  final String? photoUrl;

  ParentProfile({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    required this.childStudentIds,
    required this.status,
    this.photoUrl,
  });

  factory ParentProfile.fromMap(String id, Map<String, dynamic> map) {
    return ParentProfile(
      id: id,
      name: map['name'] as String? ?? '',
      email: map['email'] as String?,
      phone: map['phone'] as String?,
      childStudentIds:
          List<String>.from(map['childStudentIds'] as List<dynamic>? ?? []),
      status: map['status'] as String? ?? 'active',
      photoUrl: map['photoUrl'] as String?,
    );
  }
}

class SchoolClass {
  final String id;
  final String grade;
  final String section;
  final String year;
  final String status;

  SchoolClass({
    required this.id,
    required this.grade,
    required this.section,
    this.year = '',
    this.status = 'active',
  });

  factory SchoolClass.fromMap(String id, Map<String, dynamic> map) {
    return SchoolClass(
      id: id,
      grade: map['grade'] as String? ?? '',
      section: map['section'] as String? ?? '',
      year: map['year'] as String? ?? '',
      status: map['status'] as String? ?? 'active',
    );
  }

  String get label => '$grade-$section';
}

class Subject {
  final String id;
  final String name;
  final String code;
  final String year;
  final String status;

  Subject({
    required this.id,
    required this.name,
    required this.code,
    this.year = '',
    this.status = 'active',
  });

  factory Subject.fromMap(String id, Map<String, dynamic> map) {
    return Subject(
      id: id,
      name: map['name'] as String? ?? '',
      code: map['code'] as String? ?? '',
      year: map['year'] as String? ?? '',
      status: map['status'] as String? ?? 'active',
    );
  }
}

class Student {
  final String id;
  final String name;
  final String admissionNo;
  final String rollNo;
  final String classId;
  final String? dob;
  final String? gender;
  final String? address;
  final String? emergencyContact;
  final String? medicalNotes;
  final List<String> parentIds;
  final String status;

  Student({
    required this.id,
    required this.name,
    required this.admissionNo,
    required this.rollNo,
    required this.classId,
    this.dob,
    this.gender,
    this.address,
    this.emergencyContact,
    this.medicalNotes,
    required this.parentIds,
    required this.status,
  });

  factory Student.fromMap(String id, Map<String, dynamic> map) {
    return Student(
      id: id,
      name: map['name'] as String? ?? '',
      admissionNo: map['admissionNo'] as String? ?? '',
      rollNo: map['rollNo'] as String? ?? '',
      classId: map['classId'] as String? ?? '',
      dob: map['dob'] as String?,
      gender: map['gender'] as String?,
      address: map['address'] as String?,
      emergencyContact: map['emergencyContact'] as String?,
      medicalNotes: map['medicalNotes'] as String?,
      parentIds: List<String>.from(map['parentIds'] as List<dynamic>? ?? []),
      status: map['status'] as String? ?? 'active',
    );
  }
}

const List<String> attendanceStatuses = [
  'present',
  'absent',
  'late',
  'halfDay',
  'medicalLeave'
];

class AttendanceRecord {
  final String id;
  final String studentId;
  final String classId;
  final String date;
  final String status;

  AttendanceRecord({
    required this.id,
    required this.studentId,
    required this.classId,
    required this.date,
    required this.status,
  });

  factory AttendanceRecord.fromMap(String id, Map<String, dynamic> map) {
    return AttendanceRecord(
      id: id,
      studentId: map['studentId'] as String? ?? '',
      classId: map['classId'] as String? ?? '',
      date: map['date'] as String? ?? '',
      status: map['status'] as String? ?? 'present',
    );
  }
}

class Homework {
  final String id;
  final String classId;
  final String subjectId;
  final String title;
  final String description;
  final String dueDate;
  final String createdBy;
  final List<String> studentIds;
  final Map<String, String> submissions;

  Homework({
    required this.id,
    required this.classId,
    required this.subjectId,
    required this.title,
    required this.description,
    required this.dueDate,
    required this.createdBy,
    required this.studentIds,
    required this.submissions,
  });

  factory Homework.fromMap(String id, Map<String, dynamic> map) {
    return Homework(
      id: id,
      classId: map['classId'] as String? ?? '',
      subjectId: map['subjectId'] as String? ?? '',
      title: map['title'] as String? ?? '',
      description: map['description'] as String? ?? '',
      dueDate: map['dueDate'] as String? ?? '',
      createdBy: map['createdBy'] as String? ?? '',
      studentIds: List<String>.from(map['studentIds'] as List<dynamic>? ?? []),
      submissions: Map<String, String>.from(
          map['submissions'] as Map<dynamic, dynamic>? ?? {}),
    );
  }
}

// One weighted assessment component within a subject (CAT-I, Quiz-I, FAT, etc).
class ExamComponent {
  final String id;
  final String title;
  final num maxMark;
  final num weightage;

  ExamComponent(
      {required this.id,
      required this.title,
      required this.maxMark,
      required this.weightage});

  factory ExamComponent.fromMap(Map<String, dynamic> map) {
    return ExamComponent(
      id: map['id'] as String? ?? '',
      title: map['title'] as String? ?? '',
      maxMark: (map['maxMark'] as num?) ?? 0,
      weightage: (map['weightage'] as num?) ?? 0,
    );
  }
}

// Admin-owned: name, term, and which class+subject sits which exam on which
// date. No marks-weighting info here -- that's the subject teacher's call,
// see ExamComponentSet.
class Exam {
  final String id;
  final String name;
  final String term;
  final bool published;
  final List<Map<String, dynamic>> schedule; // {classId, subjectId, date}

  Exam({
    required this.id,
    required this.name,
    required this.term,
    required this.published,
    required this.schedule,
  });

  factory Exam.fromMap(String id, Map<String, dynamic> map) {
    return Exam(
      id: id,
      name: map['name'] as String? ?? '',
      term: map['term'] as String? ?? '',
      published: map['published'] as bool? ?? false,
      schedule: ((map['schedule'] as List<dynamic>?) ?? [])
          .map((s) => Map<String, dynamic>.from(s as Map))
          .toList(),
    );
  }
}

// Subject-teacher-owned: the weighted assessment breakdown (CAT-I, Quiz-I,
// FAT, ...) for one class+subject within one exam.
class ExamComponentSet {
  final String id; // `${examId}_${classId}_${subjectId}`
  final String examId;
  final String classId;
  final String subjectId;
  final List<ExamComponent> components;
  // Gate before a parent can see these marks -- only an admin or the
  // class's own class teacher can set this true.
  final bool approved;
  final String? approvedBy;
  final int? approvedAt;

  ExamComponentSet({
    required this.id,
    required this.examId,
    required this.classId,
    required this.subjectId,
    required this.components,
    this.approved = false,
    this.approvedBy,
    this.approvedAt,
  });

  factory ExamComponentSet.fromMap(String id, Map<String, dynamic> map) {
    return ExamComponentSet(
      id: id,
      examId: map['examId'] as String? ?? '',
      classId: map['classId'] as String? ?? '',
      subjectId: map['subjectId'] as String? ?? '',
      components: ((map['components'] as List<dynamic>?) ?? [])
          .map(
              (c) => ExamComponent.fromMap(Map<String, dynamic>.from(c as Map)))
          .toList(),
      approved: map['approved'] as bool? ?? false,
      approvedBy: map['approvedBy'] as String?,
      approvedAt: map['approvedAt'] as int?,
    );
  }
}

class Marks {
  final String id;
  final String studentId;
  final String examId;
  // subjectId -> componentId -> scored mark
  final Map<String, Map<String, num>> componentMarks;
  // subjectId -> the subject teacher's remark for this exam
  final Map<String, String> remarks;

  Marks({
    required this.id,
    required this.studentId,
    required this.examId,
    required this.componentMarks,
    this.remarks = const {},
  });

  factory Marks.fromMap(String id, Map<String, dynamic> map) {
    final raw = map['componentMarks'] as Map<dynamic, dynamic>? ?? {};
    final rawRemarks = map['remarks'] as Map<dynamic, dynamic>? ?? {};
    return Marks(
      id: id,
      studentId: map['studentId'] as String? ?? '',
      examId: map['examId'] as String? ?? '',
      componentMarks: raw.map(
        (subjectId, marks) =>
            MapEntry(subjectId as String, Map<String, num>.from(marks as Map)),
      ),
      remarks: rawRemarks.map((subjectId, remark) =>
          MapEntry(subjectId as String, remark as String)),
    );
  }
}

class Announcement {
  final String id;
  final String title;
  final String body;
  final int createdAt;

  Announcement({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAt,
  });

  factory Announcement.fromMap(String id, Map<String, dynamic> map) {
    return Announcement(
      id: id,
      title: map['title'] as String? ?? '',
      body: map['body'] as String? ?? '',
      createdAt: (map['createdAt'] as num?)?.toInt() ?? 0,
    );
  }
}

class FeePayment {
  final String id;
  final num amount;
  final String date;
  final String mode;
  final String receiptNo;

  FeePayment({
    required this.id,
    required this.amount,
    required this.date,
    required this.mode,
    required this.receiptNo,
  });

  factory FeePayment.fromMap(String id, Map<String, dynamic> map) {
    return FeePayment(
      id: id,
      amount: map['amount'] as num? ?? 0,
      date: map['date'] as String? ?? '',
      mode: map['mode'] as String? ?? '',
      receiptNo: map['receiptNo'] as String? ?? '',
    );
  }
}

class FeeRecord {
  final String id;
  final num totalDue;
  final num totalPaid;

  FeeRecord(
      {required this.id, required this.totalDue, required this.totalPaid});

  factory FeeRecord.fromMap(String id, Map<String, dynamic> map) {
    return FeeRecord(
      id: id,
      totalDue: map['totalDue'] as num? ?? 0,
      totalPaid: map['totalPaid'] as num? ?? 0,
    );
  }
}

class TimetablePeriod {
  final int day; // 0 (Sun) - 6 (Sat)
  final int period;
  final String? subjectId;
  final String? label;
  final String? startTime;
  final String? endTime;

  TimetablePeriod({
    required this.day,
    required this.period,
    this.subjectId,
    this.label,
    this.startTime,
    this.endTime,
  });

  factory TimetablePeriod.fromMap(Map<String, dynamic> map) {
    return TimetablePeriod(
      day: (map['day'] as num?)?.toInt() ?? 0,
      period: (map['period'] as num?)?.toInt() ?? 0,
      subjectId: map['subjectId'] as String?,
      label: map['label'] as String?,
      startTime: map['startTime'] as String?,
      endTime: map['endTime'] as String?,
    );
  }
}

class Timetable {
  final String id;
  final String classId;
  final List<TimetablePeriod> periods;

  Timetable({required this.id, required this.classId, required this.periods});

  factory Timetable.fromMap(String id, Map<String, dynamic> map) {
    return Timetable(
      id: id,
      classId: map['classId'] as String? ?? id,
      periods: ((map['periods'] as List<dynamic>?) ?? [])
          .map((p) =>
              TimetablePeriod.fromMap(Map<String, dynamic>.from(p as Map)))
          .toList(),
    );
  }
}

class Leave {
  final String id;
  final String studentId;
  final String classId;
  final String fromDate;
  final String toDate;
  final String reason;
  final String status;

  Leave({
    required this.id,
    required this.studentId,
    required this.classId,
    required this.fromDate,
    required this.toDate,
    required this.reason,
    required this.status,
  });

  factory Leave.fromMap(String id, Map<String, dynamic> map) {
    return Leave(
      id: id,
      studentId: map['studentId'] as String? ?? '',
      classId: map['classId'] as String? ?? '',
      fromDate: map['fromDate'] as String? ?? '',
      toDate: map['toDate'] as String? ?? '',
      reason: map['reason'] as String? ?? '',
      status: map['status'] as String? ?? 'pending',
    );
  }
}

enum CalendarEventType { holiday, exam, ptm, event, other }

CalendarEventType calendarEventTypeFromString(String? value) {
  switch (value) {
    case 'holiday':
      return CalendarEventType.holiday;
    case 'exam':
      return CalendarEventType.exam;
    case 'ptm':
      return CalendarEventType.ptm;
    case 'other':
      return CalendarEventType.other;
    default:
      return CalendarEventType.event;
  }
}

class CalendarEvent {
  final String id;
  final String title;
  final String? description;
  final String date; // ISO date, start
  final String? endDate; // ISO date, inclusive span end
  final CalendarEventType type;

  CalendarEvent({
    required this.id,
    required this.title,
    this.description,
    required this.date,
    this.endDate,
    required this.type,
  });

  factory CalendarEvent.fromMap(String id, Map<String, dynamic> map) {
    return CalendarEvent(
      id: id,
      title: map['title'] as String? ?? '',
      description: map['description'] as String?,
      date: map['date'] as String? ?? '',
      endDate: map['endDate'] as String?,
      type: calendarEventTypeFromString(map['type'] as String?),
    );
  }

  bool touchesDate(String iso) {
    if (endDate == null) return date == iso;
    return date.compareTo(iso) <= 0 && iso.compareTo(endDate!) <= 0;
  }
}

class AuditLogEntry {
  final String id;
  final String action;
  final String entity;
  final String entityLabel;
  final String actorUid;
  final String actorEmail;
  final DateTime? createdAt;

  AuditLogEntry({
    required this.id,
    required this.action,
    required this.entity,
    required this.entityLabel,
    required this.actorUid,
    required this.actorEmail,
    this.createdAt,
  });

  factory AuditLogEntry.fromMap(String id, Map<String, dynamic> map) {
    final timestamp = map['createdAt'];
    return AuditLogEntry(
      id: id,
      action: map['action'] as String? ?? 'update',
      entity: map['entity'] as String? ?? '',
      entityLabel: map['entityLabel'] as String? ?? '',
      actorUid: map['actorUid'] as String? ?? '',
      actorEmail: map['actorEmail'] as String? ?? '',
      createdAt: timestamp is Timestamp ? timestamp.toDate() : null,
    );
  }
}

/// One teacher's daily punch-in/punch-out record, doc id `{teacherId}_{date}`.
/// Location is logged for the admin's reference only -- punching in never
/// blocks on distance from school (no geofence).
class StaffAttendance {
  final String id;
  final String teacherId;
  final String date;
  final int? punchInAt;
  final double? punchInLat;
  final double? punchInLng;
  final int? punchOutAt;
  final double? punchOutLat;
  final double? punchOutLng;

  StaffAttendance({
    required this.id,
    required this.teacherId,
    required this.date,
    this.punchInAt,
    this.punchInLat,
    this.punchInLng,
    this.punchOutAt,
    this.punchOutLat,
    this.punchOutLng,
  });

  factory StaffAttendance.fromMap(String id, Map<String, dynamic> map) {
    return StaffAttendance(
      id: id,
      teacherId: map['teacherId'] as String? ?? '',
      date: map['date'] as String? ?? '',
      punchInAt: (map['punchInAt'] as num?)?.toInt(),
      punchInLat: (map['punchInLat'] as num?)?.toDouble(),
      punchInLng: (map['punchInLng'] as num?)?.toDouble(),
      punchOutAt: (map['punchOutAt'] as num?)?.toInt(),
      punchOutLat: (map['punchOutLat'] as num?)?.toDouble(),
      punchOutLng: (map['punchOutLng'] as num?)?.toDouble(),
    );
  }
}
