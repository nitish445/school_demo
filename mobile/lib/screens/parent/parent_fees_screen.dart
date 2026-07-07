import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';

class ParentFeesScreen extends StatelessWidget {
  const ParentFeesScreen(
      {super.key, required this.schoolId, required this.childId});

  final String schoolId;
  final String childId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fees')),
      body: StreamBuilder<FeeRecord?>(
        stream: FirestoreService.docStream(
            'schools/$schoolId/fees/$childId', FeeRecord.fromMap),
        builder: (context, feeSnap) {
          final fee = feeSnap.data;
          final totalDue = fee?.totalDue ?? 0;
          final totalPaid = fee?.totalPaid ?? 0;
          final pending = (totalDue - totalPaid).clamp(0, double.infinity);

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                      child: _FeeStat(label: 'Total Due', value: totalDue)),
                  const SizedBox(width: 12),
                  Expanded(child: _FeeStat(label: 'Paid', value: totalPaid)),
                  const SizedBox(width: 12),
                  Expanded(child: _FeeStat(label: 'Pending', value: pending)),
                ],
              ),
              if (pending > 0)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    "Online payment isn't set up yet — please pay through the school office "
                    'and it will be recorded here.',
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
              const SizedBox(height: 8),
              Text('Payment History',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              StreamBuilder<List<FeePayment>>(
                stream: FirestoreService.collectionStream(
                  'schools/$schoolId/fees/$childId/payments',
                  FeePayment.fromMap,
                ),
                builder: (context, snap) {
                  final payments = snap.data ?? [];
                  if (payments.isEmpty)
                    return const Text('No payments recorded yet.');
                  return Column(
                    children: payments
                        .map((p) => ListTile(
                              title: Text('₹${p.amount}'),
                              subtitle: Text(
                                  '${p.date} · ${p.mode} · ${p.receiptNo}'),
                            ))
                        .toList(),
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}

class _FeeStat extends StatelessWidget {
  const _FeeStat({required this.label, required this.value});

  final String label;
  final num value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            Text('₹${value.toStringAsFixed(0)}',
                style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      ),
    );
  }
}
