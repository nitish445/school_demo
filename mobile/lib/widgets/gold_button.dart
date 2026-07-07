import 'package:flutter/material.dart';

import '../theme.dart';

/// The app's primary action button -- a gold gradient with dark text, a
/// warm-tinted shadow, and a thin light-gold ring. Mirrors
/// `primaryButtonClass` in /web/components/ui/formStyles.ts
/// (`bg-linear-to-b from-amber-400 to-amber-600 text-stone-900
/// shadow-amber-900/20 ring-amber-300/50`) -- a flat Material FilledButton
/// can't express a gradient fill via ThemeData, so this stands in for it
/// everywhere a primary "Save" / "Create" / "Post" action appears.
class GoldButton extends StatelessWidget {
  const GoldButton({super.key, required this.onPressed, required this.child});

  final VoidCallback? onPressed;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return Opacity(
      opacity: enabled ? 1 : 0.6,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFFBBF24), Color(0xFFD97706)],
          ),
          border: Border.all(color: const Color(0x80FCD34D)),
          boxShadow: enabled
              ? [
                  BoxShadow(
                    color: AppTheme.amber900.withValues(alpha: 0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: onPressed,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              child: Center(
                widthFactor: 1,
                child: DefaultTextStyle.merge(
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, color: AppTheme.amber900),
                  child: IconTheme.merge(
                    data: const IconThemeData(color: AppTheme.amber900),
                    child: child,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
