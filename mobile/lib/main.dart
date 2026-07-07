import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'firebase_options.dart';
import 'models/models.dart';
import 'screens/admin/admin_home_shell.dart';
import 'screens/login_screen.dart';
import 'screens/parent/parent_home_shell.dart';
import 'screens/teacher/teacher_home_shell.dart';
import 'services/auth_service.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const SchoolPortalApp());
}

class SchoolPortalApp extends StatelessWidget {
  const SchoolPortalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthService(),
      child: MaterialApp(
        title: 'School Portal',
        theme: AppTheme.light,
        themeMode: ThemeMode.light,
        home: const RootRouter(),
      ),
    );
  }
}

/// Routes to the right dashboard for the signed-in user's role. Admin gets
/// a smaller slice of /web/app/admin (see AdminHomeShell) -- the full control
/// panel (bulk CSV import, fee entry, admin account management, ...) is
/// still web-only.
class RootRouter extends StatelessWidget {
  const RootRouter({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    if (auth.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (auth.user == null) {
      return const LoginScreen();
    }
    switch (auth.role) {
      case AppRole.classTeacher:
      case AppRole.subjectTeacher:
        return const TeacherHomeShell();
      case AppRole.parent:
        return const ParentHomeShell();
      case AppRole.admin:
        return const AdminHomeShell();
      case AppRole.unknown:
        return const Scaffold(
          body: Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'This account is not set up for the mobile app yet. '
                'Contact your school admin.',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        );
    }
  }
}
