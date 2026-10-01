import {
  CheckCircle2,
  Clock3,
  ShieldCheck,
} from "lucide-react";

import type { QCStatus } from "@/lib/qc/types";

export function getStatusLabel(
  status: QCStatus,
) {
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
        <Clock3 className="h-3.5 w-3.5" />
        Menunggu QC
      </span>
    );
  }

  if (status === "IN_PROGRESS") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
        <ShieldCheck className="h-3.5 w-3.5" />
        Sedang QC
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Selesai
    </span>
  );
}