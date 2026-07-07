import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/audit_log_service.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/gold_button.dart';

const List<String> _paymentModes = ['cash', 'cheque', 'online', 'other'];

/// Mirrors /web/app/admin/fees/page.tsx: set a student's total due and
/// record payments against it.
class AdminFeesScreen extends StatelessWidget {
  const AdminFeesScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fees')),
      body: StreamBuilder<List<Student>>(
        stream: FirestoreService.collectionStream(
            'schools/$schoolId/students', Student.fromMap),
        builder: (context, studentsSnap) {
          final students = (studentsSnap.data ?? [])
              .where((s) => s.status == 'active')
              .toList()
            ..sort((a, b) => a.name.compareTo(b.name));

          return StreamBuilder<List<FeeRecord>>(
            stream: FirestoreService.collectionStream(
                'schools/$schoolId/fees', FeeRecord.fromMap),
            builder: (context, feesSnap) {
              final fees = feesSnap.data ?? [];
              final rows = students.map((s) {
                final fee = fees.where((f) => f.id == s.id).firstOrNull;
                return (
                  id: s.id,
                  name: s.name,
                  totalDue: fee?.totalDue ?? 0,
                  totalPaid: fee?.totalPaid ?? 0,
                );
              }).toList();
              final totalPending = rows.fold<num>(
                  0,
                  (sum, r) =>
                      sum +
                      (r.totalDue - r.totalPaid).clamp(0, double.infinity));

              if (studentsSnap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                            'Total pending: ₹${totalPending.toStringAsFixed(0)}',
                            style: Theme.of(context).textTheme.bodyMedium),
                      ],
                    ),
                  ),
                  Expanded(
                    child: rows.isEmpty
                        ? const Center(child: Text('No active students yet.'))
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: rows.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, i) {
                              final r = rows[i];
                              final pending = (r.totalDue - r.totalPaid)
                                  .clamp(0, double.infinity);
                              return Card(
                                child: ListTile(
                                  title: Text(r.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis),
                                  subtitle: Text(
                                    'Due ₹${r.totalDue} · Paid ₹${r.totalPaid} · Pending ₹${pending.toStringAsFixed(0)}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  trailing: PopupMenuButton<String>(
                                    onSelected: (action) {
                                      if (action == 'due') {
                                        showModalBottomSheet(
                                          context: context,
                                          isScrollControlled: true,
                                          builder: (context) => _SetDueForm(
                                              schoolId: schoolId,
                                              studentId: r.id,
                                              studentName: r.name,
                                              currentDue: r.totalDue),
                                        );
                                      } else {
                                        showModalBottomSheet(
                                          context: context,
                                          isScrollControlled: true,
                                          builder: (context) =>
                                              _RecordPaymentForm(
                                                  schoolId: schoolId,
                                                  studentId: r.id,
                                                  studentName: r.name),
                                        );
                                      }
                                    },
                                    itemBuilder: (context) => const [
                                      PopupMenuItem(
                                          value: 'due', child: Text('Set Fee')),
                                      PopupMenuItem(
                                          value: 'pay',
                                          child: Text('Record Payment')),
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
          );
        },
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

class _SetDueForm extends StatefulWidget {
  const _SetDueForm(
      {required this.schoolId,
      required this.studentId,
      required this.studentName,
      required this.currentDue});

  final String schoolId;
  final String studentId;
  final String studentName;
  final num currentDue;

  @override
  State<_SetDueForm> createState() => _SetDueFormState();
}

class _SetDueFormState extends State<_SetDueForm> {
  late final _amount =
      TextEditingController(text: widget.currentDue.toString());
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
            Text('Set Fee — ${widget.studentName}',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(
              controller: _amount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Total Due (₹)'),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: GoldButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? 'Saving...' : 'Save'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final due = num.tryParse(_amount.text.trim());
    if (due == null) return;
    setState(() => _submitting = true);
    final auth = context.read<AuthService>();
    try {
      await FirestoreService.doc(
              'schools/${widget.schoolId}/fees/${widget.studentId}')
          .set({'totalDue': due, 'totalPaid': 0}, SetOptions(merge: true));
      logActivity(widget.schoolId, auth.user, 'update', 'Fee',
          '${widget.studentName} — due set to ₹$due');
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

class _RecordPaymentForm extends StatefulWidget {
  const _RecordPaymentForm(
      {required this.schoolId,
      required this.studentId,
      required this.studentName});

  final String schoolId;
  final String studentId;
  final String studentName;

  @override
  State<_RecordPaymentForm> createState() => _RecordPaymentFormState();
}

class _RecordPaymentFormState extends State<_RecordPaymentForm> {
  final _amount = TextEditingController();
  String _mode = 'cash';
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
            Text('Record Payment — ${widget.studentName}',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(
              controller: _amount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Amount (₹)'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              isExpanded: true,
              value: _mode,
              decoration: const InputDecoration(labelText: 'Mode'),
              items: _paymentModes
                  .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                  .toList(),
              onChanged: (v) => setState(() => _mode = v ?? 'cash'),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: GoldButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? 'Saving...' : 'Save'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final amount = num.tryParse(_amount.text.trim());
    if (amount == null || amount <= 0) return;
    setState(() => _submitting = true);
    final auth = context.read<AuthService>();
    try {
      final receiptNo = 'RCPT-${DateTime.now().millisecondsSinceEpoch}';
      await FirestoreService.collection(
              'schools/${widget.schoolId}/fees/${widget.studentId}/payments')
          .add({
        'amount': amount,
        'date': DateTime.now().toIso8601String().substring(0, 10),
        'mode': _mode,
        'receiptNo': receiptNo,
      });
      await FirestoreService.doc(
              'schools/${widget.schoolId}/fees/${widget.studentId}')
          .set({'totalPaid': FieldValue.increment(amount)},
              SetOptions(merge: true));
      logActivity(widget.schoolId, auth.user, 'create', 'Fee Payment',
          '${widget.studentName} — ₹$amount ($_mode)');
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
