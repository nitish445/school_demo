import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../models/models.dart';

class AuthService extends ChangeNotifier {
  AuthService() {
    _auth.authStateChanges().listen(_onAuthStateChanged);
  }

  final FirebaseAuth _auth = FirebaseAuth.instance;

  User? user;
  AppRole role = AppRole.unknown;
  String? schoolId;
  bool loading = true;

  Future<void> _onAuthStateChanged(User? firebaseUser) async {
    user = firebaseUser;
    if (firebaseUser == null) {
      role = AppRole.unknown;
      schoolId = null;
    } else {
      // forceRefresh picks up custom claims set right after the admin
      // creates the account (assignUserClaims Cloud Function).
      final idTokenResult = await firebaseUser.getIdTokenResult(true);
      role = appRoleFromString(idTokenResult.claims?['role'] as String?);
      schoolId = idTokenResult.claims?['schoolId'] as String?;
    }
    loading = false;
    notifyListeners();
  }

  Future<void> signIn(String email, String password) async {
    await _auth.signInWithEmailAndPassword(email: email, password: password);
  }

  Future<void> signOut() => _auth.signOut();
}
