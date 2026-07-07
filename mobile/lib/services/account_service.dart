import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import 'firestore_service.dart';

enum AccountKind { teacher, parent, admin }

class CreateAccountInput {
  const CreateAccountInput({
    required this.schoolId,
    required this.email,
    required this.displayName,
    this.phone,
    required this.kind,
    this.employeeId,
  });

  final String schoolId;
  final String email;
  final String displayName;
  final String? phone;
  final AccountKind kind;
  final String? employeeId;
}

/// Creates the Firebase Auth login via a throwaway secondary app instance, so
/// it doesn't sign the admin out of their own session on the primary app (the
/// client SDK auto-signs-in whoever createUserWithEmailAndPassword just
/// created). Mirrors /web/lib/createAccount.ts -- there's no Admin SDK
/// involved, and therefore no custom claims get set, but that's fine since
/// security rules read the `users/{uid}` Firestore doc instead.
Future<String> createAuthUser(String email, String password) async {
  final secondaryApp = await Firebase.initializeApp(
    name: 'account-creation-${DateTime.now().millisecondsSinceEpoch}',
    options: Firebase.app().options,
  );
  try {
    final secondaryAuth = FirebaseAuth.instanceFor(app: secondaryApp);
    final credential = await secondaryAuth.createUserWithEmailAndPassword(
        email: email, password: password);
    final uid = credential.user!.uid;
    await secondaryAuth.signOut();
    return uid;
  } finally {
    await secondaryApp.delete();
  }
}

/// Writes the `users/{uid}` pointer doc and the role profile doc for an
/// already-created Auth user. Split out from [createAuthUser] so a failure
/// here (e.g. a dropped connection) can be retried against the same uid
/// without minting a second, orphaned Auth account for the same email.
Future<void> writeAccountProfile(String uid, CreateAccountInput input) async {
  final role = switch (input.kind) {
    AccountKind.parent => 'parent',
    AccountKind.admin => 'admin',
    AccountKind.teacher => 'subjectTeacher',
  };

  final batch = FirestoreService.batch();
  batch.set(FirestoreService.doc('users/$uid'), {
    'schoolId': input.schoolId,
    'role': role,
    'displayName': input.displayName,
    'email': input.email,
    'phone': input.phone,
    'status': 'active',
    if (input.kind == AccountKind.admin) 'designation': 'teacher',
  });

  if (input.kind == AccountKind.parent) {
    batch.set(FirestoreService.doc('schools/${input.schoolId}/parents/$uid'), {
      'name': input.displayName,
      'email': input.email,
      'phone': input.phone,
      'childStudentIds': <String>[],
      'status': 'active',
    });
  } else if (input.kind == AccountKind.admin) {
    batch.set(FirestoreService.doc('schools/${input.schoolId}/admins/$uid'), {
      'name': input.displayName,
      'email': input.email,
      'status': 'active',
      'designation': 'teacher',
    });
    batch.set(FirestoreService.doc('schools/${input.schoolId}/teachers/$uid'), {
      'name': input.displayName,
      'email': input.email,
      'employeeId': input.employeeId ?? '',
      'assignments': <Map<String, dynamic>>[],
      'assignedClassIds': <String>[],
      'classTeacherOf': null,
      'status': 'active',
    });
  } else {
    batch.set(FirestoreService.doc('schools/${input.schoolId}/teachers/$uid'), {
      'name': input.displayName,
      'email': input.email,
      'employeeId': input.employeeId ?? '',
      'assignments': <Map<String, dynamic>>[],
      'assignedClassIds': <String>[],
      'classTeacherOf': null,
      'status': 'active',
    });
  }

  await batch.commit();
}

String describeAuthError(Object err) {
  if (err is FirebaseAuthException) {
    switch (err.code) {
      case 'email-already-in-use':
        return 'That email is already registered. Use a different email.';
      case 'weak-password':
        return 'Password must be at least 6 characters.';
      case 'invalid-email':
        return "That doesn't look like a valid email address.";
    }
  }
  return 'Could not create the account. Please try again.';
}
