import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/audit_log_service.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/gold_button.dart';

/// Mirrors /web/app/admin/announcements/page.tsx: post and delete
/// school-wide announcements.
class AdminAnnouncementsScreen extends StatelessWidget {
  const AdminAnnouncementsScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Announcements')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          builder: (context) => _AnnouncementForm(schoolId: schoolId),
        ),
        icon: const Icon(Icons.add),
        label: const Text('New Announcement'),
      ),
      body: StreamBuilder<List<Announcement>>(
        stream: FirestoreService.collectionStream(
          'schools/$schoolId/announcements',
          Announcement.fromMap,
          build: (q) => q.orderBy('createdAt', descending: true),
        ),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = snap.data ?? [];
          if (items.isEmpty)
            return const Center(child: Text('No announcements yet.'));

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final a = items[i];
              final posted = DateTime.fromMillisecondsSinceEpoch(a.createdAt);
              return Card(
                child: ListTile(
                  title: Text(a.title),
                  subtitle: Text('${a.body}\n${posted.toLocal()}'.trim()),
                  isThreeLine: true,
                  trailing: IconButton(
                    icon:
                        Icon(Icons.delete_outline, color: Colors.red.shade700),
                    onPressed: () async {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Delete announcement?'),
                          content: Text(
                              '"${a.title}" will be removed for everyone.'),
                          actions: [
                            TextButton(
                                onPressed: () => Navigator.pop(context, false),
                                child: const Text('Cancel')),
                            GoldButton(
                                onPressed: () => Navigator.pop(context, true),
                                child: const Text('Delete')),
                          ],
                        ),
                      );
                      if (confirmed != true || !context.mounted) return;
                      final auth = context.read<AuthService>();
                      await FirestoreService.doc(
                              'schools/$schoolId/announcements/${a.id}')
                          .delete();
                      logActivity(schoolId, auth.user, 'delete', 'Announcement',
                          a.title);
                    },
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _AnnouncementForm extends StatefulWidget {
  const _AnnouncementForm({required this.schoolId});

  final String schoolId;

  @override
  State<_AnnouncementForm> createState() => _AnnouncementFormState();
}

class _AnnouncementFormState extends State<_AnnouncementForm> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  bool _submitting = false;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('New Announcement',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(
                controller: _title,
                decoration: const InputDecoration(labelText: 'Title')),
            const SizedBox(height: 12),
            TextField(
              controller: _body,
              decoration: const InputDecoration(labelText: 'Message'),
              maxLines: 4,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: GoldButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? 'Posting...' : 'Post'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final title = _title.text.trim();
    final body = _body.text.trim();
    if (title.isEmpty || body.isEmpty) return;
    setState(() => _submitting = true);
    final auth = context.read<AuthService>();
    try {
      await FirestoreService.collection(
              'schools/${widget.schoolId}/announcements')
          .add({
        'title': title,
        'body': body,
        'audience': 'all',
        'createdBy': auth.user?.uid,
        'createdAt': DateTime.now().millisecondsSinceEpoch,
      });
      logActivity(widget.schoolId, auth.user, 'create', 'Announcement', title);
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
