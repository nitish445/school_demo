import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../services/schedule_utils.dart';
import '../../services/staff_attendance_service.dart';
import '../../widgets/avatar.dart';
import '../../widgets/badge_chip.dart';
import '../../widgets/gold_button.dart';

class TeacherDashboardScreen extends StatelessWidget {
  const TeacherDashboardScreen({
    super.key,
    required this.schoolId,
    required this.teacher,
    required this.classIds,
  });

  final String schoolId;
  final Teacher teacher;
  final List<String> classIds;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final outline = Theme.of(context).colorScheme.outline;

    return Scaffold(
      appBar: AppBar(
        title:
            Text(teacher.classTeacherOf != null ? 'Class Teacher' : 'Teacher'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => auth.signOut(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Avatar(
                      name: teacher.name, photoUrl: teacher.photoUrl, size: 52),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(teacher.name,
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 2),
                        Text(
                          auth.user?.email ?? '',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: outline),
                        ),
                        const SizedBox(height: 6),
                        BadgeChip(
                          teacher.classTeacherOf != null
                              ? 'Class Teacher'
                              : 'Subject Teacher',
                          variant: BadgeVariant.brand,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _PunchCard(schoolId: schoolId, teacherId: teacher.id),
          const SizedBox(height: 16),
          _RightNowCard(
              schoolId: schoolId, teacher: teacher, classIds: classIds),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.school_outlined, size: 18, color: outline),
                      const SizedBox(width: 8),
                      Text('Your Classes',
                          style: Theme.of(context).textTheme.titleMedium),
                    ],
                  ),
                  const SizedBox(height: 12),
                  StreamBuilder<List<SchoolClass>>(
                    stream: FirestoreService.collectionStream(
                      'schools/$schoolId/classes',
                      SchoolClass.fromMap,
                    ),
                    builder: (context, snapshot) {
                      final all = snapshot.data ?? [];
                      final mine =
                          all.where((c) => classIds.contains(c.id)).toList();
                      if (mine.isEmpty) {
                        return const Text('No classes assigned yet.');
                      }
                      return Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: mine
                            .map((c) =>
                                BadgeChip(c.label, variant: BadgeVariant.brand))
                            .toList(),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.campaign_outlined, size: 18, color: outline),
                      const SizedBox(width: 8),
                      Text('Latest Announcements',
                          style: Theme.of(context).textTheme.titleMedium),
                    ],
                  ),
                  const SizedBox(height: 8),
                  StreamBuilder<List<Announcement>>(
                    stream: FirestoreService.collectionStream(
                      'schools/$schoolId/announcements',
                      Announcement.fromMap,
                      build: (q) =>
                          q.orderBy('createdAt', descending: true).limit(5),
                    ),
                    builder: (context, snapshot) {
                      final items = snapshot.data ?? [];
                      if (items.isEmpty) {
                        return const Text('No announcements yet.');
                      }
                      return Column(
                        children: [
                          for (var i = 0; i < items.length; i++) ...[
                            if (i > 0) const Divider(height: 17),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  margin: const EdgeInsets.only(top: 6),
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: Color(0xFFD97706)),
                                ),
                                const SizedBox(width: 10),
                                Expanded(child: Text(items[i].title)),
                              ],
                            ),
                          ],
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Shows what the teacher is teaching at this exact moment, derived purely
/// from their merged timetable (schedule_utils.currentPeriod) -- no extra
/// backend state, just "is now between some period's start and end time".
class _RightNowCard extends StatelessWidget {
  const _RightNowCard({
    required this.schoolId,
    required this.teacher,
    required this.classIds,
  });

  final String schoolId;
  final Teacher teacher;
  final List<String> classIds;

  @override
  Widget build(BuildContext context) {
    final outline = Theme.of(context).colorScheme.outline;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: StreamBuilder<List<SchoolClass>>(
          stream: FirestoreService.collectionStream(
              'schools/$schoolId/classes', SchoolClass.fromMap),
          builder: (context, classesSnap) {
            final myClasses = (classesSnap.data ?? [])
                .where((c) => classIds.contains(c.id))
                .toList();
            return StreamBuilder<List<Subject>>(
              stream: FirestoreService.collectionStream(
                  'schools/$schoolId/subjects', Subject.fromMap),
              builder: (context, subjectsSnap) {
                final subjects = subjectsSnap.data ?? [];
                return StreamBuilder<List<Timetable>>(
                  stream: classIds.isEmpty
                      ? Stream<List<Timetable>>.value(const [])
                      : FirestoreService.collectionStream(
                          'schools/$schoolId/timetables',
                          Timetable.fromMap,
                          build: (q) => q.where(FieldPath.documentId,
                              whereIn: classIds.take(10).toList()),
                        ),
                  builder: (context, ttSnap) {
                    final periods = myMergedPeriods(
                      myClasses: myClasses,
                      teacher: teacher,
                      timetables: ttSnap.data ?? [],
                      subjects: subjects,
                    );
                    final ongoing = currentPeriod(periods, DateTime.now());
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.play_circle_outline,
                            size: 18, color: outline),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Right Now',
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 4),
                              Text(
                                ongoing != null
                                    ? '${ongoing.label ?? 'Class'}'
                                        '${ongoing.startTime != null ? ' · ${ongoing.startTime}–${ongoing.endTime}' : ''}'
                                    : 'No class right now',
                              ),
                            ],
                          ),
                        ),
                      ],
                    );
                  },
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// Once-a-day GPS-tagged punch in/out. Location is logged for the admin's
/// reference only -- this never blocks on distance from school.
class _PunchCard extends StatefulWidget {
  const _PunchCard({required this.schoolId, required this.teacherId});

  final String schoolId;
  final String teacherId;

  @override
  State<_PunchCard> createState() => _PunchCardState();
}

class _PunchCardState extends State<_PunchCard> {
  bool _working = false;
  String? _error;

  Future<void> _handlePunch(bool isPunchIn) async {
    setState(() {
      _working = true;
      _error = null;
    });
    try {
      if (isPunchIn) {
        await punchIn(widget.schoolId, widget.teacherId);
      } else {
        await punchOut(widget.schoolId, widget.teacherId);
      }
    } catch (e) {
      setState(() {
        _error = e is LocationException
            ? e.message
            : 'Could not record your location. Please try again.';
      });
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  String _formatTime(int millis) =>
      DateFormat('h:mm a').format(DateTime.fromMillisecondsSinceEpoch(millis));

  @override
  Widget build(BuildContext context) {
    final outline = Theme.of(context).colorScheme.outline;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: StreamBuilder<StaffAttendance?>(
          stream: FirestoreService.docStream(
            'schools/${widget.schoolId}/staffAttendance/${widget.teacherId}_${todayIso()}',
            StaffAttendance.fromMap,
          ),
          builder: (context, snap) {
            final record = snap.data;
            final punchedIn = record?.punchInAt != null;
            final punchedOut = record?.punchOutAt != null;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.location_on_outlined, size: 18, color: outline),
                    const SizedBox(width: 8),
                    Text('Attendance',
                        style: Theme.of(context).textTheme.titleMedium),
                  ],
                ),
                if (punchedIn || punchedOut) const SizedBox(height: 8),
                if (punchedIn)
                  Text(
                    'Punched in at ${_formatTime(record!.punchInAt!)}',
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: outline),
                  ),
                if (punchedOut)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      'Punched out at ${_formatTime(record!.punchOutAt!)}',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: outline),
                    ),
                  ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(_error!,
                        style: TextStyle(
                            color: Colors.red.shade700, fontSize: 13)),
                  ),
                const SizedBox(height: 12),
                if (punchedIn && punchedOut)
                  Row(
                    children: [
                      Icon(Icons.check_circle_outline,
                          size: 18,
                          color: Theme.of(context).colorScheme.tertiary),
                      const SizedBox(width: 6),
                      const Text('Done for today'),
                    ],
                  )
                else if (punchedIn)
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _working ? null : () => _handlePunch(false),
                      child:
                          Text(_working ? 'Getting location...' : 'Punch Out'),
                    ),
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    child: GoldButton(
                      onPressed: _working ? null : () => _handlePunch(true),
                      child:
                          Text(_working ? 'Getting location...' : 'Punch In'),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
