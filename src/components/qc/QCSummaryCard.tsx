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
    <div className="rounded-2xl border border-[#353535] bg-[#151515] p-5 shadow-lg shadow-black/10 transition hover:border-red-900/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-100">
            {formatNumber(value)}
          </p>
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
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
