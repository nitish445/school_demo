import 'package:flutter/material.dart';

import '../../widgets/report_card_view.dart';

class ParentReportCardScreen extends StatelessWidget {
  const ParentReportCardScreen({super.key, required this.schoolId, required this.childId});

  final String schoolId;
  final String childId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report Card')),
      body: ReportCardView(schoolId: schoolId, studentId: childId),
    );
  }
}
