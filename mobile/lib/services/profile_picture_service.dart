import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';

import 'firestore_service.dart';

const int maxProfilePictureBytes = 3 * 1024 * 1024;

/// Returns a user-facing message if `file` isn't a valid profile picture, or
/// null if it's fine to upload. Mirrors /web/lib/profilePicture.ts.
String? describeProfilePictureError(File file) {
  if (file.lengthSync() > maxProfilePictureBytes)
    return 'Image must be smaller than 3MB.';
  return null;
}

/// Uploads to a fixed path per user (so re-uploading just replaces it), then
/// writes the resulting URL to `users/{uid}` plus whichever role-specific
/// docs also denormalize it, mirroring updateProfilePicture in
/// /web/lib/profilePicture.ts so both apps show the same photo.
Future<String> updateProfilePicture(
    String uid, File file, List<String> extraDocPaths) async {
  final ref = FirebaseStorage.instance.ref('profile-pictures/$uid/photo');
  await ref.putFile(file, SettableMetadata(contentType: 'image/jpeg'));
  final photoUrl = await ref.getDownloadURL();

  final batch = FirestoreService.batch();
  batch.set(FirestoreService.doc('users/$uid'), {'photoUrl': photoUrl},
      SetOptions(merge: true));
  for (final path in extraDocPaths) {
    batch.set(FirestoreService.doc(path), {'photoUrl': photoUrl},
        SetOptions(merge: true));
  }
  await batch.commit();

  return photoUrl;
}
