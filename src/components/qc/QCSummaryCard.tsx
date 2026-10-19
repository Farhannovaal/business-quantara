import type { LucideIcon } from "lucide-react";

import { formatNumber } from "@/lib/qc/utils";

type Props = {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  iconClassName: string;
};

export default function QCSummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-rose-200 dark:hover:border-rose-900/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {formatNumber(value)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
