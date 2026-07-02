// Mirrors /web/types/models.ts -- kept in sync by hand since the mobile app
// and web app share the same Firestore schema but not a code generator.

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
  final String employeeId;
  final List<TeacherAssignment> assignments;
  final List<String> assignedClassIds;
  final String? classTeacherOf;
  final String status;

  Teacher({
    required this.id,
    required this.name,
    required this.employeeId,
    required this.assignments,
    required this.assignedClassIds,
    required this.classTeacherOf,
    required this.status,
  });

  factory Teacher.fromMap(String id, Map<String, dynamic> map) {
    return Teacher(
      id: id,
      name: map['name'] as String? ?? '',
      employeeId: map['employeeId'] as String? ?? '',
      assignments: ((map['assignments'] as List<dynamic>?) ?? [])
          .map((a) => TeacherAssignment.fromMap(Map<String, dynamic>.from(a as Map)))
          .toList(),
      assignedClassIds: List<String>.from(map['assignedClassIds'] as List<dynamic>? ?? []),
      classTeacherOf: map['classTeacherOf'] as String?,
      status: map['status'] as String? ?? 'active',
    );
  }
}

class ParentProfile {
  final String id;
  final String name;
  final List<String> childStudentIds;
  final String status;

  ParentProfile({
    required this.id,
    required this.name,
    required this.childStudentIds,
    required this.status,
  });

  factory ParentProfile.fromMap(String id, Map<String, dynamic> map) {
    return ParentProfile(
      id: id,
      name: map['name'] as String? ?? '',
      childStudentIds: List<String>.from(map['childStudentIds'] as List<dynamic>? ?? []),
      status: map['status'] as String? ?? 'active',
    );
  }
}

class SchoolClass {
  final String id;
  final String grade;
  final String section;

  SchoolClass({required this.id, required this.grade, required this.section});

  factory SchoolClass.fromMap(String id, Map<String, dynamic> map) {
    return SchoolClass(
      id: id,
      grade: map['grade'] as String? ?? '',
      section: map['section'] as String? ?? '',
    );
  }

  String get label => '$grade-$section';
}

class Subject {
  final String id;
  final String name;
  final String code;

  Subject({required this.id, required this.name, required this.code});

  factory Subject.fromMap(String id, Map<String, dynamic> map) {
    return Subject(id: id, name: map['name'] as String? ?? '', code: map['code'] as String? ?? '');
  }
}

class Student {
  final String id;
  final String name;
  final String admissionNo;
  final String rollNo;
  final String classId;
  final String? dob;
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
      emergencyContact: map['emergencyContact'] as String?,
      medicalNotes: map['medicalNotes'] as String?,
      parentIds: List<String>.from(map['parentIds'] as List<dynamic>? ?? []),
      status: map['status'] as String? ?? 'active',
    );
  }
}

const List<String> attendanceStatuses = ['present', 'absent', 'late', 'halfDay', 'medicalLeave'];

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
      submissions: Map<String, String>.from(map['submissions'] as Map<dynamic, dynamic>? ?? {}),
    );
  }
}

class Exam {
  final String id;
  final String name;
  final String term;
  final bool published;
  final List<Map<String, dynamic>> subjects;

  Exam({
    required this.id,
    required this.name,
    required this.term,
    required this.published,
    required this.subjects,
  });

  factory Exam.fromMap(String id, Map<String, dynamic> map) {
    return Exam(
      id: id,
      name: map['name'] as String? ?? '',
      term: map['term'] as String? ?? '',
      published: map['published'] as bool? ?? false,
      subjects: ((map['subjects'] as List<dynamic>?) ?? [])
          .map((s) => Map<String, dynamic>.from(s as Map))
          .toList(),
    );
  }
}

class Marks {
  final String id;
  final String studentId;
  final String examId;
  final Map<String, num> subjectMarks;
  final String? remarks;

  Marks({
    required this.id,
    required this.studentId,
    required this.examId,
    required this.subjectMarks,
    this.remarks,
  });

  factory Marks.fromMap(String id, Map<String, dynamic> map) {
    return Marks(
      id: id,
      studentId: map['studentId'] as String? ?? '',
      examId: map['examId'] as String? ?? '',
      subjectMarks: Map<String, num>.from(map['subjectMarks'] as Map<dynamic, dynamic>? ?? {}),
      remarks: map['remarks'] as String?,
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

  FeeRecord({required this.id, required this.totalDue, required this.totalPaid});

  factory FeeRecord.fromMap(String id, Map<String, dynamic> map) {
    return FeeRecord(
      id: id,
      totalDue: map['totalDue'] as num? ?? 0,
      totalPaid: map['totalPaid'] as num? ?? 0,
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
