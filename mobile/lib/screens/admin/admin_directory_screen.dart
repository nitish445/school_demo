import 'package:flutter/material.dart';

import 'admin_classes_tab.dart';
import 'admin_parents_tab.dart';
import 'admin_students_tab.dart';
import 'admin_subjects_tab.dart';
import 'admin_teachers_tab.dart';

/// People & academic structure, in one place with full CRUD: Students,
/// Teachers, Parents, Classes, Subjects. Mirrors the corresponding pages
/// under /web/app/admin, minus CSV bulk import (a desktop workflow) and
/// PDF report-card export.
class AdminDirectoryScreen extends StatefulWidget {
  const AdminDirectoryScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  State<AdminDirectoryScreen> createState() => _AdminDirectoryScreenState();
}

class _AdminDirectoryScreenState extends State<AdminDirectoryScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Directory'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: const [
            Tab(text: 'Students'),
            Tab(text: 'Teachers'),
            Tab(text: 'Parents'),
            Tab(text: 'Classes'),
            Tab(text: 'Subjects'),
          ],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search by name',
                isDense: true,
              ),
              onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                AdminStudentsTab(schoolId: widget.schoolId, query: _query),
                AdminTeachersTab(schoolId: widget.schoolId, query: _query),
                AdminParentsTab(schoolId: widget.schoolId, query: _query),
                AdminClassesTab(schoolId: widget.schoolId, query: _query),
                AdminSubjectsTab(schoolId: widget.schoolId, query: _query),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
