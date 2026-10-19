import type { ReactNode } from "react";
import { CircleDollarSign, FileText, Send, X } from "lucide-react";

type Summary = {
  total: number;
  draft: number;
  submitted: number;
  paid: number;
  cancelled: number;
};

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground">
        {value.toLocaleString("id-ID")}
      </div>
    </div>
  );
}

export default function BillingSummaryCards({
  summary,
}: {
  summary: Summary;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
      <SummaryCard
        label="Total Tagihan"
        value={summary.total}
        icon={<FileText className="h-5 w-5" />}
      />
      <SummaryCard
        label="Draft"
        value={summary.draft}
        icon={<FileText className="h-5 w-5" />}
      />
      <SummaryCard
        label="Submitted"
        value={summary.submitted}
        icon={<Send className="h-5 w-5" />}
      />
      <SummaryCard
        label="Paid"
        value={summary.paid}
        icon={<CircleDollarSign className="h-5 w-5" />}
      />
      <SummaryCard
        label="Cancelled"
        value={summary.cancelled}
        icon={<X className="h-5 w-5" />}
      />
    </div>
  );
}
