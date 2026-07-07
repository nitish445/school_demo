import 'package:flutter/material.dart';

/// The mobile app's visual identity, matching /web/app/globals.css and the
/// color tokens already hard-coded into BadgeChip/Avatar/ProfileHero/StatCard
/// (amber-gold accents, warm ivory page background, near-black stone text).
/// Centralizing it here as real component themes -- rather than leaving
/// every screen on the generic `colorSchemeSeed: Colors.indigo` Material
/// default -- is what makes the app read as one deliberate product instead
/// of a bunch of default widgets.
class AppTheme {
  AppTheme._();

  static const cream = Color(0xFFF2ECDD);
  static const stone900 = Color(0xFF1C1917);
  static const stone700 = Color(0xFF44403C);
  static const stone400 = Color(0xFFA8A29E);
  static const stone300 = Color(0xFFD6D3D1);
  static const stone200 = Color(0xFFE7E5E4);
  static const stone100 = Color(0xFFF5F5F4);
  static const stone50 = Color(0xFFFAFAF9);
  static const amber900 = Color(0xFF78350F);
  static const amber700 = Color(0xFFB45309);
  static const amber600 = Color(0xFFD97706);
  static const amber100 = Color(0xFFFEF3C7);
  static const emerald700 = Color(0xFF047857);
  static const rose700 = Color(0xFFBE123C);
  static const rose100 = Color(0xFFFFE4E6);

  static ThemeData get light {
    const colorScheme = ColorScheme.light(
      brightness: Brightness.light,
      primary: amber700,
      onPrimary: Colors.white,
      primaryContainer: amber100,
      onPrimaryContainer: amber900,
      secondary: stone700,
      onSecondary: Colors.white,
      secondaryContainer: stone100,
      onSecondaryContainer: stone900,
      tertiary: emerald700,
      onTertiary: Colors.white,
      error: rose700,
      onError: Colors.white,
      errorContainer: rose100,
      onErrorContainer: rose700,
      surface: Colors.white,
      onSurface: stone900,
      surfaceContainerHighest: stone100,
      onSurfaceVariant: stone700,
      outline: stone300,
      outlineVariant: stone200,
    );

    final base = ThemeData(
        colorScheme: colorScheme, useMaterial3: true, fontFamily: 'Roboto');

    return base.copyWith(
      scaffoldBackgroundColor: cream,
      splashFactory: InkSparkle.splashFactory,
      textTheme: base.textTheme.copyWith(
        headlineSmall: base.textTheme.headlineSmall?.copyWith(
          fontFamily: 'serif',
          fontWeight: FontWeight.w600,
          color: stone900,
        ),
        titleLarge: base.textTheme.titleLarge?.copyWith(
          fontFamily: 'serif',
          fontWeight: FontWeight.w600,
          color: stone900,
        ),
        titleMedium: base.textTheme.titleMedium
            ?.copyWith(fontWeight: FontWeight.w600, color: stone900),
        bodyMedium: base.textTheme.bodyMedium?.copyWith(color: stone900),
        bodySmall: base.textTheme.bodySmall?.copyWith(color: stone700),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: cream,
        foregroundColor: stone900,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: base.textTheme.titleLarge?.copyWith(
          fontFamily: 'serif',
          fontWeight: FontWeight.w600,
          color: stone900,
          fontSize: 22,
        ),
        iconTheme: const IconThemeData(color: stone700),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 3,
        shadowColor: amber900.withValues(alpha: 0.12),
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: stone200),
        ),
        margin: EdgeInsets.zero,
      ),
      dividerTheme:
          const DividerThemeData(color: stone200, thickness: 1, space: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: stone50,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: stone300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: stone300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: amber600, width: 1.6),
        ),
        labelStyle: const TextStyle(color: stone700),
        floatingLabelStyle: const TextStyle(color: amber700),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: amber700,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: stone700,
          side: const BorderSide(color: stone200),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.w500),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
            foregroundColor: amber700,
            textStyle: const TextStyle(fontWeight: FontWeight.w600)),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: amber700,
        foregroundColor: Colors.white,
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: stone100,
        selectedColor: amber100,
        labelStyle: const TextStyle(color: stone900),
        secondaryLabelStyle: const TextStyle(color: amber900),
        side: const BorderSide(color: stone200),
        shape: const StadiumBorder(),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: amber100,
        surfaceTintColor: Colors.transparent,
        elevation: 3,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? amber900 : stone400,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(color: selected ? amber900 : stone400);
        }),
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: amber700,
        unselectedLabelColor: stone400,
        indicatorColor: amber700,
        dividerColor: stone200,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.selected) ? amber700 : stone50,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.selected) ? amber100 : stone200,
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? amber700
              : Colors.transparent,
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: amber700),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: stone900,
        contentTextStyle: const TextStyle(color: Colors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
