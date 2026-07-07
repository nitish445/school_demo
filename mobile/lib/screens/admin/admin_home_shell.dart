import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/auth_service.dart';
import 'admin_attendance_screen.dart';
import 'admin_dashboard_screen.dart';
import 'admin_directory_screen.dart';
import 'admin_leave_screen.dart';
import 'admin_more_screen.dart';

/// Hosts the bottom-tab navigation for the admin mobile app: the four
/// sections an admin checks most on the go (dashboard, attendance, leave
/// approvals, the people/structure directory), plus a More tab for the rest
/// of /web/app/admin (exams, fees, homework monitor, announcements,
/// timetable, calendar, admin accounts, activity log, profile). CSV bulk
/// import and PDF export stay web-only -- see each screen's doc comment.
class AdminHomeShell extends StatefulWidget {
  const AdminHomeShell({super.key});

  @override
  State<AdminHomeShell> createState() => _AdminHomeShellState();
}

class _AdminHomeShellState extends State<AdminHomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final schoolId = auth.schoolId;

    if (schoolId == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final tabs = [
      AdminDashboardScreen(schoolId: schoolId),
      AdminAttendanceScreen(schoolId: schoolId),
      AdminLeaveScreen(schoolId: schoolId),
      AdminDirectoryScreen(schoolId: schoolId),
      AdminMoreScreen(schoolId: schoolId),
    ];

    return Scaffold(
      body: tabs[_tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          NavigationDestination(
              icon: Icon(Icons.checklist_outlined), label: 'Attendance'),
          NavigationDestination(
              icon: Icon(Icons.event_available_outlined), label: 'Leave'),
          NavigationDestination(
              icon: Icon(Icons.groups_outlined), label: 'Directory'),
          NavigationDestination(icon: Icon(Icons.more_horiz), label: 'More'),
        ],
      ),
    );
  }
}
