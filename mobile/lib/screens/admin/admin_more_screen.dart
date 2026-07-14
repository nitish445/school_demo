import 'package:flutter/material.dart';

import 'admin_activity_screen.dart';
import 'admin_admins_screen.dart';
import 'admin_announcements_screen.dart';
import 'admin_calendar_screen.dart';
import 'admin_exams_screen.dart';
import 'admin_fees_screen.dart';
import 'admin_homework_screen.dart';
import 'admin_profile_screen.dart';
import 'admin_staff_attendance_screen.dart';
import 'admin_timetable_screen.dart';

class _MoreItem {
  const _MoreItem(this.icon, this.label, this.builder);
  final IconData icon;
  final String label;
  final WidgetBuilder builder;
}

/// The long tail of admin sections that don't fit in the bottom nav.
/// Mirrors the rest of /web/components/admin/AdminNav.tsx.
class AdminMoreScreen extends StatelessWidget {
  const AdminMoreScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  Widget build(BuildContext context) {
    final items = <_MoreItem>[
      _MoreItem(Icons.event_note_outlined, 'Exams',
          (_) => AdminExamsScreen(schoolId: schoolId)),
      _MoreItem(Icons.payments_outlined, 'Fees',
          (_) => AdminFeesScreen(schoolId: schoolId)),
      _MoreItem(Icons.menu_book_outlined, 'Homework',
          (_) => AdminHomeworkScreen(schoolId: schoolId)),
      _MoreItem(Icons.campaign_outlined, 'Announcements',
          (_) => AdminAnnouncementsScreen(schoolId: schoolId)),
      _MoreItem(Icons.schedule_outlined, 'Timetable',
          (_) => AdminTimetableScreen(schoolId: schoolId)),
      _MoreItem(Icons.fingerprint, 'Staff Attendance',
          (_) => AdminStaffAttendanceScreen(schoolId: schoolId)),
      _MoreItem(Icons.calendar_month_outlined, 'Calendar',
          (_) => AdminCalendarScreen(schoolId: schoolId)),
      _MoreItem(Icons.admin_panel_settings_outlined, 'Admins',
          (_) => AdminAdminsScreen(schoolId: schoolId)),
      _MoreItem(Icons.history_outlined, 'Activity Log',
          (_) => AdminActivityScreen(schoolId: schoolId)),
      _MoreItem(Icons.person_outline, 'Profile',
          (_) => AdminProfileScreen(schoolId: schoolId)),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView.separated(
        itemCount: items.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final item = items[i];
          return ListTile(
            leading: Icon(item.icon),
            title: Text(item.label),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
                context, MaterialPageRoute(builder: item.builder)),
          );
        },
      ),
    );
  }
}
