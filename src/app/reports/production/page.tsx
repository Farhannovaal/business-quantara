"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Factory,
  Loader2,
  RefreshCw,
  Search,
  Shirt,
  SlidersHorizontal,
  X,
} from "lucide-react";

type Summary = {
  totalPengiriman: number;
  totalPenerimaan: number;
  totalQcRijek: number;
  totalQcAcc: number;
  totalPengirimanRijek: number;
  totalPenerimaanRijek: number;
  sisaJahit: number;
  barangDiQc: number;
  jumlahRijek: number;
  jumlahBarang: number;
};

type HistoricalItem = {
  id: number;
  productId: number;
  product: { id: number; code: string; name: string };
  targetQuantity: number;
  completedQuantity: number;
  progressPercent: number;
  summary: Summary;
  currentStatus: "ACTIVE" | "COMPLETED" | "CANCELLED";
};

type HistoricalSPK = {
  id: number;
  spkNumber: string;
  createdAt: string;
  tailor: { id: number; name: string };
  currentStatus: "ACTIVE" | "COMPLETED" | "CANCELLED";
  historicalCancellationStatus: string;
  items: HistoricalItem[];
  summary: Summary;
  targetQuantity: number;
  completedQuantity: number;
  progressPercent: number;
};

type ActivityTransaction = {
  id: number;
  transactionNumber: string;
  spkId: number;
  productId: number;
  quantity: number;
  createdAt: string;
  spk: { spkNumber: string };
  product: { code: string; name: string };
  tailor: { name: string };
  employee: { name: string };
  transactionType: { code: string; name: string };
};

type ReportData = {
  period: { startDate: string; endDate: string; timezone: string };
  activity: {
    transactionCount: number;
    quantity: number;
    byType: Record<string, number>;
    transactions: ActivityTransaction[];
  };
  position: {
    spkCount: number;
    totals: Summary;
    targetQuantity: number;
    completedQuantity: number;
    progressPercent: number;
    spks: HistoricalSPK[];
  };
  notes: string[];
};

type Metric =
  | "all"
  | "spk"
  | "transactions"
  | "quantity"
  | "sewing"
  | "qc"
  | "reject";

type Tab = "position" | "activity";
type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED";

const numberFormat = new Intl.NumberFormat("id-ID");

function dateInJakarta(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatNumber(value: number): string {
  return numberFormat.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  return `${Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function escapeCsv(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function getDateOffset(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00+07:00`);
  value.setUTCDate(value.getUTCDate() + days);
  return dateInJakarta(value);
}

const panelClass =
  "rounded-2xl border border-white/10 bg-[#111010] shadow-sm";
const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-white/10 bg-[#171515] px-3 py-2.5 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-400 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/10";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#111010] px-3.5 py-2 text-sm font-semibold text-zinc-300 transition hover:border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-rose-800 hover:to-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60";

export default function ProductionReportPage() {
  const today = useMemo(() => dateInJakarta(), []);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [appliedRange, setAppliedRange] = useState({
    startDate: today,
    endDate: today,
  });
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("position");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [activeMetric, setActiveMetric] = useState<Metric>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadReport = useCallback(
    async (range = appliedRange) => {
      if (!range.startDate || !range.endDate) {
        setError("Tanggal awal dan akhir wajib diisi.");
        return;
      }

      if (range.startDate > range.endDate) {
        setError("Tanggal awal tidak boleh melebihi tanggal akhir.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          startDate: range.startDate,
          endDate: range.endDate,
        });

        const response = await fetch(
          `/api/reports/production?${params.toString()}`,
          { cache: "no-store" },
        );

        const json: {
          success?: boolean;
          data?: ReportData;
          error?: string;
        } = await response.json();

        if (!response.ok || !json.success || !json.data) {
          throw new Error(
            json.error || "Gagal memuat laporan produksi.",
          );
        }

        setData(json.data);
        setAppliedRange(range);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Terjadi kesalahan saat memuat laporan.",
        );
      } finally {
        setLoading(false);
      }
    },
    [appliedRange],
  );

  useEffect(() => {
    void loadReport({ startDate: today, endDate: today });
    // Load the initial report once; subsequent requests are user-triggered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSpks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");

    return (data?.position.spks ?? []).filter((spk) => {
      const matchesStatus =
        statusFilter === "ALL" || spk.currentStatus === statusFilter;
      const matchesSearch =
        !query ||
        spk.spkNumber.toLocaleLowerCase("id-ID").includes(query) ||
        spk.tailor.name.toLocaleLowerCase("id-ID").includes(query) ||
        spk.items.some((item) =>
          `${item.product.code} ${item.product.name}`
            .toLocaleLowerCase("id-ID")
            .includes(query),
        );

      const matchesMetric =
        activeMetric === "all" ||
        activeMetric === "spk" ||
        (activeMetric === "sewing" &&
          spk.items.some((item) => item.summary.sisaJahit > 0)) ||
        (activeMetric === "qc" &&
          spk.items.some((item) => item.summary.barangDiQc > 0)) ||
        (activeMetric === "reject" &&
          spk.items.some((item) => item.summary.jumlahRijek > 0));

      return matchesStatus && matchesSearch && matchesMetric;
    });
  }, [data, search, statusFilter, activeMetric]);

  const filteredTransactions = useMemo(() => {
    const transactions = data?.activity.transactions ?? [];
    return activeMetric === "quantity"
      ? transactions.filter((transaction) => transaction.quantity > 0)
      : transactions;
  }, [data, activeMetric]);

  const positionRows = useMemo(
    () =>
      filteredSpks.flatMap((spk) =>
        spk.items.map((item) => ({ spk, item })),
      ),
    [filteredSpks],
  );

  const currentRows =
    tab === "position" ? positionRows : filteredTransactions;
  const totalPages = Math.max(1, Math.ceil(currentRows.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, currentRows.length);
  const paginatedPositionRows = positionRows.slice(startIndex, endIndex);
  const paginatedTransactions = filteredTransactions.slice(
    startIndex,
    endIndex,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, activeMetric, tab, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const selectMetric = (metric: Metric) => {
    setActiveMetric(metric);
    setTab(
      metric === "transactions" || metric === "quantity"
        ? "activity"
        : "position",
    );
  };

  const setQuickRange = (preset: "today" | "7days" | "30days" | "month") => {
    const current = dateInJakarta();
    let from = current;

    if (preset === "7days") from = getDateOffset(current, -6);
    if (preset === "30days") from = getDateOffset(current, -29);
    if (preset === "month") from = `${current.slice(0, 7)}-01`;

    setStartDate(from);
    setEndDate(current);
  };

  const applyFilters = () => {
    setActiveMetric("all");
    setStatusFilter("ALL");
    setSearch("");
    void loadReport({ startDate, endDate });
  };

  const exportCsv = () => {
    if (!data) return;

    const rows: (string | number)[][] =
      tab === "activity"
        ? [
            [
              "Waktu",
              "Nomor Transaksi",
              "SPK",
              "Produk",
              "Penjahit",
              "Jenis Transaksi",
              "Jumlah",
              "Petugas",
            ],
            ...filteredTransactions.map((transaction) => [
              formatDate(transaction.createdAt),
              transaction.transactionNumber,
              transaction.spk.spkNumber,
              `${transaction.product.code} - ${transaction.product.name}`,
              transaction.tailor.name,
              transaction.transactionType.name,
              transaction.quantity,
              transaction.employee.name,
            ]),
          ]
        : [
            [
              "SPK",
              "Status saat ini",
              "Penjahit",
              "Kode Produk",
              "Produk",
              "Target",
              "Qty QC ACC",
              "Progress SPK (%)",
              "Progress Produk (%)",
              "Pengiriman",
              "Penerimaan",
              "Sisa Jahit",
              "Barang di QC",
              "QC ACC",
              "QC Rijek",
              "Sisa Rijek",
              "Total Posisi",
            ],
            ...filteredSpks.flatMap((spk) =>
              spk.items.map((item) => [
                spk.spkNumber,
                spk.currentStatus,
                spk.tailor.name,
                item.product.code,
                item.product.name,
                item.targetQuantity,
                item.completedQuantity,
                spk.progressPercent,
                item.progressPercent,
                item.summary.totalPengiriman,
                item.summary.totalPenerimaan,
                item.summary.sisaJahit,
                item.summary.barangDiQc,
                item.summary.totalQcAcc,
                item.summary.totalQcRijek,
                item.summary.jumlahRijek,
                item.summary.jumlahBarang,
              ]),
            ),
          ];

    const csv = rows
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `laporan-produksi-${tab}-${appliedRange.startDate}-${appliedRange.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const totals = data?.position.totals;

  const statCards: {
    key: Metric;
    label: string;
    value: number;
    detail: string;
    icon: typeof ClipboardList;
    tone: string;
  }[] = [
    {
      key: "spk",
      label: "SPK",
      value: data?.position.spkCount ?? 0,
      detail: "SPK hingga akhir periode",
      icon: ClipboardList,
      tone: "indigo",
    },
    {
      key: "transactions",
      label: "Transaksi",
      value: data?.activity.transactionCount ?? 0,
      detail: "Aktivitas dalam periode",
      icon: Activity,
      tone: "cyan",
    },
    {
      key: "quantity",
      label: "Kuantitas transaksi",
      value: data?.activity.quantity ?? 0,
      detail: "Total unit yang dicatat",
      icon: Factory,
      tone: "violet",
    },
    {
      key: "sewing",
      label: "Sisa jahit",
      value: totals?.sisaJahit ?? 0,
      detail: "Unit belum diterima",
      icon: Shirt,
      tone: "amber",
    },
    {
      key: "qc",
      label: "Barang di QC",
      value: totals?.barangDiQc ?? 0,
      detail: "Unit dalam proses QC",
      icon: CheckCircle2,
      tone: "emerald",
    },
    {
      key: "reject",
      label: "Sisa rijek",
      value: totals?.jumlahRijek ?? 0,
      detail: "Rijek belum kembali",
      icon: RefreshCw,
      tone: "rose",
    },
  ];

  const toneClasses: Record<string, { icon: string; selected: string }> = {
    indigo: {
      icon: "bg-rose-950/30 text-rose-300 ring-rose-500/20",
      selected: "border-indigo-300 ring-rose-500/20",
    },
    cyan: {
      icon: "bg-cyan-50 text-cyan-700 ring-cyan-100",
      selected: "border-cyan-300 ring-cyan-100",
    },
    violet: {
      icon: "bg-violet-50 text-violet-600 ring-violet-100",
      selected: "border-violet-300 ring-violet-100",
    },
    amber: {
      icon: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
      selected: "border-amber-300 ring-amber-500/20",
    },
    emerald: {
      icon: "bg-emerald-950/30 text-emerald-300 ring-emerald-500/10",
      selected: "border-emerald-500/30 ring-emerald-500/10",
    },
    rose: {
      icon: "bg-rose-950/30 text-rose-300 ring-rose-500/20",
      selected: "border-rose-500/40 ring-rose-500/10",
    },
  };

  return (
    <main className="relative min-h-screen min-w-0 overflow-hidden bg-gradient-to-br from-[#090909] via-[#111010] to-[#19090b] px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-rose-700/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-rose-950/15 blur-3xl" />
      <div className="relative mx-auto max-w-[1600px] space-y-5">
        <header className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-rose-950/30 blur-3xl" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111010] px-3 py-1.5 text-xs font-semibold text-rose-300 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Laporan & Analitik
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Laporan Produksi
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Pantau aktivitas transaksi dan posisi produksi berdasarkan
              rentang tanggal yang dipilih.
            </p>
          </div>

          <div className="relative flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs text-zinc-400">
              Periode data: {appliedRange.startDate} — {appliedRange.endDate}
            </span>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!data || loading}
              className={secondaryButtonClass}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </header>

        <section className={`${panelClass} p-4 sm:p-5`}>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-950/30 text-rose-300 ring-1 ring-rose-500/20">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">
                Periode laporan
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Gunakan rentang tanggal untuk memuat ulang ringkasan dan detail.
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { label: "Hari ini", value: "today" },
              { label: "7 hari", value: "7days" },
              { label: "30 hari", value: "30days" },
              { label: "Bulan ini", value: "month" },
            ].map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() =>
                  setQuickRange(
                    preset.value as "today" | "7days" | "30days" | "month",
                  )
                }
                className={secondaryButtonClass}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
            <label className="block text-sm font-medium text-zinc-400">
              Tanggal awal
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => setStartDate(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-zinc-400">
              Tanggal akhir
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                className={inputClass}
              />
            </label>
            <button
              type="button"
              onClick={applyFilters}
              disabled={loading || !startDate || !endDate}
              className={primaryButtonClass}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {loading ? "Memuat..." : "Tampilkan laporan"}
            </button>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-950/30 px-4 py-3.5 text-sm text-rose-300 shadow-sm"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Laporan belum berhasil dimuat</p>
              <p className="mt-0.5 leading-5">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Tutup pesan error"
              className="rounded-lg p-1 text-rose-300 transition hover:bg-rose-950/30"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className={`${panelClass} flex min-h-64 items-center justify-center p-10`}>
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-950/30 text-rose-300">
                <Loader2 className="h-6 w-6 animate-spin" />
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-200">
                  Memuat laporan produksi
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Menyiapkan ringkasan dan detail periode terpilih...
                </p>
              </div>
            </div>
          </div>
        ) : data ? (
          <>
            <section className={`${panelClass} p-5 sm:p-6`}>
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-400">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-950/30 text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    Progress produksi keseluruhan
                  </div>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-white tabular-nums sm:text-4xl">
                    {formatPercent(data.position.progressPercent)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {formatNumber(data.position.completedQuantity)} dari{" "}
                    {formatNumber(data.position.targetQuantity)} unit target
                    telah lolos QC (ACC).
                  </p>
                </div>

                <div className="w-full md:max-w-md">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-zinc-400">
                    <span>Target diterima QC</span>
                    <span className="text-zinc-200">
                      {formatNumber(data.position.completedQuantity)} /{" "}
                      {formatNumber(data.position.targetQuantity)}
                    </span>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full bg-[#171515] ring-1 ring-white/5"
                    role="progressbar"
                    aria-label="Progress produksi keseluruhan"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(
                      Math.min(
                        100,
                        Math.max(0, data.position.progressPercent),
                      ),
                    )}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-700 to-rose-700 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, data.position.progressPercent))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-right text-xs text-zinc-400">
                    Periode {data.period.startDate} — {data.period.endDate}
                  </p>
                </div>
              </div>
            </section>

            <section
              aria-label="Ringkasan metrik produksi"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              {statCards.map((card) => {
                const Icon = card.icon;
                const active = activeMetric === card.key;
                const tone = toneClasses[card.tone];

                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => selectMetric(card.key)}
                    aria-pressed={active}
                    className={`group rounded-2xl border bg-[#111010] p-4 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md hover:shadow-black/20 focus:outline-none focus:ring-2 focus:ring-rose-500/15 sm:p-5 ${
                      active
                        ? `${tone.selected} ring-2`
                        : "border-white/10 hover:border-rose-500/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${tone.icon}`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          active
                            ? "bg-rose-950/40 text-white"
                            : "bg-[#171515] text-zinc-400 group-hover:bg-rose-950/30 group-hover:text-rose-300"
                        }`}
                      >
                        {active ? "Dipilih" : "Lihat detail"}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-medium text-zinc-400">
                      {card.label}
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-white tabular-nums">
                      {formatNumber(card.value)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {card.detail}
                    </p>
                  </button>
                );
              })}
            </section>

            <section className={`${panelClass} overflow-hidden`}>
              <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-950/30 text-rose-300">
                      <SlidersHorizontal className="h-4 w-4" />
                    </span>
                    <h2 className="text-base font-bold text-white">
                      Detail laporan
                    </h2>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">
                    {data.period.startDate} — {data.period.endDate}
                    <span className="mx-2 text-zinc-400">•</span>
                    Zona waktu {data.period.timezone}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div
                    className="inline-flex rounded-xl bg-[#171515] p-1"
                    role="tablist"
                    aria-label="Jenis detail laporan"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === "position"}
                      onClick={() => setTab("position")}
                      className={`min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        tab === "position"
                          ? "bg-[#111010] text-rose-300 shadow-sm ring-1 ring-white/5"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Posisi produksi
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === "activity"}
                      onClick={() => setTab("activity")}
                      className={`min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        tab === "activity"
                          ? "bg-[#111010] text-rose-300 shadow-sm ring-1 ring-white/5"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Aktivitas transaksi
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-b border-white/10 bg-gradient-to-r from-[#171313] to-[#111010] p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
                {tab === "position" ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] lg:flex-1">
                    <label className="block text-xs font-semibold text-zinc-400">
                      Status SPK
                      <select
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value as StatusFilter)
                        }
                        className={inputClass}
                      >
                        <option value="ALL">Semua status</option>
                        <option value="ACTIVE">Aktif</option>
                        <option value="COMPLETED">Selesai</option>
                        <option value="CANCELLED">Dibatalkan</option>
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-zinc-400">
                      Cari SPK, produk, atau penjahit
                      <span className="relative mt-1.5 block">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Masukkan kata kunci..."
                          className="min-h-11 w-full rounded-xl border border-white/10 bg-[#171515] py-2.5 pl-9 pr-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-400 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/15"
                        />
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-400">
                    <p className="font-semibold text-zinc-200">
                      Aktivitas transaksi
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Menampilkan transaksi pada rentang tanggal terpilih.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-400">
                    {tab === "position"
                      ? `${filteredSpks.length} SPK · ${positionRows.length} baris produk`
                      : `${filteredTransactions.length} transaksi`}
                  </span>
                  {(statusFilter !== "ALL" ||
                    search ||
                    activeMetric !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("ALL");
                        setSearch("");
                        setActiveMetric("all");
                      }}
                      className={secondaryButtonClass}
                    >
                      <X className="h-4 w-4" />
                      Reset filter
                    </button>
                  )}
                </div>
              </div>

              {loading && data && (
                <div className="flex items-center gap-2 border-b border-white/10 bg-rose-950/30 px-4 py-2.5 text-xs font-medium text-rose-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memperbarui data laporan...
                </div>
              )}

              <div className="overflow-x-auto">
                {tab === "position" ? (
                  <table className="w-full min-w-[1120px] text-left text-sm">
                    <thead className="bg-gradient-to-r from-[#171313] to-[#111010] text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      <tr>
                        {[
                          "SPK / Penjahit",
                          "Produk",
                          "Progress SPK",
                          "Target",
                          "Pengiriman",
                          "Penerimaan",
                          "Sisa jahit",
                          "Di QC",
                          "QC ACC",
                          "QC rijek",
                          "Sisa rijek",
                        ].map((heading, index) => (
                          <th
                            key={heading}
                            scope="col"
                            className={`whitespace-nowrap px-4 py-3.5 font-bold ${
                              index >= 3 ? "text-right" : ""
                            }`}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {paginatedPositionRows.map(({ spk, item }) => (
                        <tr
                          key={`${spk.id}-${item.id}`}
                          className="transition hover:bg-white/[0.04]"
                        >
                          <td className="px-4 py-4">
                            <p className="font-semibold text-white">
                              {spk.spkNumber}
                            </p>
                            <p className="mt-1 text-xs text-zinc-400">
                              {spk.tailor.name}
                            </p>
                            <span
                              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                spk.currentStatus === "COMPLETED"
                                  ? "bg-emerald-950/30 text-emerald-300"
                                  : spk.currentStatus === "CANCELLED"
                                    ? "bg-rose-950/30 text-rose-300"
                                    : "bg-rose-950/30 text-rose-300"
                              }`}
                            >
                              {spk.currentStatus === "ACTIVE"
                                ? "Aktif"
                                : spk.currentStatus === "COMPLETED"
                                  ? "Selesai"
                                  : "Dibatalkan"}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium text-zinc-200">
                              {item.product.name}
                            </p>
                            <p className="mt-1 text-xs text-zinc-400">
                              {item.product.code}
                            </p>
                          </td>
                          <td className="min-w-44 px-4 py-4">
                            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-zinc-200">
                                {formatPercent(spk.progressPercent)}
                              </span>
                              <span className="text-zinc-400">
                                {formatNumber(spk.completedQuantity)}/
                                {formatNumber(spk.targetQuantity)}
                              </span>
                            </div>
                            <div
                              className="h-2 overflow-hidden rounded-full bg-[#171515]"
                              role="progressbar"
                              aria-label={`Progress SPK ${spk.spkNumber}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.round(
                                Math.min(
                                  100,
                                  Math.max(0, spk.progressPercent),
                                ),
                              )}
                            >
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-rose-700 to-rose-700"
                                style={{
                                  width: `${Math.min(100, Math.max(0, spk.progressPercent))}%`,
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-medium tabular-nums text-zinc-200">
                            {formatNumber(item.targetQuantity)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-zinc-400">
                            {formatNumber(item.summary.totalPengiriman)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-zinc-400">
                            {formatNumber(item.summary.totalPenerimaan)}
                          </td>
                          <td className="px-4 py-4 text-right font-semibold tabular-nums text-amber-300">
                            {formatNumber(item.summary.sisaJahit)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-zinc-400">
                            {formatNumber(item.summary.barangDiQc)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-emerald-300">
                            {formatNumber(item.summary.totalQcAcc)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-rose-300">
                            {formatNumber(item.summary.totalQcRijek)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-zinc-400">
                            {formatNumber(item.summary.jumlahRijek)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <thead className="bg-gradient-to-r from-[#171313] to-[#111010] text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      <tr>
                        {[
                          "Waktu",
                          "Nomor transaksi",
                          "SPK",
                          "Produk",
                          "Jenis transaksi",
                          "Penjahit",
                          "Qty",
                          "Petugas",
                        ].map((heading, index) => (
                          <th
                            key={heading}
                            scope="col"
                            className={`whitespace-nowrap px-4 py-3.5 font-bold ${
                              index === 6 ? "text-right" : ""
                            }`}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {paginatedTransactions.map((transaction) => (
                        <tr
                          key={transaction.id}
                          className="transition hover:bg-white/[0.04]"
                        >
                          <td className="whitespace-nowrap px-4 py-4 text-xs text-zinc-400">
                            {formatDate(transaction.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-semibold text-white">
                            {transaction.transactionNumber}
                          </td>
                          <td className="px-4 py-4 font-medium text-rose-300">
                            {transaction.spk.spkNumber}
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium text-zinc-200">
                              {transaction.product.name}
                            </p>
                            <p className="mt-1 text-xs text-zinc-400">
                              {transaction.product.code}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-zinc-400">
                            {transaction.transactionType.name}
                          </td>
                          <td className="px-4 py-4 text-zinc-400">
                            {transaction.tailor.name}
                          </td>
                          <td className="px-4 py-4 text-right font-semibold tabular-nums text-white">
                            {formatNumber(transaction.quantity)}
                          </td>
                          <td className="px-4 py-4 text-zinc-400">
                            {transaction.employee.name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {currentRows.length === 0 && (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#171515] text-zinc-400">
                    {tab === "position" ? (
                      <ClipboardList className="h-6 w-6" />
                    ) : (
                      <Activity className="h-6 w-6" />
                    )}
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-zinc-200">
                    Tidak ada data yang cocok
                  </h3>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-400">
                    Coba ubah rentang tanggal atau reset filter untuk melihat
                    data lainnya.
                  </p>
                  {(search ||
                    statusFilter !== "ALL" ||
                    activeMetric !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("ALL");
                        setActiveMetric("all");
                      }}
                      className={`${secondaryButtonClass} mt-4`}
                    >
                      Reset filter
                    </button>
                  )}
                </div>
              )}

              {currentRows.length > 0 && (
                <footer className="flex flex-col gap-3 border-t border-white/10 bg-[#111010] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <p className="text-xs text-zinc-400">
                    Menampilkan{" "}
                    <span className="font-bold text-zinc-200">
                      {startIndex + 1}–{endIndex}
                    </span>{" "}
                    dari{" "}
                    <span className="font-bold text-zinc-200">
                      {currentRows.length}
                    </span>{" "}
                    {tab === "position" ? "baris produk SPK" : "transaksi"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-400">
                      Baris
                      <select
                        value={pageSize}
                        onChange={(event) =>
                          setPageSize(Number(event.target.value))
                        }
                        className="min-h-9 rounded-lg border border-white/10 bg-[#171515] px-2 text-xs text-zinc-200 outline-none focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/15"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      per halaman
                    </label>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className={secondaryButtonClass}
                    >
                      Awal
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((page) => Math.max(1, page - 1))
                      }
                      disabled={currentPage === 1}
                      className={secondaryButtonClass}
                    >
                      Sebelumnya
                    </button>
                    <span className="min-w-12 text-center text-xs font-semibold text-zinc-400">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((page) =>
                          Math.min(totalPages, page + 1),
                        )
                      }
                      disabled={currentPage >= totalPages}
                      className={secondaryButtonClass}
                    >
                      Berikutnya
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage >= totalPages}
                      className={secondaryButtonClass}
                    >
                      Akhir
                    </button>
                  </div>
                </footer>
              )}
            </section>

            {data.notes.length > 0 && (
              <section className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111010] text-amber-300 shadow-sm ring-1 ring-amber-500/20">
                    <AlertCircle className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-amber-200">
                      Catatan interpretasi laporan
                    </h2>
                    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-5 text-amber-200">
                      {data.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs leading-5 text-amber-200">
                      Status SPK yang ditampilkan adalah status saat ini,
                      bukan status historis pada akhir periode.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </>
        ) : (
          !error && (
            <div className={`${panelClass} p-10 text-center`}>
              <p className="text-sm font-semibold text-zinc-200">
                Laporan belum tersedia
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Pilih periode, lalu tampilkan laporan.
              </p>
            </div>
          )
        )}
      </div>
    </main>
  );
}