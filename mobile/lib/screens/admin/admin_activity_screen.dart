import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';
import '../../widgets/badge_chip.dart';

const Map<String, BadgeVariant> _actionVariant = {
  'create': BadgeVariant.success,
  'update': BadgeVariant.info,
  'delete': BadgeVariant.danger,
};

/// Mirrors /web/app/admin/activity/page.tsx: the last 300 audit-log entries,
/// filterable by entity type.
class AdminActivityScreen extends StatefulWidget {
  const AdminActivityScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  State<AdminActivityScreen> createState() => _AdminActivityScreenState();
}

class _AdminActivityScreenState extends State<AdminActivityScreen> {
  String _entityFilter = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Activity Log')),
      body: StreamBuilder<List<AuditLogEntry>>(
        stream: FirestoreService.collectionStream(
          'schools/${widget.schoolId}/auditLog',
          AuditLogEntry.fromMap,
          build: (q) => q.orderBy('createdAt', descending: true).limit(300),
        ),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final entries = snap.data ?? [];
          final entityOptions = entries.map((e) => e.entity).toSet().toList()
            ..sort();
          final filtered = _entityFilter.isEmpty
              ? entries
              : entries.where((e) => e.entity == _entityFilter).toList();

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: const Text('All types'),
                          selected: _entityFilter.isEmpty,
                          onSelected: (_) => setState(() => _entityFilter = ''),
                        ),
                      ),
                      for (final entity in entityOptions)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(entity),
                            selected: _entityFilter == entity,
                            onSelected: (_) =>
                                setState(() => _entityFilter = entity),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? const Center(child: Text('No activity recorded yet.'))
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final e = filtered[i];
                          return Card(
                            child: ListTile(
                              title: Text(e.entityLabel),
                              subtitle: Text(
                                '${e.actorEmail.isNotEmpty ? e.actorEmail : e.actorUid}'
                                '${e.createdAt != null ? ' · ${e.createdAt!.toLocal()}' : ' · just now'}',
                              ),
                              trailing: Wrap(
                                spacing: 6,
                                children: [
                                  BadgeChip(e.entity,
                                      variant: BadgeVariant.neutral),
                                  BadgeChip(e.action,
                                      variant: _actionVariant[e.action] ??
                                          BadgeVariant.neutral),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
