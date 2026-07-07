import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';
import '../../widgets/badge_chip.dart';
import '../../widgets/month_calendar.dart';

const Map<CalendarEventType, String> _typeLabel = {
  CalendarEventType.holiday: 'Holiday',
  CalendarEventType.exam: 'Exam',
  CalendarEventType.ptm: 'PTM',
  CalendarEventType.event: 'Event',
  CalendarEventType.other: 'Other',
};

const Map<CalendarEventType, BadgeVariant> _typeVariant = {
  CalendarEventType.holiday: BadgeVariant.danger,
  CalendarEventType.exam: BadgeVariant.warning,
  CalendarEventType.ptm: BadgeVariant.info,
  CalendarEventType.event: BadgeVariant.success,
  CalendarEventType.other: BadgeVariant.neutral,
};

class TeacherCalendarScreen extends StatelessWidget {
  const TeacherCalendarScreen({super.key, required this.schoolId});

  final String schoolId;

  void _showDay(
      BuildContext context, String dateIso, List<CalendarEvent> events) {
    final dayEvents = events.where((e) => e.touchesDate(dateIso)).toList();
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(dateIso, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              if (dayEvents.isEmpty) const Text('No events on this day.'),
              for (final e in dayEvents)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(e.title,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                            if (e.description != null) Text(e.description!),
                          ],
                        ),
                      ),
                      BadgeChip(_typeLabel[e.type]!,
                          variant: _typeVariant[e.type]!),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Calendar')),
      body: StreamBuilder<School?>(
        stream: FirestoreService.docStream('schools/$schoolId', School.fromMap),
        builder: (context, schoolSnap) {
          final holidays = schoolSnap.data?.holidays ?? const [];
          return StreamBuilder<List<CalendarEvent>>(
            stream: FirestoreService.collectionStream(
                'schools/$schoolId/events', CalendarEvent.fromMap),
            builder: (context, snap) {
              final events = snap.data ?? [];
              return Padding(
                padding: const EdgeInsets.all(16),
                child: MonthCalendar(
                  events: events,
                  holidays: holidays,
                  onDayTap: (iso) => _showDay(context, iso, events),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
