"use client";

import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useDoc } from "@/hooks/useDoc";
import { useCollection } from "@/hooks/useCollection";
import type { FeeRecord, FeePayment } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";

export default function ParentFeesPage() {
  const schoolId = useSchoolId();
  const { effectiveChildId, childStudentIds } = useEffectiveChildId();

  const { data: fee, loading: loadingFee } = useDoc<FeeRecord>(
    schoolId && effectiveChildId ? `schools/${schoolId}/fees/${effectiveChildId}` : null
  );
  const { data: payments, loading: loadingPayments } = useCollection<FeePayment>(
    schoolId && effectiveChildId ? `schools/${schoolId}/fees/${effectiveChildId}/payments` : null
  );

  if (childStudentIds.length === 0) {
    return <p className="text-sm text-stone-500">No children are linked to your account yet.</p>;
  }

  const totalDue = fee?.totalDue ?? 0;
  const totalPaid = fee?.totalPaid ?? 0;
  const pending = Math.max(0, totalDue - totalPaid);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Fees</h1>

      {loadingFee ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-stone-500">Total Due</p>
            <p className="mt-1 text-lg font-semibold text-stone-900">₹{totalDue.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-stone-500">Total Paid</p>
            <p className="mt-1 text-lg font-semibold text-stone-900">₹{totalPaid.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-stone-500">Pending</p>
            <p className="mt-1 text-lg font-semibold text-stone-900">₹{pending.toLocaleString()}</p>
          </div>
        </div>
      )}

      {pending > 0 && (
        <p className="mb-6 text-sm text-stone-500">
          Online payment isn&apos;t set up yet — please pay through the school office and it will be
          recorded here.
        </p>
      )}

      <h2 className="mb-2 text-sm font-semibold text-stone-900">Payment History</h2>
      {loadingPayments ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <DataTable
          rows={payments}
          emptyMessage="No payments recorded yet."
          columns={[
            { header: "Date", render: (p) => p.date },
            { header: "Amount", render: (p) => `₹${p.amount.toLocaleString()}` },
            { header: "Mode", render: (p) => p.mode },
            { header: "Receipt No.", render: (p) => p.receiptNo },
          ]}
        />
      )}
    </div>
  );
}
