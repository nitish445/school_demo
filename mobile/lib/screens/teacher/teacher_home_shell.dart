import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import 'teacher_attendance_screen.dart';
import 'teacher_calendar_screen.dart';
import 'teacher_dashboard_screen.dart';
import 'teacher_homework_screen.dart';
import 'teacher_marks_screen.dart';
import 'teacher_profile_screen.dart';
import 'teacher_timetable_screen.dart';

/// Fetches the signed-in teacher's own profile once and hosts the bottom-tab
/// navigation, passing the profile down so each tab doesn't re-fetch it.
class TeacherHomeShell extends StatefulWidget {
  const TeacherHomeShell({super.key});

  @override
  State<TeacherHomeShell> createState() => _TeacherHomeShellState();
}

class _TeacherHomeShellState extends State<TeacherHomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final schoolId = auth.schoolId;
    final uid = auth.user?.uid;

    if (schoolId == null || uid == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return StreamBuilder<Teacher?>(
      stream: FirestoreService.docStream(
        'schools/$schoolId/teachers/$uid',
        Teacher.fromMap,
      ),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        final teacher = snapshot.data;
        if (teacher == null) {
          return const Scaffold(
            body: Center(
                child: Text(
                    'Teacher profile not found. Contact your school admin.')),
          );
        }
        final classIds = <String>{
          if (teacher.classTeacherOf != null) teacher.classTeacherOf!,
          ...teacher.assignedClassIds,
        }.toList();

        final tabs = [
          TeacherDashboardScreen(
              schoolId: schoolId, teacher: teacher, classIds: classIds),
          TeacherAttendanceScreen(schoolId: schoolId, classIds: classIds),
          TeacherHomeworkScreen(
              schoolId: schoolId, teacher: teacher, classIds: classIds),
          TeacherMarksScreen(
              schoolId: schoolId, teacher: teacher, classIds: classIds),
          TeacherTimetableScreen(
              schoolId: schoolId, teacher: teacher, classIds: classIds),
          TeacherCalendarScreen(schoolId: schoolId),
          TeacherProfileScreen(schoolId: schoolId, teacher: teacher),
        ];

        return Scaffold(
          body: tabs[_tab],
          bottomNavigationBar: NavigationBar(
            selectedIndex: _tab,
            onDestinationSelected: (i) => setState(() => _tab = i),
            destinations: const [
              NavigationDestination(
                  icon: Icon(Icons.home_outlined), label: 'Home'),
              NavigationDestination(
                  icon: Icon(Icons.checklist_outlined), label: 'Attendance'),
              NavigationDestination(
                  icon: Icon(Icons.menu_book_outlined), label: 'Homework'),
              NavigationDestination(
                  icon: Icon(Icons.grade_outlined), label: 'Marks'),
              NavigationDestination(
                  icon: Icon(Icons.schedule_outlined), label: 'Timetable'),
              NavigationDestination(
                  icon: Icon(Icons.calendar_month_outlined), label: 'Calendar'),
              NavigationDestination(
                  icon: Icon(Icons.person_outline), label: 'Profile'),
            ],
          ),
        );
      },
    );
  }
}
