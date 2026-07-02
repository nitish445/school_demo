import 'package:cloud_firestore/cloud_firestore.dart';

/// Small helpers around cloud_firestore so screens don't repeat the same
/// "snapshot -> list of typed models" boilerplate. Mirrors the pattern in
/// /web/hooks/useCollection.ts and useDoc.ts.
class FirestoreService {
  static final _db = FirebaseFirestore.instance;

  static Stream<List<T>> collectionStream<T>(
    String path,
    T Function(String id, Map<String, dynamic> data) fromMap, {
    Query<Map<String, dynamic>> Function(Query<Map<String, dynamic>>)? build,
  }) {
    Query<Map<String, dynamic>> query = _db.collection(path);
    if (build != null) query = build(query);
    return query.snapshots().map(
          (snap) => snap.docs.map((d) => fromMap(d.id, d.data())).toList(),
        );
  }

  static Stream<T?> docStream<T>(
    String path,
    T Function(String id, Map<String, dynamic> data) fromMap,
  ) {
    return _db.doc(path).snapshots().map(
          (snap) => snap.exists ? fromMap(snap.id, snap.data()!) : null,
        );
  }

  static CollectionReference<Map<String, dynamic>> collection(String path) => _db.collection(path);

  static DocumentReference<Map<String, dynamic>> doc(String path) => _db.doc(path);

  static WriteBatch batch() => _db.batch();
}
