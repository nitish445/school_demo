import 'package:flutter/material.dart';

enum StatCardTint { gold, emerald, amber, sky }

const Map<StatCardTint, List<Color>> _tintColors = {
  StatCardTint.gold: [Color(0xFFFCD34D), Color(0xFFD97706)],
  StatCardTint.emerald: [Color(0xFFD1FAE5), Color(0xFF34D399)],
  StatCardTint.amber: [Color(0xFFFEF3C7), Color(0xFFF59E0B)],
  StatCardTint.sky: [Color(0xFFE0F2FE), Color(0xFF38BDF8)],
};

const Map<StatCardTint, Color> _iconColors = {
  StatCardTint.gold: Color(0xFF78350F),
  StatCardTint.emerald: Color(0xFF047857),
  StatCardTint.amber: Color(0xFFB45309),
  StatCardTint.sky: Color(0xFF0369A1),
};

/// Mirrors /web/components/ui/StatCard.tsx: a small icon tile, a label, and
/// a value -- used for the at-a-glance numbers on the admin dashboard.
class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.tint = StatCardTint.gold,
  });

  final String label;
  final String value;
  final IconData icon;
  final StatCardTint tint;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(9),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: _tintColors[tint]!,
              ),
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 16, color: _iconColors[tint]),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Theme.of(context).colorScheme.outline,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.3,
                        fontSize: 10,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
