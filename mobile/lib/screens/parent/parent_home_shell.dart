import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import 'parent_attendance_screen.dart';
import 'parent_dashboard_screen.dart';
import 'parent_fees_screen.dart';
import 'parent_homework_screen.dart';
import 'parent_profile_screen.dart';

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

/// Fetches the signed-in parent's own profile once, manages which child is
/// selected (for parents with multiple children), and hosts the bottom-tab
/// navigation -- mirrors /web/app/parent/layout.tsx.
class ParentHomeShell extends StatefulWidget {
  const ParentHomeShell({super.key});

  @override
  State<ParentHomeShell> createState() => _ParentHomeShellState();
}

class _ParentHomeShellState extends State<ParentHomeShell> {
  int _tab = 0;
  String? _selectedChildId;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final schoolId = auth.schoolId;
    final uid = auth.user?.uid;

    if (schoolId == null || uid == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return StreamBuilder<ParentProfile?>(
      stream: FirestoreService.docStream('schools/$schoolId/parents/$uid', ParentProfile.fromMap),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        final parent = snapshot.data;
        if (parent == null || parent.childStudentIds.isEmpty) {
          return Scaffold(
            appBar: AppBar(
              title: const Text('School Portal'),
              actions: [IconButton(icon: const Icon(Icons.logout), onPressed: () => auth.signOut())],
            ),
            body: const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('No children are linked to your account yet. Contact the school admin.'),
              ),
            ),
          );
        }

        final childId = _selectedChildId ?? parent.childStudentIds.first;

        final tabs = [
          ParentDashboardScreen(schoolId: schoolId, childId: childId),
          ParentAttendanceScreen(schoolId: schoolId, childId: childId),
          ParentHomeworkScreen(schoolId: schoolId, childId: childId),
          ParentFeesScreen(schoolId: schoolId, childId: childId),
          ParentProfileScreen(schoolId: schoolId, childId: childId),
        ];

        return Scaffold(
          appBar: parent.childStudentIds.length > 1
              ? AppBar(
                  title: StreamBuilder<List<Student>>(
                    stream: FirestoreService.collectionStream('schools/$schoolId/students', Student.fromMap),
                    builder: (context, studentSnap) {
                      final students = studentSnap.data ?? [];
                      String labelFor(String id) =>
                          students.where((s) => s.id == id).map((s) => s.name).firstOrNull ?? id;
                      return DropdownButton<String>(
                        value: childId,
                        dropdownColor: Theme.of(context).colorScheme.surface,
                        items: parent.childStudentIds
                            .map((id) => DropdownMenuItem(value: id, child: Text(labelFor(id))))
                            .toList(),
                        onChanged: (v) => setState(() => _selectedChildId = v),
                      );
                    },
                  ),
                )
              : null,
          body: tabs[_tab],
          bottomNavigationBar: NavigationBar(
            selectedIndex: _tab,
            onDestinationSelected: (i) => setState(() => _tab = i),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
              NavigationDestination(icon: Icon(Icons.checklist_outlined), label: 'Attendance'),
              NavigationDestination(icon: Icon(Icons.menu_book_outlined), label: 'Homework'),
              NavigationDestination(icon: Icon(Icons.payments_outlined), label: 'Fees'),
              NavigationDestination(icon: Icon(Icons.person_outline), label: 'Profile'),
            ],
          ),
        );
      },
    );
  }
}
