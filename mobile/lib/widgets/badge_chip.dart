import 'package:flutter/material.dart';

enum BadgeVariant { success, warning, danger, info, brand, neutral }

const Map<BadgeVariant, Color> _bg = {
  BadgeVariant.success: Color(0xFFD1FAE5),
  BadgeVariant.warning: Color(0xFFFEF3C7),
  BadgeVariant.danger: Color(0xFFFFE4E6),
  BadgeVariant.info: Color(0xFFE0F2FE),
  BadgeVariant.brand: Color(0xFFFEF3C7),
  BadgeVariant.neutral: Color(0xFFF5F5F4),
};

const Map<BadgeVariant, Color> _fg = {
  BadgeVariant.success: Color(0xFF047857),
  BadgeVariant.warning: Color(0xFFB45309),
  BadgeVariant.danger: Color(0xFFBE123C),
  BadgeVariant.info: Color(0xFF0369A1),
  BadgeVariant.brand: Color(0xFF78350F),
  BadgeVariant.neutral: Color(0xFF57534E),
};

/// Named BadgeChip (not Badge) to avoid colliding with Flutter's own
/// material Badge widget. Mirrors /web/components/ui/Badge.tsx.
class BadgeChip extends StatelessWidget {
  const BadgeChip(this.label, {super.key, this.variant = BadgeVariant.neutral});

  final String label;
  final BadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: _bg[variant], borderRadius: BorderRadius.circular(999)),
      child: Text(
        label,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _fg[variant]),
      ),
    );
  }
}
