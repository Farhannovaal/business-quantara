
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Loader2,
  RefreshCw,
  Scissors,
  Search,
  TrendingUp,
} from "lucide-react";

type IncomeSummary = {
  totalIncome: number;
  totalPaidBills: number;
  totalTailors: number;
  totalQuantity: number;
  totalSpk: number;
};

type TailorIncome = {
  tailorId: number;
  tailorName: string;
  totalIncome: number;
  totalPaidBills: number;
  totalQuantity: number;
  totalSpk: number;
};

type IncomeDetail = {
  id: number;
  billId: number;
  billNumber: string;
  paidAt: string | null;
  tailorId: number;
  tailorName: string;
  spkId: number;
  spkNumber: string;
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  rate: number;
  amount: number;
};

type DashboardResponse = {
  success: boolean;
  error?: string;
  summary: IncomeSummary;
  monthly: Array<{
    month: string;
    amount: number;
  }>;
  tailors: TailorIncome[];
  details: IncomeDetail[];
};

function dateInput(date: Date) {
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return local.toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");

  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "2-digit",
  }).format(
    new Date(Number(year), Number(month) - 1, 1),
  );
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "IDR",
  }).format(value);
}

export default function TailorIncomeDashboard() {
  const today = useMemo(() => new Date(), []);

  const [startDate, setStartDate] = useState(
    dateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
  );
  const [endDate, setEndDate] = useState(dateInput(today));
  const [tailorFilter, setTailorFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        startDate,
        endDate,
      });

      if (tailorFilter !== "ALL") {
        params.set("tailorId", tailorFilter);
      }

      const response = await fetch(
        `/api/tailor-billing/income/dashboard?${params.toString()}`,
        { cache: "no-store" },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Gagal mengambil dashboard pendapatan.",
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil data.",
      );
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, tailorFilter]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const visibleDetails = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!data) return [];
    if (!query) return data.details;

    return data.details.filter((item) =>
      [
        item.tailorName,
        item.spkNumber,
        item.productCode,
        item.productName,
        item.billNumber,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [data, search]);

  const maxMonthly = Math.max(
    1,
    ...(data?.monthly.map((item) => item.amount) ?? []),
  );

  const maxTailor = Math.max(
    1,
    ...(data?.tailors.map((item) => item.totalIncome) ?? []),
  );

  return (
    <main className="text-neutral-100">
      <div className="mx-auto max-w-[1600px] py-2">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-neutral-400">
              <CircleDollarSign className="h-4 w-4" />
              Tailor Billing <span>/</span> Pendapatan
            </div>

            <h2 className="text-2xl font-bold">
              Dashboard Pendapatan
            </h2>

            <p className="mt-1 text-sm text-neutral-400">
              Pendapatan berdasarkan tagihan yang sudah dibayar.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchDashboard()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#151313] px-4 text-sm font-medium text-neutral-200 transition hover:border-rose-700/50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Pendapatan"
            value={formatCurrency(data?.summary.totalIncome ?? 0)}
            caption="Total tagihan berstatus PAID"
            icon={<CircleDollarSign className="h-5 w-5" />}
            accent="text-rose-300"
          />

          <SummaryCard
            label="Tagihan Dibayar"
            value={formatNumber(data?.summary.totalPaidBills ?? 0)}
            caption="Jumlah tagihan lunas"
            icon={<FileText className="h-5 w-5" />}
            accent="text-emerald-300"
          />

          <SummaryCard
            label="Total Pcs Dibayar"
            value={formatNumber(data?.summary.totalQuantity ?? 0)}
            caption="Akumulasi quantity item PAID"
            icon={<Scissors className="h-5 w-5" />}
            accent="text-sky-300"
          />

          <SummaryCard
            label="Penjahit Aktif"
            value={formatNumber(data?.summary.totalTailors ?? 0)}
            caption={`${formatNumber(data?.summary.totalSpk ?? 0)} SPK tercatat`}
            icon={<TrendingUp className="h-5 w-5" />}
            accent="text-amber-300"
          />
        </section>

        <section className="mb-5 rounded-xl border border-white/10 bg-[#151313] p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-rose-300" />
            <h3 className="font-semibold">Filter Laporan</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_auto] xl:items-end">
            <label className="block text-sm text-neutral-400">
              Dari tanggal
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#111010] px-3 text-neutral-100 outline-none focus:border-rose-600"
              />
            </label>

            <label className="block text-sm text-neutral-400">
              Sampai tanggal
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#111010] px-3 text-neutral-100 outline-none focus:border-rose-600"
              />
            </label>

            <label className="block text-sm text-neutral-400">
              Penjahit
              <select
                value={tailorFilter}
                onChange={(event) => setTailorFilter(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#111010] px-3 text-neutral-100 outline-none focus:border-rose-600"
              >
                <option value="ALL">Semua penjahit</option>
                {(data?.tailors ?? []).map((tailor) => (
                  <option
                    key={tailor.tailorId}
                    value={tailor.tailorId}
                  >
                    {tailor.tailorName}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void fetchDashboard()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
            >
              <BarChart3 className="h-4 w-4" />
              Terapkan
            </button>
          </div>
        </section>

        <section className="mb-5 grid gap-5 xl:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-[#151313] p-4 sm:p-5">
            <h3 className="font-semibold">Tren Pendapatan</h3>
            <p className="mb-5 mt-1 text-xs text-neutral-400">
              Nilai tagihan berdasarkan tanggal pembayaran.
            </p>

            {loading ? (
              <LoadingState />
            ) : !data?.monthly.length ? (
              <EmptyState text="Belum ada tagihan PAID pada periode ini." />
            ) : (
              <div className="flex h-56 items-end gap-3 overflow-x-auto border-b border-white/10 pb-2">
                {data.monthly.map((item) => (
                  <div
                    key={item.month}
                    className="flex h-full min-w-14 flex-1 flex-col items-center justify-end gap-2"
                  >
                    <span className="max-w-full truncate text-center text-[10px] text-neutral-400">
                      {formatCompactCurrency(item.amount)}
                    </span>

                    <div className="flex h-36 w-full items-end">
                      <div
                        title={formatCurrency(item.amount)}
                        className="w-full rounded-t-md bg-rose-700 transition-all"
                        style={{
                          height: `${Math.max(
                            4,
                            (item.amount / maxMonthly) * 100,
                          )}%`,
                        }}
                      />
                    </div>

                    <span className="text-xs text-neutral-400">
                      {monthLabel(item.month)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#151313] p-4 sm:p-5">
            <h3 className="font-semibold">Pendapatan per Penjahit</h3>
            <p className="mb-5 mt-1 text-xs text-neutral-400">
              Peringkat berdasarkan total pembayaran yang diterima.
            </p>

            {loading ? (
              <LoadingState />
            ) : !data?.tailors.length ? (
              <EmptyState text="Belum ada data pendapatan." />
            ) : (
              <div className="space-y-4">
                {data.tailors.slice(0, 8).map((tailor, index) => (
                  <div key={tailor.tailorId}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-neutral-200">
                        <span className="mr-2 text-xs text-neutral-500">
                          {index + 1}.
                        </span>
                        {tailor.tailorName}
                      </span>

                      <span className="shrink-0 font-semibold text-rose-300">
                        {formatCurrency(tailor.totalIncome)}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-[#282323]">
                      <div
                        className="h-full rounded-full bg-rose-700"
                        style={{
                          width: `${Math.max(
                            1,
                            (tailor.totalIncome / maxTailor) * 100,
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="mt-1 text-xs text-neutral-500">
                      {formatNumber(tailor.totalQuantity)} pcs ·{" "}
                      {tailor.totalPaidBills} tagihan ·{" "}
                      {tailor.totalSpk} SPK
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-white/10 bg-[#151313]">
          <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h3 className="font-semibold">Detail Pendapatan per SPK</h3>
              <p className="mt-1 text-xs text-neutral-400">
                {formatNumber(visibleDetails.length)} item dari tagihan PAID.
              </p>
            </div>

            <label className="relative block w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari penjahit, SPK, produk..."
                className="h-10 w-full rounded-lg border border-white/10 bg-[#111010] pl-9 pr-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-rose-600"
              />
            </label>
          </div>

          {loading ? (
            <LoadingState />
          ) : visibleDetails.length === 0 ? (
            <EmptyState text="Tidak ada detail pendapatan yang cocok dengan filter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-white/10 bg-[#111010] text-left text-xs uppercase tracking-wide text-neutral-400">
                    <th className="px-4 py-3 font-semibold">Tanggal Bayar</th>
                    <th className="px-4 py-3 font-semibold">Penjahit</th>
                    <th className="px-4 py-3 font-semibold">No. SPK</th>
                    <th className="px-4 py-3 font-semibold">Produk</th>
                    <th className="px-4 py-3 text-right font-semibold">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold">Tarif / pcs</th>
                    <th className="px-4 py-3 text-right font-semibold">Pendapatan</th>
                    <th className="px-4 py-3 font-semibold">No. Tagihan</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {visibleDetails.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-white/[0.02]"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-400">
                        {formatDate(item.paidAt)}
                      </td>

                      <td className="px-4 py-3 text-sm font-medium text-neutral-100">
                        {item.tailorName}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-rose-300">
                        {item.spkNumber}
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm text-neutral-200">
                          {item.productName}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {item.productCode}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right text-sm text-neutral-300">
                        {formatNumber(item.quantity)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-neutral-300">
                        {formatCurrency(item.rate)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-emerald-300">
                        {formatCurrency(item.amount)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-400">
                        {item.billNumber}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  caption,
  icon,
  accent,
}: {
  label: string;
  value: string;
  caption: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#151313] p-4 shadow-lg shadow-black/10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="text-sm text-neutral-400">{label}</div>
        <div className={`rounded-lg bg-[#201c1c] p-2 ${accent}`}>
          {icon}
        </div>
      </div>

      <div className="text-xl font-bold tracking-tight sm:text-2xl">
        {value}
      </div>

      <p className="mt-2 text-xs text-neutral-500">{caption}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-neutral-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      Memuat data...
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center px-5 text-center text-sm text-neutral-500">
      {text}
    </div>
  );
}
