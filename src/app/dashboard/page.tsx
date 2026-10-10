"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  CircleDollarSign,
  ClipboardList,
  Factory,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Workflow,
  X,
} from "lucide-react";
import PermissionGate from "@/components/auth/permission-gate";

type Product = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

type StatusSummary = {
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

type Transaction = {
  id: number;
  transactionNumber: string;
  quantity: number;
  createdAt: string;
  spk: { spkNumber: string };
  transactionType: { code: string; name: string };
  employee: { name: string };
};

type SPK = {
  id: number;
  spkNumber: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  items: Array<{
    id: number;
    quantity: number;
    product: { id: number; code: string; name: string };
  }>;
  tailor: { id: number; name: string };
  summary?: Pick<
    StatusSummary,
    "jumlahBarang" | "barangDiQc" | "sisaJahit" | "jumlahRijek" | "nextTransactionTypes"
  >;
};

type TrackingSPK = {
  id: number;
  spkNumber: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  items: Array<{
    id: number;
    productId: number;
    quantity: number;
    product: { id: number; code: string; name: string };
    summary: StatusSummary;
    transactions: Transaction[];
  }>;
  tailor: { id: number; name: string };
  summary: StatusSummary;
};

type BillingSummary = {
  readySpkCount: number;
  readyTailorCount: number;
  readyQuantity: number;
  readyAmount: number;
  missingRateSpkCount: number;
  missingRateQuantity: number;
  totalSpkChecked: number;
  readyItems: Array<{
    spkId: number;
    spkNumber: string;
    tailorId: number;
    tailorName: string;
    productId: number;
    productName: string;
    billableQuantity: number;
    rate: number;
    amount: number;
  }>;
  missingRateItems: Array<{
    spkId: number;
    spkNumber: string;
    tailorId: number;
    tailorName: string;
    productId: number;
    productName: string;
    billableQuantity: number;
  }>;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function transactionTone(code: string) {
  if (code === "QC_RIJEK") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (code === "QUALITY_CONTROL") return "bg-violet-50 text-violet-700 ring-violet-200";
  if (code === "QC_ACC_DIKIRIM_KE_GUDANG") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (code === "PENGIRIMAN_SIAP_JAHIT") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (code === "PENGIRIMAN_RIJEK") return "bg-orange-50 text-orange-700 ring-orange-200";
  if (code === "PENERIMAAN_RIJEK") return "bg-cyan-50 text-cyan-700 ring-cyan-200";
  return "bg-cyan-50 text-cyan-700 ring-cyan-200";
}

function transactionLabel(code: string) {
  switch (code) {
    case "PENGIRIMAN_SIAP_JAHIT":
      return "Pengiriman Siap Jahit";
    case "PENERIMAAN_DARI_PENJAHIT":
      return "Penerimaan dari Penjahit";
    case "QUALITY_CONTROL":
      return "Quality Control";
    case "QC_RIJEK":
      return "QC Rijek";
    case "PENGIRIMAN_RIJEK":
      return "Pengiriman Rijek";
    case "PENERIMAAN_RIJEK":
      return "Penerimaan Rijek";
    case "QC_ACC_DIKIRIM_KE_GUDANG":
      return "QC ACC";
    default:
      return code.replaceAll("_", " ");
  }
}

function emptySummary(): StatusSummary {
  return {
    totalPengiriman: 0,
    totalPenerimaan: 0,
    totalQcRijek: 0,
    totalQcAcc: 0,
    totalPengirimanRijek: 0,
    totalPenerimaanRijek: 0,
    sisaJahit: 0,
    barangDiQc: 0,
    jumlahRijek: 0,
    jumlahBarang: 0,
    nextTransactionTypes: [],
  };
}

export default function Home() {
  const [spks, setSpks] = useState<SPK[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [trackingSpks, setTrackingSpks] = useState<TrackingSPK[]>([]);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);

  const [billingLoading, setBillingLoading] = useState(true);
  const [generatingBilling, setGeneratingBilling] = useState(false);
  const [showBillingConfirm, setShowBillingConfirm] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("ACTIVE");
  const [filterSpk, setFilterSpk] = useState("ALL");
  const [filterProduct, setFilterProduct] = useState("ALL");
  const [filterTailor, setFilterTailor] = useState("ALL");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [activeMetric, setActiveMetric] = useState("ALL");

  async function loadDashboard(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      else setRefreshing(true);

      setError("");

      const [spkResponse, transactionResponse, productResponse, trackingResponse, billingResponse] =
        await Promise.all([
          fetch("/api/spks", { cache: "no-store" }),
          fetch("/api/transactions", { cache: "no-store" }),
          fetch("/api/products", { cache: "no-store" }),
          fetch("/api/tracking", { cache: "no-store" }),
          fetch("/api/tailor-billing/summary", { cache: "no-store" }),
        ]);

      if (!spkResponse.ok) throw new Error("Gagal mengambil data SPK.");
      if (!transactionResponse.ok) throw new Error("Gagal mengambil data transaksi.");
      if (!productResponse.ok) throw new Error("Gagal mengambil data produk.");
      if (!trackingResponse.ok) throw new Error("Gagal mengambil data tracking.");
      if (!billingResponse.ok) throw new Error("Gagal mengambil summary billing penjahit.");

      const [spkJson, transactionJson, productJson, trackingJson, billingJson] =
        await Promise.all([
          spkResponse.json(),
          transactionResponse.json(),
          productResponse.json(),
          trackingResponse.json(),
          billingResponse.json(),
        ]);

      if (!billingJson.success) {
        throw new Error(billingJson.error || "Gagal mengambil summary billing penjahit.");
      }

      setSpks(spkJson.data ?? []);
      setTransactions(transactionJson.data ?? []);
      setProducts(productJson.data ?? []);
      setTrackingSpks(trackingJson.data ?? []);
      setBillingSummary(billingJson.data ?? null);
      setBillingMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setBillingLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const activeSpks = useMemo(
    () => spks.filter((spk) => spk.status === "ACTIVE"),
    [spks],
  );

  const todayTransactions = useMemo(
    () => transactions.filter((transaction) => isToday(transaction.createdAt)),
    [transactions],
  );

  const filteredTrackingSpks = useMemo(() => {
    return trackingSpks.filter((spk) => {
      if (filterStatus !== "ALL" && spk.status !== filterStatus) return false;
      if (filterSpk !== "ALL" && String(spk.id) !== filterSpk) return false;
      if (filterTailor !== "ALL" && String(spk.tailor.id) !== filterTailor) return false;
      if (filterProduct !== "ALL" && !spk.items.some((item) => String(item.productId) === filterProduct)) return false;
      return true;
    });
  }, [trackingSpks, filterStatus, filterSpk, filterTailor, filterProduct]);

  const activeTrackingSpks = useMemo(
    () => filteredTrackingSpks.filter((spk) => filterStatus === "ACTIVE" ? spk.status === "ACTIVE" : true),
    [filteredTrackingSpks, filterStatus],
  );

  const filteredTransactions = useMemo(() => {
    const spkIds = new Set(filteredTrackingSpks.map((spk) => spk.id));
    const start = filterStartDate ? new Date(`${filterStartDate}T00:00:00`) : null;
    const end = filterEndDate ? new Date(`${filterEndDate}T23:59:59.999`) : null;
    return transactions.filter((transaction) => {
      const matchingSpk = spkIds.has((transaction as Transaction & { spkId?: number }).spkId ?? -1)
        || filteredTrackingSpks.some((spk) => spk.spkNumber === transaction.spk.spkNumber);
      if (!matchingSpk) return false;
      const date = new Date(transaction.createdAt);
      if (start && date < start) return false;
      if (end && date > end) return false;
      return true;
    });
  }, [transactions, filteredTrackingSpks, filterStartDate, filterEndDate]);

  const productionSummary = useMemo(() => {
    return activeTrackingSpks.reduce(
      (acc, spk) => {
        acc.total += Number(spk.summary.jumlahBarang ?? 0);
        acc.jahit += Number(spk.summary.sisaJahit ?? 0);
        acc.qc += Number(spk.summary.barangDiQc ?? 0);
        acc.rijek += Number(spk.summary.jumlahRijek ?? 0);
        acc.sent += Number(spk.summary.totalPengiriman ?? 0);
        acc.received += Number(spk.summary.totalPenerimaan ?? 0);
        acc.qcReject += Number(spk.summary.totalQcRijek ?? 0);
        acc.qcAcc += Number(spk.summary.totalQcAcc ?? 0);
        acc.rejectSent += Number(spk.summary.totalPengirimanRijek ?? 0);
        acc.rejectReceived += Number(spk.summary.totalPenerimaanRijek ?? 0);
        return acc;
      },
      {
        total: 0,
        jahit: 0,
        qc: 0,
        rijek: 0,
        sent: 0,
        received: 0,
        qcReject: 0,
        qcAcc: 0,
        rejectSent: 0,
        rejectReceived: 0,
      },
    );
  }, [activeTrackingSpks]);

  const rijekWaitingToSend = Math.max(
    productionSummary.qcReject - productionSummary.rejectSent,
    0,
  );

  const activeProductionRows = useMemo(() => {
    return activeTrackingSpks.flatMap((spk) =>
      spk.items.map((item) => {
        const summary = item.summary ?? emptySummary();
        return {
          spk,
          item,
          summary,
          nextAction:
            summary.nextTransactionTypes.length > 0
              ? transactionLabel(summary.nextTransactionTypes[0])
              : summary.jumlahBarang > 0
                ? "Dalam proses"
                : "Belum mulai",
        };
      }),
    );
  }, [activeTrackingSpks]);

  const metricProductionRows = useMemo(() => {
    if (activeMetric === "SPK Aktif") return activeProductionRows.filter(({ spk }) => spk.status === "ACTIVE");
    if (activeMetric === "Dalam proses") return activeProductionRows.filter(({ summary }) => summary.jumlahBarang > 0);
    if (activeMetric === "Menunggu QC") return activeProductionRows.filter(({ summary }) => summary.barangDiQc > 0);
    if (activeMetric === "Rijek / pengerjaan ulang") return activeProductionRows.filter(({ summary }) => summary.jumlahRijek > 0);
    return activeProductionRows;
  }, [activeProductionRows, activeMetric]);

  const recentTransactions = [...filteredTransactions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  const activeProducts = products.filter((product) => product.isActive);

  const stats = [
    {
      label: "SPK Aktif",
      value: formatNumber(filteredTrackingSpks.filter((spk) => spk.status === "ACTIVE").length),
      description: "SPK dengan status aktif",
      icon: ClipboardList,
      tone: "indigo",
    },
    {
      label: "Dalam proses",
      value: `${formatNumber(productionSummary.total)} pcs`,
      description: "Total barang yang masih diproses",
      icon: Factory,
      tone: "violet",
    },
    {
      label: "Menunggu QC",
      value: `${formatNumber(productionSummary.qc)} pcs`,
      description: "Barang menunggu pemeriksaan QC",
      icon: ShieldAlert,
      tone: "cyan",
    },
    {
      label: "Rijek / pengerjaan ulang",
      value: `${formatNumber(productionSummary.rijek)} pcs`,
      description: "Barang rijek yang sedang ditangani",
      icon: RefreshCw,
      tone: "emerald",
    },
  ] as const;

  async function generateAllBilling() {
    try {
      setGeneratingBilling(true);
      setBillingMessage("");
      setError("");

      const response = await fetch("/api/tailor-billing/generate-all", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal generate semua billing.");
      }

      const data = result.data;
      setShowBillingConfirm(false);
      setBillingMessage(
        data.createdBills > 0
          ? `${data.createdBills} billing berhasil dibuat sebagai Draft.`
          : result.message || "Tidak ada billing yang dibuat.",
      );
      await loadDashboard(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate semua billing.");
    } finally {
      setGeneratingBilling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white px-5 py-4 text-sm font-semibold text-indigo-600 shadow-xl shadow-indigo-100">
          <Loader2 className="h-5 w-5 animate-spin" />
          Memuat data dashboard...
        </div>
      </div>
    );
  }

  const toneMap = {
    indigo: { icon: "bg-indigo-50 text-indigo-600", value: "text-indigo-700", ring: "hover:border-indigo-200" },
    cyan: { icon: "bg-cyan-50 text-cyan-600", value: "text-cyan-700", ring: "hover:border-cyan-200" },
    violet: { icon: "bg-violet-50 text-violet-600", value: "text-violet-700", ring: "hover:border-violet-200" },
    emerald: { icon: "bg-emerald-50 text-emerald-600", value: "text-emerald-700", ring: "hover:border-emerald-200" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/10 to-violet-50/10">
      <main className="min-h-screen min-w-0 pb-24 lg:pb-0">
        <div className="relative mx-auto w-full max-w-[1680px] p-4 sm:p-6 xl:p-7">
          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-indigo-300/15 blur-3xl" />
          <div className="pointer-events-none absolute left-0 top-40 h-64 w-64 rounded-full bg-violet-300/10 blur-3xl" />

          <div className="relative mb-6 sm:mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-indigo-600 shadow-sm sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sistem operasional
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                  Ringkasan Operasional
                </h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">
                  Pantau progres produksi, pekerjaan penjahit, dan aktivitas transaksi dari satu halaman.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadDashboard(false)}
                disabled={refreshing}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="relative mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError("")} className="rounded-lg p-1 hover:bg-rose-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <section className="relative mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Filter data dashboard</h3>
                <p className="mt-1 text-xs text-slate-500">Status, SPK, produk, dan penjahit memfilter posisi produksi. Tanggal hanya memfilter daftar aktivitas transaksi.</p>
              </div>
              <button type="button" onClick={() => {
                setFilterStatus("ACTIVE"); setFilterSpk("ALL"); setFilterProduct("ALL");
                setFilterTailor("ALL"); setFilterStartDate(""); setFilterEndDate(""); setActiveMetric("ALL");
              }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                Reset semua filter
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Status SPK</span>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                  <option value="ALL">Semua status</option><option value="ACTIVE">Aktif</option><option value="COMPLETED">Selesai</option><option value="CANCELLED">Dibatalkan</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">SPK</span>
                <select value={filterSpk} onChange={(e) => setFilterSpk(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                  <option value="ALL">Semua SPK</option>{trackingSpks.map((spk) => <option key={spk.id} value={String(spk.id)}>{spk.spkNumber}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Produk</span>
                <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                  <option value="ALL">Semua produk</option>{products.map((product) => <option key={product.id} value={String(product.id)}>{product.code} — {product.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Penjahit</span>
                <select value={filterTailor} onChange={(e) => setFilterTailor(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                  <option value="ALL">Semua penjahit</option>{Array.from(new Map(trackingSpks.map((spk) => [spk.tailor.id, spk.tailor.name])).entries()).map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Transaksi dari</span>
                <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Transaksi sampai</span>
                <input type="date" min={filterStartDate || undefined} value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </label>
            </div>
            <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-slate-500">Hasil posisi produksi: <span className="font-semibold text-slate-700">{formatNumber(filteredTrackingSpks.length)} SPK</span></p>
              <p className="text-[11px] text-slate-500">Aktivitas pada rentang tanggal: <span className="font-semibold text-slate-700">{formatNumber(filteredTransactions.length)} transaksi</span></p>
            </div>
          </section>

          <section className="relative mb-3">
            <h3 className="text-base font-bold text-slate-800">Ringkasan utama</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Pilih kartu untuk melihat rincian yang berkaitan pada tabel detail produksi.</p>
          </section>

          <div className="relative mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              const tone = toneMap[stat.tone];
              return (
                <button type="button" key={stat.label} onClick={() => setActiveMetric(activeMetric === stat.label ? "ALL" : stat.label)} className={`group rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${activeMetric === stat.label ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"} ${tone.ring} sm:p-5`}>
                  <div className="mb-4 flex items-center justify-between">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${tone.icon}`}>
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <span className="hidden rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:inline-flex">
                      Live
                    </span>
                  </div>
                  <p className={`text-xl font-bold sm:text-2xl ${tone.value}`}>{stat.value}</p>
                  <p className="mt-1.5 text-xs font-bold text-slate-700 sm:text-sm">{stat.label}</p>
                  <p className="mt-1 hidden text-xs text-slate-400 sm:block">{stat.description}</p>
                <p className="mt-3 text-[10px] font-semibold text-indigo-500">{activeMetric === stat.label ? "Filter aktif · klik untuk reset" : "Klik untuk memfilter detail"}</p>
              </button>
              );
            })}
          </div>

          <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-slate-200/40">
            <div className="border-b border-indigo-50 px-4 py-4 sm:px-6 sm:py-5">
              <h3 className="text-sm font-bold text-slate-800">Posisi produksi saat ini</h3>
              <p className="mt-1 text-xs text-slate-400">
                Posisi produksi sesuai filter aktif; pilih status Aktif untuk melihat pekerjaan yang masih berjalan.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-6">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Total Dalam proses
                </p>
                <p className="mt-2 text-xl font-bold text-slate-800">
                  {formatNumber(productionSummary.total)} pcs
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Jahit + QC + Rework
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">
                  Sedang Jahit
                </p>
                <p className="mt-2 text-xl font-bold text-blue-700">
                  {formatNumber(productionSummary.jahit)} pcs
                </p>
                <p className="mt-1 text-[10px] text-blue-500">
                  Belum diterima dari penjahit
                </p>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">
                  Di QC
                </p>
                <p className="mt-2 text-xl font-bold text-violet-700">
                  {formatNumber(productionSummary.qc)} pcs
                </p>
                <p className="mt-1 text-[10px] text-violet-500">
                  Menunggu proses QC
                </p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
                  Rijek / pengerjaan ulang
                </p>
                <p className="mt-2 text-xl font-bold text-amber-700">
                  {formatNumber(productionSummary.rijek)} pcs
                </p>
                <p className="mt-1 text-[10px] text-amber-600">
                  Sedang dikerjakan ulang
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 px-4 py-3 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Rekap aktivitas produksi
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Akumulasi transaksi tercatat; angka ini bukan jumlah stok fisik.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
              {[
                ["Dikirim", productionSummary.sent, "bg-blue-50", "text-blue-700"],
                ["Diterima", productionSummary.received, "bg-cyan-50", "text-cyan-700"],
                ["QC Rijek", productionSummary.qcReject, "bg-amber-50", "text-amber-700"],
                ["Dikirim Rework", productionSummary.rejectSent, "bg-orange-50", "text-orange-700"],
                ["Kembali Rework", productionSummary.rejectReceived, "bg-emerald-50", "text-emerald-700"],
                ["QC ACC", productionSummary.qcAcc, "bg-emerald-50", "text-emerald-700"],
              ].map(([label, value, bg, color]) => (
                <div key={String(label)} className={`rounded-2xl ${bg} p-3`}>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  <p className={`mt-1 text-base font-bold ${color}`}>
                    {formatNumber(Number(value))} pcs
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between border-b border-indigo-50 px-4 py-4 sm:px-6 sm:py-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Detail produksi aktif</h3>
                <p className="mt-1 text-xs text-slate-400">Rincian posisi barang berdasarkan SPK dan produk.</p>
              </div>
              <Link href="/operations/tracking" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Buka tracking</Link>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-4 sm:grid-cols-4 sm:px-6">
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total Process</p><p className="mt-1 text-lg font-bold text-slate-800">{formatNumber(productionSummary.total)} pcs</p></div>
              <div className="rounded-2xl bg-blue-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">Jahit</p><p className="mt-1 text-lg font-bold text-blue-700">{formatNumber(productionSummary.jahit)} pcs</p></div>
              <div className="rounded-2xl bg-violet-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">QC</p><p className="mt-1 text-lg font-bold text-violet-700">{formatNumber(productionSummary.qc)} pcs</p></div>
              <div className="rounded-2xl bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Rijek / pengerjaan ulang</p><p className="mt-1 text-lg font-bold text-amber-700">{formatNumber(productionSummary.rijek)} pcs</p></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="border-b border-indigo-50 bg-gradient-to-r from-indigo-50/70 to-violet-50/50">
                    {['SPK','Product','Penjahit','Qty SPK','Jahit','QC','Rijek','Proses','Next Action'].map((head, i) => (
                      <th key={head} className={`px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-400 ${i >= 3 && i <= 7 ? 'text-right' : ''}`}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricProductionRows.slice(0, 10).map(({ spk, item, summary, nextAction }) => (
                    <tr key={`${spk.id}-${item.id}`} className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/30">
                      <td className="px-6 py-4"><Link href={`/operations/spk/${spk.id}`} className="font-bold text-indigo-600 hover:text-indigo-700">{spk.spkNumber}</Link></td>
                      <td className="px-6 py-4"><p className="font-semibold text-slate-700">{item.product?.name ?? '-'}</p><p className="text-[10px] text-slate-400">{item.product?.code ?? '-'}</p></td>
                      <td className="px-6 py-4 text-slate-600">{spk.tailor.name}</td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-700">{formatNumber(item.quantity)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-blue-700">{formatNumber(summary.sisaJahit)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-violet-700">{formatNumber(summary.barangDiQc)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-amber-700">{formatNumber(summary.jumlahRijek)}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-800">{formatNumber(summary.jumlahBarang)}</td>
                      <td className="px-6 py-4"><span className="inline-flex max-w-[190px] rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">{nextAction}</span></td>
                    </tr>
                  ))}
                  {metricProductionRows.length === 0 && <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-400">Tidak ada data yang sesuai dengan filter aktif.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="relative mt-6 overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-xl shadow-slate-200/40">
            <div className="border-b border-amber-100 px-4 py-4 sm:px-6 sm:py-5">
              <h3 className="text-sm font-bold text-slate-800">Rijek / pengerjaan ulang Monitoring</h3>
              <p className="mt-1 text-xs text-slate-400">Pantau barang yang perlu dikirim ulang, dikerjakan ulang, atau diperiksa kembali.</p>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-6">
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-600" /><p className="text-xs font-bold text-amber-700">Total QC Rijek</p></div><p className="mt-2 text-2xl font-bold text-amber-800">{formatNumber(productionSummary.qcReject)} pcs</p><p className="mt-1 text-[11px] text-amber-600">Total rejection yang tercatat.</p></div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4"><div className="flex items-center gap-2"><Send className="h-4 w-4 text-orange-600" /><p className="text-xs font-bold text-orange-700">Belum Dikirim Rework</p></div><p className="mt-2 text-2xl font-bold text-orange-800">{formatNumber(rijekWaitingToSend)} pcs</p><p className="mt-1 text-[11px] text-orange-600">Rijek sudah QC tetapi belum dikirim kembali.</p></div>
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-red-600" /><p className="text-xs font-bold text-red-700">Sedang Rework</p></div><p className="mt-2 text-2xl font-bold text-red-800">{formatNumber(productionSummary.rijek)} pcs</p><p className="mt-1 text-[11px] text-red-600">Sudah dikirim ke penjahit dan belum kembali.</p></div>
            </div>
          </section>

          <div className="relative mt-6 grid gap-6 xl:grid-cols-3">
            <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-slate-200/50 xl:col-span-2">
              <div className="flex items-center justify-between border-b border-indigo-50 px-4 py-4 sm:px-6 sm:py-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Aktivitas transaksi terbaru</h3>
                  <p className="mt-1 text-xs text-slate-400">Lima transaksi terbaru sesuai filter yang dipilih.</p>
                </div>
                <Link href="/operations/transactions" className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700">Lihat semua <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
              {recentTransactions.length === 0 ? (
                <div className="px-6 py-14 text-center"><Activity className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-600">Belum ada transaksi</p><p className="mt-1 text-xs text-slate-400">Transaksi akan muncul setelah aktivitas dicatat.</p></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex gap-3 px-4 py-4 transition hover:bg-indigo-50/30 sm:items-center sm:justify-between sm:gap-4 sm:px-6">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Activity className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-800">{transaction.transactionType.name}</p>
                          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-400 sm:text-xs">
                            <span>{transaction.transactionNumber}</span><span className="hidden sm:inline">•</span><span>{transaction.spk.spkNumber}</span><span className="hidden sm:inline">•</span><span className="hidden sm:inline">{transaction.employee.name}</span>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-400 sm:hidden">{transaction.employee.name}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-slate-800">{formatNumber(transaction.quantity)}</p>
                        <p className="text-[9px] uppercase tracking-wide text-slate-400 sm:text-[10px]">units</p>
                        <p className="mt-1 hidden text-xs font-medium text-slate-500 sm:block">{formatTime(transaction.createdAt)}</p>
                        <span className={`mt-1 hidden rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 sm:inline-flex ${transactionTone(transaction.transactionType.code)}`}>Recorded</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-slate-200/50">
              <div className="border-b border-indigo-50 px-4 py-4 sm:px-6 sm:py-5">
                <h3 className="text-sm font-bold text-slate-800">Akses cepat</h3>
                <p className="mt-1 text-xs text-slate-400">Pintasan untuk pekerjaan operasional</p>
              </div>
              <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 xl:grid-cols-1">
                <QuickAction href="/operations/spk" icon={ClipboardList} title="Buat SPK" description="Buat perintah produksi baru" />
                <QuickAction href="/operations/transactions" icon={Activity} title="Catat transaksi" description="Catat aktivitas produksi" />
                <QuickAction href="/operations/tracking" icon={BarChart3} title="Tracking produksi" description="Pantau perjalanan produksi" />
                <QuickAction href="/automation/workflows" icon={Workflow} title="Kelola workflow" description="Atur alur proses bisnis" />
              </div>
              <div className="border-t border-slate-100 px-4 py-4 text-xs text-slate-400">
                Produk aktif: <span className="font-bold text-slate-600">{formatNumber(activeProducts.length)}</span>
                <span className="mx-2">•</span>
                Transaksi hari ini: <span className="font-bold text-slate-600">{formatNumber(todayTransactions.length)}</span>
              </div>
            </div>
          </div>

          <PermissionGate permission="tailor-billing.view">
            <section className="relative mt-6 overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-xl shadow-indigo-100/40">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-indigo-100/50 blur-3xl" />
              <div className="relative p-4 sm:p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 sm:h-12 sm:w-12 sm:rounded-2xl"><CircleDollarSign className="h-5 w-5 sm:h-6 sm:w-6" /></div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-800 sm:text-base">Billing Penjahit</h3><span className="rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-indigo-600 sm:px-2.5 sm:text-[10px]">Live</span></div>
                      <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">Quantity QC ACC yang sudah siap dibuatkan billing.</p>
                    </div>
                  </div>
                  {billingLoading ? <div className="flex items-center gap-2 text-xs font-medium text-slate-400 sm:text-sm"><Loader2 className="h-4 w-4 animate-spin" />Menghitung billing...</div> : billingSummary ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                      <BillingMetric label="SPK Siap" value={formatNumber(billingSummary.readySpkCount)} />
                      <BillingMetric label="Penjahit" value={formatNumber(billingSummary.readyTailorCount)} />
                      <BillingMetric label="Quantity" value={`${formatNumber(billingSummary.readyQuantity)} pcs`} />
                      <BillingMetric label="Estimasi" value={formatCurrency(billingSummary.readyAmount)} />
                    </div>
                  ) : <div className="text-xs text-slate-400 sm:text-sm">Data billing tidak tersedia.</div>}
                </div>

                {billingSummary && billingSummary.readySpkCount > 0 && (
                  <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-5 lg:flex-row lg:items-center lg:justify-between">
                    <div><p className="text-sm font-semibold text-slate-700">Ada {formatNumber(billingSummary.readySpkCount)} SPK yang siap ditagihkan.</p><p className="mt-1 text-xs text-slate-400">Generate akan membuat satu Draft Billing untuk setiap penjahit.</p></div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                      <Link href="/master/tailor-billing" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 sm:w-auto">Lihat Billing <ArrowRight className="h-4 w-4" /></Link>
                      <PermissionGate permission="tailor-billing.create">
                        <button type="button" onClick={() => setShowBillingConfirm(true)} disabled={generatingBilling} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"><CircleDollarSign className="h-4 w-4" />Generate Semua Billing</button>
                      </PermissionGate>
                    </div>
                  </div>
                )}

                {billingSummary && billingSummary.readySpkCount === 0 && (
                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Check className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-700">Tidak ada billing yang menunggu dibuat.</p><p className="mt-1 text-xs text-slate-400">Semua quantity yang saat ini sudah memenuhi syarat telah ditagihkan.</p></div></div>
                    <Link href="/master/tailor-billing" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700">Lihat Billing <ArrowRight className="h-4 w-4" /></Link>
                  </div>
                )}

                {billingSummary && billingSummary.missingRateSpkCount > 0 && (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div><p className="text-xs font-bold text-amber-800">Ada {formatNumber(billingSummary.missingRateSpkCount)} SPK yang belum memiliki tarif penjahit.</p><p className="mt-1 text-xs text-amber-700">SPK tersebut tidak akan ikut dalam Generate Semua Billing.</p></div></div>
                )}

                {billingMessage && <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700 sm:text-sm"><Check className="h-4 w-4 shrink-0" />{billingMessage}</div>}
              </div>
            </section>
          </PermissionGate>
        </div>
      </main>

      {showBillingConfirm && billingSummary && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between"><div><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><CircleDollarSign className="h-5 w-5" /></div><h3 className="text-lg font-bold text-slate-800">Generate Semua Billing?</h3><p className="mt-1 text-sm text-slate-500">Sistem akan membuat billing sebagai <strong>Draft</strong>.</p></div><button type="button" onClick={() => setShowBillingConfirm(false)} disabled={generatingBilling} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button></div>
            </div>
            <div className="space-y-3 px-5 py-5 sm:px-6">
              <div className="rounded-2xl bg-slate-50 p-4"><div className="grid grid-cols-2 gap-4">
                <ConfirmMetric label="Penjahit" value={formatNumber(billingSummary.readyTailorCount)} />
                <ConfirmMetric label="SPK" value={formatNumber(billingSummary.readySpkCount)} />
                <ConfirmMetric label="Quantity" value={`${formatNumber(billingSummary.readyQuantity)} pcs`} />
                <ConfirmMetric label="Estimasi Total" value={formatCurrency(billingSummary.readyAmount)} accent />
              </div></div>
              <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-xs leading-5 text-cyan-700">Generate hanya membuat <strong>Draft Billing</strong>. Pembayaran tetap harus melalui proses Submit dan Pay.</div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
              <button type="button" onClick={() => setShowBillingConfirm(false)} disabled={generatingBilling} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 disabled:opacity-50 sm:w-auto">Batal</button>
              <PermissionGate permission="tailor-billing.create">
                <button type="button" onClick={generateAllBilling} disabled={generatingBilling} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{generatingBilling ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : <><Check className="h-4 w-4" />Generate Billing</>}</button>
              </PermissionGate>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BillingMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 sm:min-w-[120px] sm:rounded-2xl sm:px-4 sm:py-3"><p className="truncate text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">{label}</p><p className="mt-1 truncate text-xs font-bold text-slate-800 sm:text-sm">{value}</p></div>;
}

function ConfirmMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div><p className="text-xs text-slate-400">{label}</p><p className={`mt-1 text-lg font-bold ${accent ? "text-indigo-700" : "text-slate-800"}`}>{value}</p></div>;
}

function QuickAction({ href, icon: Icon, title, description }: { href: string; icon: typeof Activity; title: string; description: string }) {
  return <Link href={href} className="group flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-indigo-50/60 hover:shadow-sm"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100 transition group-hover:bg-indigo-600 group-hover:text-white"><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-sm font-bold text-slate-700">{title}</p><p className="mt-0.5 text-xs text-slate-400">{description}</p></div><ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" /></Link>;
}
