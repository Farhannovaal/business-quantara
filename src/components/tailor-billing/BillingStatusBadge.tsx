import type { BillStatus } from "@/lib/tailor-billing/types";

const STATUS_CONFIG: Record<BillStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-300",
  },
  SUBMITTED: {
    label: "Submitted",
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200",
  },
  PAID: {
    label: "Paid",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-300",
  },
  CANCELLED: {
    label: "Cancelled",
    className:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300",
  },
};

export default function BillingStatusBadge({
  status,
}: {
  status: BillStatus;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}
