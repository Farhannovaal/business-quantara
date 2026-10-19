import {
  CheckCircle2,
  Clock3,
  ShieldCheck,
} from "lucide-react";

import type { QCStatus } from "@/lib/qc/types";

export function getStatusLabel(status: QCStatus) {
  switch (status) {
    case "WAITING":
      return "Menunggu QC";
    case "IN_PROGRESS":
      return "Sedang QC";
    case "COMPLETED":
      return "Selesai";
    default:
      return status;
  }
}

export default function QCStatusBadge({
  status,
}: {
  status: QCStatus;
}) {
  if (status === "WAITING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
        <Clock3 className="h-3.5 w-3.5" />
        Menunggu QC
      </span>
    );
  }

  if (status === "IN_PROGRESS") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300">
        <ShieldCheck className="h-3.5 w-3.5" />
        Sedang QC
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Selesai
    </span>
  );
}
