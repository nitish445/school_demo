import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';
import '../../widgets/avatar.dart';
import '../../widgets/badge_chip.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

String _todayIso() => DateTime.now().toIso8601String().substring(0, 10);

String _formatTime(int? millis) {
  if (millis == null) return '—';
  return DateFormat('h:mm a')
      .format(DateTime.fromMillisecondsSinceEpoch(millis));
}

/// Mobile-only (no web equivalent yet): every teacher's GPS-tagged punch
/// in/out for a chosen day. Location is informational -- punching in never
/// blocked on distance from school, so this is where an admin actually
/// reviews it.
class AdminStaffAttendanceScreen extends StatefulWidget {
  const AdminStaffAttendanceScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  State<AdminStaffAttendanceScreen> createState() =>
      _AdminStaffAttendanceScreenState();
}

class _AdminStaffAttendanceScreenState
    extends State<AdminStaffAttendanceScreen> {
  String _date = _todayIso();

  @override
  Widget build(BuildContext context) {
    final outline = Theme.of(context).colorScheme.outline;
    return Scaffold(
      appBar: AppBar(title: const Text('Staff Attendance')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Text('Date',
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                TextButton.icon(
                  icon: const Icon(Icons.calendar_today_outlined, size: 16),
                  label: Text(_date),
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime.parse(_date),
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now(),
                    );
                    if (picked != null) {
                      setState(() =>
                          _date = picked.toIso8601String().substring(0, 10));
                    }
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: StreamBuilder<List<Teacher>>(
              stream: FirestoreService.collectionStream(
                'schools/${widget.schoolId}/teachers',
                Teacher.fromMap,
                build: (q) => q.where('status', isEqualTo: 'active'),
              ),
              builder: (context, teachersSnap) {
                final teachers = [...(teachersSnap.data ?? [])]
                  ..sort((a, b) => a.name.compareTo(b.name));

                return StreamBuilder<List<StaffAttendance>>(
                  stream: FirestoreService.collectionStream(
                    'schools/${widget.schoolId}/staffAttendance',
                    StaffAttendance.fromMap,
                    build: (q) => q.where('date', isEqualTo: _date),
                  ),
                  builder: (context, recordsSnap) {
                    if (teachersSnap.connectionState ==
                        ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    final records = recordsSnap.data ?? [];
                    if (teachers.isEmpty) {
                      return const Center(child: Text('No teachers found.'));
                    }
                    return ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      itemCount: teachers.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final t = teachers[i];
                        final record = _firstWhereOrNull(
                            records, (r) => r.teacherId == t.id);
                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Avatar(
                                    name: t.name,
                                    photoUrl: t.photoUrl,
                                    size: 40),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(t.name,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w600),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis),
                                      const SizedBox(height: 6),
                                      _PunchRow(
                                        label: 'In',
                                        time: _formatTime(record?.punchInAt),
                                        lat: record?.punchInLat,
                                        lng: record?.punchInLng,
                                        outline: outline,
                                      ),
                                      const SizedBox(height: 2),
                                      _PunchRow(
                                        label: 'Out',
                                        time: _formatTime(record?.punchOutAt),
                                        lat: record?.punchOutLat,
                                        lng: record?.punchOutLng,
                                        outline: outline,
                                      ),
                                    ],
                                  ),
                                ),
                                if (record?.punchInAt == null)
                                  const BadgeChip('Not punched in',
                                      variant: BadgeVariant.warning)
                                else if (record?.punchOutAt == null)
                                  const BadgeChip('On campus',
                                      variant: BadgeVariant.success),
                              ],
                            ),
                          ),
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _PunchRow extends StatelessWidget {
  const _PunchRow({
    required this.label,
    required this.time,
    required this.lat,
    required this.lng,
    required this.outline,
  });

  final String label;
  final String time;
  final double? lat;
  final double? lng;
  final Color outline;

  @override
  Widget build(BuildContext context) {
    final hasLocation = lat != null && lng != null;
    return Row(
      children: [
        Text('$label: $time', style: TextStyle(color: outline, fontSize: 13)),
        if (hasLocation) ...[
          const SizedBox(width: 6),
          InkWell(
            onTap: () => launchUrl(
              Uri.parse(
                  'https://www.google.com/maps/search/?api=1&query=$lat,$lng'),
              mode: LaunchMode.externalApplication,
            ),
            child: Icon(Icons.location_on,
                size: 15, color: Theme.of(context).colorScheme.primary),
          ),
        ],
      ],
    );
  }
}
