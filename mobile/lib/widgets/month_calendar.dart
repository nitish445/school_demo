import 'package:flutter/material.dart';

import '../models/models.dart';

const List<String> _dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const List<String> _monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const Map<CalendarEventType, Color> _typeColor = {
  CalendarEventType.holiday: Color(0xFFF43F5E),
  CalendarEventType.exam: Color(0xFFF59E0B),
  CalendarEventType.ptm: Color(0xFF0EA5E9),
  CalendarEventType.event: Color(0xFF10B981),
  CalendarEventType.other: Color(0xFFA8A29E),
};

String _isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Hand-rolled month grid (no calendar pub dependency -- see plan notes: this
/// environment can't run `flutter pub get`/analyze, so a new unverified
/// third-party package is riskier than this simple GridView).
class MonthCalendar extends StatefulWidget {
  const MonthCalendar({super.key, required this.events, this.holidays = const [], this.onDayTap});

  final List<CalendarEvent> events;
  final List<String> holidays;
  final void Function(String dateIso)? onDayTap;

  @override
  State<MonthCalendar> createState() => _MonthCalendarState();
}

class _MonthCalendarState extends State<MonthCalendar> {
  late DateTime _visibleMonth;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _visibleMonth = DateTime(now.year, now.month, 1);
  }

  void _changeMonth(int delta) {
    setState(() => _visibleMonth = DateTime(_visibleMonth.year, _visibleMonth.month + delta, 1));
  }

  @override
  Widget build(BuildContext context) {
    final startWeekday = DateTime(_visibleMonth.year, _visibleMonth.month, 1).weekday % 7; // Dart: Mon=1..Sun=7 -> Sun=0
    final gridStart = DateTime(_visibleMonth.year, _visibleMonth.month, 1 - startWeekday);
    final todayIso = _isoDate(DateTime.now());
    final holidaySet = widget.holidays.toSet();

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(icon: const Icon(Icons.chevron_left), onPressed: () => _changeMonth(-1)),
            Text(
              '${_monthNames[_visibleMonth.month - 1]} ${_visibleMonth.year}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            IconButton(icon: const Icon(Icons.chevron_right), onPressed: () => _changeMonth(1)),
          ],
        ),
        Row(
          children: _dayNames
              .map((d) => Expanded(child: Center(child: Text(d, style: Theme.of(context).textTheme.bodySmall))))
              .toList(),
        ),
        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: List.generate(42, (i) {
            final day = gridStart.add(Duration(days: i));
            final iso = _isoDate(day);
            final inMonth = day.month == _visibleMonth.month;
            final dayEvents = widget.events.where((e) => e.touchesDate(iso)).toList();
            final isHoliday = holidaySet.contains(iso);
            final isToday = iso == todayIso;

            return GestureDetector(
              onTap: () => widget.onDayTap?.call(iso),
              child: Container(
                margin: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: isHoliday ? const Color(0x14F43F5E) : null,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      alignment: Alignment.center,
                      decoration: isToday
                          ? const BoxDecoration(shape: BoxShape.circle, color: Colors.black87)
                          : null,
                      child: Text(
                        '${day.day}',
                        style: TextStyle(
                          fontSize: 12,
                          color: isToday
                              ? Colors.white
                              : inMonth
                                  ? null
                                  : Colors.grey,
                        ),
                      ),
                    ),
                    if (dayEvents.isNotEmpty)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: dayEvents
                            .take(3)
                            .map(
                              (e) => Container(
                                width: 4,
                                height: 4,
                                margin: const EdgeInsets.symmetric(horizontal: 1),
                                decoration: BoxDecoration(shape: BoxShape.circle, color: _typeColor[e.type]),
                              ),
                            )
                            .toList(),
                      ),
                  ],
                ),
              ),
            );
          }),
        ),
      ],
    );
  }
}
