"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Clock3,
  Loader2,
  Package,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
type Product = {
  id: number;
  code: string;
  name: string;
};
type Transaction = {
  id: number;
  transactionNumber: string;
  quantity: number;
  createdAt: string;
  transactionType: {
    id: number;
    code: string;
    name: string;
  };
  product?: Product;
  employee: {
    id: number;
    name: string;
  };
};
type SPKItem = {
  id: number;
  productId: number;
  quantity: number;
  product: Product;
};
type SPK = {
  id: number;
  spkNumber: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  items: SPKItem[];
  tailor: {
    id: number;
    name: string;
  };
  summary: {
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
    nextTransactionTypes: string[];
  };
  transactions: Transaction[];
};
const PROCESS_LABELS: Record<string, string> = {
  PENGIRIMAN_SIAP_JAHIT: "Pengiriman Siap Jahit",
  PENERIMAAN_DARI_PENJAHIT: "Penerimaan dari Penjahit",
  QUALITY_CONTROL: "Quality Control",
  QC_RIJEK: "QC / Rijek",
  QC_ACC_DIKIRIM_KE_GUDANG: "QC / ACC dikirim ke Gudang",
  PENGIRIMAN_RIJEK: "Pengiriman Rijek",
  PENERIMAAN_RIJEK: "Penerimaan Rijek",
};
const PROCESS_STYLES: Record<
  string,
  {
    icon: string;
    bg: string;
    border: string;
    text: string;
    dot: string;
  }
> = {
  PENGIRIMAN_SIAP_JAHIT: {
    icon: "📤",
    bg: "bg-[#1b1516]",
    border: "border-rose-900/40",
    text: "text-rose-300",
    dot: "bg-rose-500",
  },
  PENERIMAAN_DARI_PENJAHIT: {
    icon: "📥",
    bg: "bg-[#1b1516]",
    border: "border-rose-900/40",
    text: "text-rose-300",
    dot: "bg-rose-500",
  },
  QUALITY_CONTROL: {
    icon: "🔍",
    bg: "bg-rose-950/30",
    border: "border-rose-900/60",
    text: "text-rose-300",
    dot: "bg-rose-500",
  },
  QC_RIJEK: {
    icon: "⚠️",
    bg: "bg-amber-950/30",
    border: "border-amber-900/60",
    text: "text-amber-300",
    dot: "bg-amber-500",
  },
  QC_ACC_DIKIRIM_KE_GUDANG: {
    icon: "✅",
    bg: "bg-[#17201b]",
    border: "border-emerald-900/50",
    text: "text-emerald-300",
    dot: "bg-emerald-500",
  },
  PENGIRIMAN_RIJEK: {
    icon: "↗️",
    bg: "bg-amber-950/20",
    border: "border-amber-900/50",
    text: "text-amber-300",
    dot: "bg-amber-500",
  },
  PENERIMAAN_RIJEK: {
    icon: "↙️",
    bg: "bg-[#1b1516]",
    border: "border-rose-900/40",
    text: "text-rose-300",
    dot: "bg-rose-500",
  },
};
function getProcessStyle(code: string) {
  return (
    PROCESS_STYLES[code] ?? {
      icon: "•",
      bg: "bg-[#191919]",
      border: "border-white/10",
      text: "text-gray-200",
      dot: "bg-slate-400",
    }
  );
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}
export default function TrackingPage() {
  const [spks, setSpks] = useState<SPK[]>([]);
  const [selectedSpkId, setSelectedSpkId] = useState<number | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  async function loadTracking(showLoading = true) {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError("");
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const query = params.toString();
      const response = await fetch(
        `/api/tracking${query ? `?${query}` : ""}`,
        {
          cache: "no-store",
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(
          json.error ?? "Gagal mengambil data tracking.",
        );
      }
      setSpks(json.data ?? []);
      if (
        selectedSpkId === null &&
        json.data?.length > 0
      ) {
        setSelectedSpkId(json.data[0].id);
      }
      if (
        selectedSpkId !== null &&
        json.data?.length > 0 &&
        !json.data.some(
          (spk: SPK) => spk.id === selectedSpkId,
        )
      ) {
        setSelectedSpkId(json.data[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data tracking.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => {
    loadTracking();
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      loadTracking(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const selectedSpk = useMemo(() => {
    return (
      spks.find((spk) => spk.id === selectedSpkId) ?? null
    );
  }, [spks, selectedSpkId]);

  const totalPages = Math.max(1, Math.ceil(spks.length / pageSize));
  const paginatedSpks = useMemo(
    () => spks.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [spks, currentPage, pageSize],
  );
  const pageStart = spks.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, spks.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex items-center gap-2 rounded-2xl border border-rose-900/50 bg-[#151515] px-5 py-4 text-sm font-medium text-rose-400 shadow-lg shadow-red-950/30">
          <Loader2 className="h-5 w-5 animate-spin" />
          Memuat production tracking...
        </div>
      </div>
    );
  }
  return (
    <div className="relative min-h-full space-y-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#090909] via-[#111111] to-[#18090b] p-4 md:p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-rose-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-rose-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-rose-700 to-rose-950 p-3 text-white shadow-lg shadow-red-950/40">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-100">
                Production Tracking
              </h1>
              <p className="mt-1 text-sm text-gray-400">
                Monitor perjalanan produksi setiap SPK secara
                real-time.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => loadTracking(false)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-900/50 bg-[#111111] px-4 py-2.5 text-sm font-semibold text-rose-300 shadow-sm transition hover:border-rose-800 hover:bg-rose-950/40 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""
              }`}
          />
          Refresh
        </button>
      </div>
      {error && (
        <div className="relative rounded-2xl border border-rose-900/60 bg-rose-950/20 px-4 py-3 text-sm text-rose-300 shadow-sm">
          <div className="font-semibold">
            Gagal mengambil tracking
          </div>
          <div className="mt-1">{error}</div>
        </div>
      )}
      <div className="relative rounded-3xl border border-white/10 bg-[#111111] p-4 shadow-lg shadow-black/40 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-rose-400" />
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Cari SPK, produk, atau penjahit..."
            className="w-full rounded-2xl border border-white/10 bg-[#191919] py-3.5 pl-12 pr-4 text-sm text-gray-100 outline-none transition placeholder:text-gray-400 focus:border-rose-600 focus:bg-[#191919] focus:ring-4 focus:ring-rose-950/60"
          />
        </div>
      </div>
      {spks.length === 0 ? (
        <div className="relative rounded-3xl border border-white/10 bg-[#111111] px-6 py-16 text-center shadow-xl shadow-black/40">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-950/40 text-rose-400">
            <Package className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-lg font-bold text-gray-100">
            SPK tidak ditemukan
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
            Tidak ada SPK yang sesuai dengan pencarian
            kamu.
          </p>
        </div>
      ) : (
        <div className="relative grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-white/10 bg-[#111111] shadow-xl shadow-black/40 backdrop-blur">
            <div className="border-b border-white/10 px-5 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-100">
                    Production Orders
                  </h2>
                  <p className="mt-1 text-xs text-gray-400">
                    {spks.length} SPK tersedia
                  </p>
                </div>
                <div className="rounded-xl bg-rose-950/40 px-2.5 py-1 text-xs font-bold text-rose-400">
                  {spks.length}
                </div>
              </div>
            </div>
            <div className="max-h-[650px] space-y-2 overflow-y-auto p-3">
              {paginatedSpks.map((spk) => {
                const active =
                  spk.id === selectedSpkId;
                return (
                  <button
                    key={spk.id}
                    type="button"
                    onClick={() =>
                      setSelectedSpkId(spk.id)
                    }
                    className={`w-full rounded-2xl border p-4 text-left transition ${active
                        ? "border-rose-900/70 bg-gradient-to-br from-[#1b1012] to-[#151515] shadow-md shadow-red-950/30"
                        : "border-transparent bg-[#181818] hover:border-rose-900/60 hover:bg-rose-950/30"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className={`truncate text-sm font-bold ${active
                              ? "text-rose-300"
                              : "text-gray-100"
                            }`}
                        >
                          {spk.spkNumber}
                        </div>
                        <div className="mt-1 space-y-1">
                          {spk.items?.length ? (
                            spk.items.map((item) => (
                              <div
                                key={item.id}
                                className="truncate text-xs text-gray-400"
                              >
                                {item.product.name} · {formatNumber(item.quantity)} pcs
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-gray-400">
                              Produk belum tersedia
                            </div>
                          )}
                        </div>
                        <div className="mt-1 truncate text-xs text-gray-400">
                          {spk.tailor.name}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${spk.status === "ACTIVE"
                            ? "bg-emerald-950/50 text-emerald-300"
                            : spk.status === "COMPLETED"
                              ? "bg-blue-100 text-rose-300"
                              : "bg-rose-950/40 text-rose-300"
                          }`}
                      >
                        {spk.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                      <span className="text-[11px] text-gray-400">
                        Total barang
                      </span>
                      <span className="text-sm font-bold text-gray-200">
                        {formatNumber(
                          spk.summary.jumlahBarang,
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-white/10 px-4 py-4">
              <div className="mb-3 flex flex-col gap-2 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                <span>Menampilkan {pageStart}–{pageEnd} dari {spks.length} SPK</span>
                <label className="flex items-center gap-2">
                  <span>Baris</span>
                  <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }} className="rounded-lg border border-white/10 bg-[#191919] px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-rose-500">
                    <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button>
                <span className="text-xs font-medium text-gray-300">{currentPage} / {totalPages}</span>
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button>
              </div>
            </div>
          </aside>
          {selectedSpk && (
            <main className="min-w-0 space-y-6">
              <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111111] shadow-xl shadow-black/40">
                <div className="relative overflow-hidden bg-gradient-to-br from-rose-800 via-rose-700 to-[#250d10] px-6 py-7 text-white md:px-8">
                  <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-black/20 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl" />
                  <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                        <span className="h-2 w-2 rounded-full bg-emerald-300" />
                        Production Order
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                        {selectedSpk.spkNumber}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-rose-100">
                        {selectedSpk.items?.length ? (
                          selectedSpk.items.map((item) => (
                            <span key={item.id}>
                              {item.product.name} ({item.product.code}) · {formatNumber(item.quantity)} pcs
                            </span>
                          ))
                        ) : (
                          <span>Produk belum tersedia</span>
                        )}
                        <span className="hidden md:inline">•</span>
                        <span>
                          Penjahit:{" "}
                          {selectedSpk.tailor.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start rounded-full bg-black/20 px-4 py-2 text-xs font-bold backdrop-blur md:self-center">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
                      {selectedSpk.status}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-white/10 md:grid-cols-5 md:divide-y-0">
                  <Kpi
                    label="Pengiriman"
                    value={
                      selectedSpk.summary.totalPengiriman
                    }
                    tone="rose"
                  />
                  <Kpi
                    label="Penerimaan"
                    value={
                      selectedSpk.summary.totalPenerimaan
                    }
                    tone="rose"
                  />
                  <Kpi
                    label="Barang di QC"
                    value={
                      selectedSpk.summary.barangDiQc
                    }
                    tone="rose"
                  />
                  <Kpi
                    label="QC Rijek"
                    value={
                      selectedSpk.summary.totalQcRijek
                    }
                    tone="amber"
                  />
                  <Kpi
                    label="Total Barang"
                    value={
                      selectedSpk.summary.jumlahBarang
                    }
                    tone="rose"
                  />
                </div>
              </section>
              <section className="rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-xl shadow-black/40 md:p-7">
                <SectionHeader
                  icon={<Activity className="h-5 w-5" />}
                  title="Current Position"
                  description="Posisi barang berdasarkan transaksi terakhir."
                />
                <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                  <div className="rounded-2xl border border-rose-900/60 bg-gradient-to-br from-[#191919] to-[#111111] p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-950/50 text-xl">
                        📦
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                          Current Inventory
                        </div>
                        <div className="mt-1 text-xl font-bold text-rose-200">
                          {formatNumber(
                            selectedSpk.summary
                              .jumlahBarang,
                          )}{" "}
                          pcs
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="hidden text-rose-400 lg:block">
                    <ArrowRight className="h-7 w-7" />
                  </div>
                  <div className="rounded-2xl border border-rose-900/70 bg-gradient-to-br from-[#1b1012] to-[#111111] p-5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                      Next Process
                    </div>
                    {selectedSpk.summary
                      .nextTransactionTypes.length === 0 ? (
                      <div className="mt-2 text-sm font-semibold text-gray-400">
                        Tidak ada proses berikutnya.
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedSpk.summary.nextTransactionTypes.map(
                          (code) => {
                            const style =
                              getProcessStyle(code);
                            return (
                              <span
                                key={code}
                                className={`inline-flex items-center gap-1.5 rounded-full border ${style.border} ${style.bg} px-3 py-1.5 text-xs font-bold ${style.text}`}
                              >
                                <span>
                                  {style.icon}
                                </span>
                                {PROCESS_LABELS[code] ??
                                  code}
                              </span>
                            );
                          },
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
              <section className="rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-xl shadow-black/40 md:p-7">
                <SectionHeader
                  icon={<Package className="h-5 w-5" />}
                  title="Rijek Tracking"
                  description="Rekonsiliasi total QC rijek dengan status pengiriman dan pengembalian rework."
                />
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <RijekMetric
                    label="Total QC Rijek"
                    value={selectedSpk.summary.totalQcRijek}
                    description="Total historis rijek"
                    tone="amber"
                  />
                  <RijekMetric
                    label="Belum Dikirim"
                    value={Math.max(
                      selectedSpk.summary.totalQcRijek -
                      selectedSpk.summary.totalPengirimanRijek,
                      0,
                    )}
                    description="Belum dikirim rework"
                    tone="orange"
                  />
                  <RijekMetric
                    label="Sedang Rework"
                    value={selectedSpk.summary.jumlahRijek}
                    description="Sudah dikirim, belum kembali"
                    tone="rose"
                  />
                  <RijekMetric
                    label="Sudah Kembali"
                    value={selectedSpk.summary.totalPenerimaanRijek}
                    description="Sudah kembali dari rework"
                    tone="rose"
                  />
                </div>
                <div className="mt-5 rounded-2xl border border-amber-900/50 bg-amber-950/20 px-4 py-3">
                  <div className="flex flex-col gap-1 text-xs text-amber-300 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold">
                      Rekonsiliasi Rijek
                    </span>
                    <span>
                      {formatNumber(
                        Math.max(
                          selectedSpk.summary.totalQcRijek -
                          selectedSpk.summary.totalPengirimanRijek,
                          0,
                        ),
                      )}{" "}
                      belum dikirim + {formatNumber(
                        selectedSpk.summary.jumlahRijek,
                      )}{" "}
                      rework + {formatNumber(
                        selectedSpk.summary.totalPenerimaanRijek,
                      )}{" "}
                      kembali = {formatNumber(
                        selectedSpk.summary.totalQcRijek,
                      )}
                    </span>
                  </div>
                </div>
              </section>
              <section className="rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-xl shadow-black/40 md:p-7">
                <SectionHeader
                  icon={<Clock3 className="h-5 w-5" />}
                  title="Production Journey"
                  description={`${selectedSpk.transactions.length} transaksi tercatat untuk SPK ini.`}
                />
                {selectedSpk.transactions.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-rose-900/70 bg-rose-950/20 px-6 py-12 text-center">
                    <Package className="mx-auto h-9 w-9 text-rose-400" />
                    <div className="mt-3 text-sm font-semibold text-gray-200">
                      Belum ada transaksi
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      Production journey akan muncul
                      setelah transaksi pertama dibuat.
                    </div>
                  </div>
                ) : (
                  <div className="relative mt-7">
                    <div className="absolute bottom-7 left-[19px] top-7 w-px bg-gradient-to-b from-rose-700 via-rose-900 to-slate-700" />
                    <div className="space-y-7">
                      {selectedSpk.transactions.map(
                        (transaction, index) => {
                          const style =
                            getProcessStyle(
                              transaction
                                .transactionType.code,
                            );
                          const isLast =
                            index ===
                            selectedSpk.transactions
                              .length -
                            1;
                          return (
                            <div
                              key={transaction.id}
                              className="relative flex gap-4"
                            >
                              <div
                                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${style.border} ${style.bg} text-base shadow-sm`}
                              >
                                {style.icon}
                              </div>
                              <div
                                className={`min-w-0 flex-1 rounded-2xl border p-4 transition ${isLast
                                    ? "border-rose-900/70 bg-gradient-to-br from-[#251114] to-[#171012] shadow-md shadow-red-950/30"
                                    : "border-white/10 bg-[#171717]"
                                  }`}
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="font-bold text-gray-100">
                                        {transaction
                                          .transactionType
                                          .name}
                                      </h3>
                                      {isLast && (
                                        <span className="rounded-full bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                                          CURRENT
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 text-xs font-medium text-gray-400">
                                      {
                                        transaction.transactionNumber
                                      }
                                    </div>
                                    {transaction.product && (
                                      <div className="mt-2 inline-flex items-center rounded-full bg-rose-950/40 px-2.5 py-1 text-[10px] font-semibold text-rose-400">
                                        {transaction.product.name} · {transaction.product.code}
                                      </div>
                                    )}
                                  </div>
                                  <div className="shrink-0 rounded-xl bg-[#151515] px-3 py-2 text-right shadow-sm">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                      Quantity
                                    </div>
                                    <div className="text-lg font-bold text-gray-100">
                                      {formatNumber(
                                        transaction.quantity,
                                      )}{" "}
                                      <span className="text-xs font-medium text-gray-400">
                                        pcs
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-3 text-xs text-gray-400">
                                  <span className="inline-flex items-center gap-1.5">
                                    <UserRound className="h-3.5 w-3.5 text-rose-400" />
                                    {transaction.employee
                                      .name}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <Clock3 className="h-3.5 w-3.5 text-rose-400" />
                                    {formatDate(
                                      transaction.createdAt,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}
              </section>
            </main>
          )}
        </div>
      )}
    </div>
  );
}
function RijekMetric({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  tone: "amber" | "orange" | "rose" | "violet" | "emerald";
}) {
  const styles = {
    amber: {
      bg: "bg-amber-950/30",
      border: "border-amber-900/50",
      text: "text-amber-300",
      dot: "bg-amber-500",
    },
    orange: {
      bg: "bg-amber-950/20",
      border: "border-orange-900/50",
      text: "text-amber-300",
      dot: "bg-amber-500",
    },
    rose: {
      bg: "bg-rose-950/30",
      border: "border-rose-900/50",
      text: "text-rose-300",
      dot: "bg-rose-500",
    },
    violet: {
      bg: "bg-rose-950/30",
      border: "border-rose-900/50",
      text: "text-rose-300",
      dot: "bg-rose-500",
    },
    emerald: {
      bg: "bg-[#17201b]",
      border: "border-emerald-900/50",
      text: "text-emerald-300",
      dot: "bg-emerald-500",
    },
  }[tone];
  return (
    <div className={`rounded-2xl border ${styles.border} ${styles.bg} p-4`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
        <span className="text-xs font-semibold text-gray-400">
          {label}
        </span>
      </div>
      <div className={`mt-2 text-2xl font-bold ${styles.text}`}>
        {formatNumber(value)}
      </div>
      <div className="mt-1 text-[11px] text-gray-400">
        {description}
      </div>
    </div>
  );
}
function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-950/40 text-rose-400">
        {icon}
      </div>
      <div>
        <h2 className="font-bold text-gray-100">
          {title}
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          {description}
        </p>
      </div>
    </div>
  );
}
function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:
  | "blue"
  | "cyan"
  | "violet"
  | "rose"
  | "amber"
  | "emerald";
}) {
  const styles = {
    blue: {
      dot: "bg-rose-500",
      text: "text-rose-300",
      bg: "bg-[#1b1516]",
    },
    cyan: {
      dot: "bg-rose-500",
      text: "text-rose-300",
      bg: "bg-[#1b1516]",
    },
    violet: {
      dot: "bg-rose-500",
      text: "text-rose-300",
      bg: "bg-rose-950/30",
    },
    rose: {
      dot: "bg-rose-500",
      text: "text-rose-300",
      bg: "bg-rose-950/30",
    },
    amber: {
      dot: "bg-amber-500",
      text: "text-amber-300",
      bg: "bg-amber-950/30",
    },
    emerald: {
      dot: "bg-emerald-500",
      text: "text-emerald-300",
      bg: "bg-[#17201b]",
    },
  };
  const style = styles[tone];
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${style.dot}`}
        />
        <span className="text-xs font-semibold text-gray-400">
          {label}
        </span>
      </div>
      <div
        className={`mt-2 inline-block rounded-lg ${style.bg} px-2 py-1 text-xl font-bold ${style.text}`}
      >
        {formatNumber(value)}
      </div>
    </div>
  );
}
