import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';

import 'firestore_service.dart';

/// A user-facing reason a punch in/out couldn't get a location, distinct
/// from a plain Exception so callers can show `message` directly instead of
/// a raw stack trace.
class LocationException implements Exception {
  LocationException(this.message);
  final String message;

  @override
  String toString() => message;
}

Future<Position> _currentPosition() async {
  if (!await Geolocator.isLocationServiceEnabled()) {
    throw LocationException(
        'Location services are turned off. Please enable them and try again.');
  }
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied) {
    throw LocationException('Location permission is required to punch in.');
  }
  if (permission == LocationPermission.deniedForever) {
    throw LocationException(
        'Location permission was permanently denied. Enable it from your phone Settings to punch in.');
  }
  return Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
  );
}

String todayIso() => DateTime.now().toIso8601String().substring(0, 10);

/// Logs a GPS-tagged punch in/out for today, once per day per teacher.
/// Location is recorded for the admin's reference only -- this never blocks
/// on distance from school (no geofence).
Future<void> punchIn(String schoolId, String teacherId) async {
  final position = await _currentPosition();
  await FirestoreService.doc(
          'schools/$schoolId/staffAttendance/${teacherId}_${todayIso()}')
      .set({
    'teacherId': teacherId,
    'date': todayIso(),
    'punchInAt': DateTime.now().millisecondsSinceEpoch,
    'punchInLat': position.latitude,
    'punchInLng': position.longitude,
  }, SetOptions(merge: true));
}

Future<void> punchOut(String schoolId, String teacherId) async {
  final position = await _currentPosition();
  await FirestoreService.doc(
          'schools/$schoolId/staffAttendance/${teacherId}_${todayIso()}')
      .set({
    'teacherId': teacherId,
    'date': todayIso(),
    'punchOutAt': DateTime.now().millisecondsSinceEpoch,
    'punchOutLat': position.latitude,
    'punchOutLng': position.longitude,
  }, SetOptions(merge: true));
}
