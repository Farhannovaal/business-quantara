"use client";

import { Search } from "lucide-react";
import type { BillStatus, Tailor } from "@/lib/tailor-billing/types";

type Props = {
  search: string;
  statusFilter: BillStatus | "ALL";
  tailorFilter: number | "ALL";
  tailors: Tailor[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: BillStatus | "ALL") => void;
  onTailorChange: (value: number | "ALL") => void;
  onSearch: () => void;
};

const controlClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-rose-400 focus:ring-2 focus:ring-rose-500/15";

export default function BillingFilters({
  search,
  statusFilter,
  tailorFilter,
  tailors,
  onSearchChange,
  onStatusChange,
  onTailorChange,
  onSearch,
}: Props) {
  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_200px_240px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
            placeholder="Cari nomor tagihan atau penjahit..."
            aria-label="Cari nomor tagihan atau penjahit"
            className={`${controlClass} pl-10 pr-3`}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            onStatusChange(event.target.value as BillStatus | "ALL")
          }
          aria-label="Filter status tagihan"
          className={controlClass}
        >
          <option value="ALL">Semua Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          value={tailorFilter}
          onChange={(event) =>
            onTailorChange(
              event.target.value === "ALL" ? "ALL" : Number(event.target.value),
            )
          }
          aria-label="Filter penjahit"
          className={controlClass}
        >
          <option value="ALL">Semua Penjahit</option>
          {tailors.map((tailor) => (
            <option key={tailor.id} value={tailor.id}>
              {tailor.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onSearch}
          className="h-10 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Cari
        </button>
      </div>
    </div>
  );
}
