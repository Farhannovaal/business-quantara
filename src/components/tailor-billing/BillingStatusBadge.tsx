import type { BillStatus } from "@/lib/tailor-billing/types";

const STATUS_CONFIG: Record<BillStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-amber-950/40 text-amber-300 border border-amber-800/40" },
  SUBMITTED: { label: "Submitted", className: "bg-neutral-800 text-neutral-200 border border-white/10" },
  PAID: { label: "Paid", className: "bg-emerald-950/40 text-emerald-300 border border-emerald-800/40" },
  CANCELLED: { label: "Cancelled", className: "bg-rose-950/40 text-rose-300 border border-rose-800/40" },
};

export default function BillingStatusBadge({ status }: { status: BillStatus }) {
  const config = STATUS_CONFIG[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}>{config.label}</span>;
}
