import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../models/models.dart';

/// Role/schoolId come from the signed-in user's own `users/{uid}` Firestore
/// doc, not Auth custom claims -- mirrors /web/contexts/AuthContext.tsx and
/// `myProfile()` in /firebase/firestore.rules. The current account-creation
/// flow (see /web/lib/createAccount.ts) never sets custom claims -- there's
/// no Cloud Functions on the free Spark plan to do it from -- so relying on
/// them here would leave every teacher/parent/admin account permanently
/// unable to sign into the mobile app.
class AuthService extends ChangeNotifier {
  AuthService() {
    _auth.authStateChanges().listen(_onAuthStateChanged);
  }

  final FirebaseAuth _auth = FirebaseAuth.instance;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _profileSub;

  User? user;
  AppRole role = AppRole.unknown;
  String? schoolId;
  bool loading = true;

  void _onAuthStateChanged(User? firebaseUser) {
    _profileSub?.cancel();
    _profileSub = null;
    user = firebaseUser;

    if (firebaseUser == null) {
      role = AppRole.unknown;
      schoolId = null;
      loading = false;
      notifyListeners();
      return;
    }

    loading = true;
    notifyListeners();

    // Live-subscribed (not a one-time get) so a status/role change --
    // most importantly an admin disabling this account mid-session --
    // takes effect immediately, same as the web app.
    _profileSub = FirebaseFirestore.instance
        .doc('users/${firebaseUser.uid}')
        .snapshots()
        .listen((snap) {
      final data = snap.data();
      final status = data?['status'] as String?;
      if (data == null || status == 'disabled') {
        role = AppRole.unknown;
        schoolId = null;
        loading = false;
        notifyListeners();
        if (status == 'disabled') signOut();
        return;
      }
      role = appRoleFromString(data['role'] as String?);
      schoolId = data['schoolId'] as String?;
      loading = false;
      notifyListeners();
    });
  }

  Future<void> signIn(String email, String password) async {
    await _auth.signInWithEmailAndPassword(email: email, password: password);
  }

  Future<void> signOut() => _auth.signOut();

  @override
  void dispose() {
    _profileSub?.cancel();
    super.dispose();
  }
}
