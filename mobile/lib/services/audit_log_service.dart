import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// Records who changed what, for the Admin Activity Log. Best-effort: a
/// failure here shouldn't block the actual write it's describing, so callers
/// fire-and-forget this and it swallows its own errors. Mirrors
/// /web/lib/auditLog.ts.
void logActivity(String schoolId, User? actor, String action, String entity,
    String entityLabel) {
  if (schoolId.isEmpty || actor == null) return;
  () async {
    try {
      await FirebaseFirestore.instance
          .collection('schools/$schoolId/auditLog')
          .add({
        'action': action,
        'entity': entity,
        'entityLabel': entityLabel,
        'actorUid': actor.uid,
        'actorEmail': actor.email ?? '',
        'createdAt': FieldValue.serverTimestamp(),
      });
    } catch (_) {
      // Best-effort -- swallow. See doc comment above.
    }
  }();
}
