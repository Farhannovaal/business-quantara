"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Loader2, RefreshCw, Search } from "lucide-react";

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

const numberFormat = new Intl.NumberFormat("id-ID");
const dateToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const fmt = (value: number) => numberFormat.format(Number(value || 0));
const fmtPercent = (value: number) => `${Number(value || 0).toLocaleString("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})}%`;
const fmtDate = (value: string) => new Date(value).toLocaleString("id-ID", {
  timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short",
});

export default function ProductionReportPage() {
  const today = useMemo(() => dateToday(), []);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"position" | "activity">("position");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED">("ALL");
  const [activeMetric, setActiveMetric] = useState<"all" | "spk" | "transactions" | "quantity" | "sewing" | "qc" | "reject">("all");

  const loadReport = useCallback(async () => {
    if (!startDate || !endDate) {
      setError("Tanggal awal dan akhir wajib diisi.");
      return;
    }
    if (startDate > endDate) {
      setError("Tanggal awal tidak boleh melewati tanggal akhir.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/reports/production?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
        { cache: "no-store" },
      );
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Gagal memuat laporan produksi.");
      setData(json.data as ReportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat laporan.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  const filteredSpks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.position.spks ?? []).filter((spk) => {
      const matchesStatus = statusFilter === "ALL" || spk.currentStatus === statusFilter;
      const matchesSearch = !query || spk.spkNumber.toLowerCase().includes(query) ||
        spk.tailor.name.toLowerCase().includes(query) ||
        spk.items.some((item) => `${item.product.code} ${item.product.name}`.toLowerCase().includes(query));
      const matchesMetric = activeMetric === "all" || activeMetric === "spk" ||
        (activeMetric === "sewing" && spk.items.some((item) => item.summary.sisaJahit > 0)) ||
        (activeMetric === "qc" && spk.items.some((item) => item.summary.barangDiQc > 0)) ||
        (activeMetric === "reject" && spk.items.some((item) => item.summary.jumlahRijek > 0));
      return matchesStatus && matchesSearch && matchesMetric;
    });
  }, [data, search, statusFilter, activeMetric]);

  const filteredTransactions = useMemo(() => {
    const transactions = data?.activity.transactions ?? [];
    if (activeMetric === "quantity") return transactions.filter((tx) => tx.quantity > 0);
    return transactions;
  }, [data, activeMetric]);

  const selectMetric = (metric: typeof activeMetric) => {
    setActiveMetric(metric);
    setTab(metric === "transactions" || metric === "quantity" ? "activity" : "position");
  };

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = tab === "activity"
      ? [["Waktu", "Nomor Transaksi", "SPK", "Produk", "Penjahit", "Jenis Transaksi", "Jumlah", "Petugas"],
        ...filteredTransactions.map((tx) => [fmtDate(tx.createdAt), tx.transactionNumber, tx.spk.spkNumber,
          `${tx.product.code} - ${tx.product.name}`, tx.tailor.name, tx.transactionType.name, tx.quantity, tx.employee.name])]
      : [["SPK", "Status saat ini", "Penjahit", "Kode Produk", "Produk", "Target", "Qty QC ACC", "Progress SPK (%)", "Progress Produk (%)", "Pengiriman", "Penerimaan", "Sisa Jahit", "Barang di QC", "QC ACC", "QC Rijek", "Sisa Rijek", "Total Posisi"],
        ...filteredSpks.flatMap((spk) => spk.items.map((item) => [spk.spkNumber, spk.currentStatus, spk.tailor.name,
          item.product.code, item.product.name, item.targetQuantity, item.completedQuantity, spk.progressPercent, item.progressPercent, item.summary.totalPengiriman,
          item.summary.totalPenerimaan, item.summary.sisaJahit, item.summary.barangDiQc,
          item.summary.totalQcAcc, item.summary.totalQcRijek, item.summary.jumlahRijek, item.summary.jumlahBarang]))];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-produksi-${tab}-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totals = data?.position.totals;
  const statCards = [
    { label: "SPK dalam periode", value: data?.position.spkCount ?? 0, detail: "SPK dibuat sampai akhir tanggal laporan" },
    { label: "Transaksi periode", value: data?.activity.transactionCount ?? 0, detail: "Transaksi pada rentang terpilih" },
    { label: "Kuantitas transaksi", value: data?.activity.quantity ?? 0, detail: "Jumlah unit transaksi dalam periode" },
    { label: "Sisa jahit akhir periode", value: totals?.sisaJahit ?? 0, detail: "Posisi produksi sampai akhir tanggal" },
    { label: "Barang di QC", value: totals?.barangDiQc ?? 0, detail: "Posisi QC akhir periode" },
    { label: "Sisa rijek", value: totals?.jumlahRijek ?? 0, detail: "Rijek yang belum diterima kembali" },
  ];

  return (
    <main className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Laporan</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Laporan Produksi</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Analisis aktivitas transaksi dan posisi produksi historis berdasarkan rentang tanggal.</p>
        </div>
        <button onClick={exportCsv} disabled={!data || loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><CalendarDays className="h-4 w-4" /> Periode laporan </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-sm text-slate-600">Tanggal awal<input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          <label className="block text-sm text-slate-600">Tanggal akhir<input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          <button onClick={() => void loadReport()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Tampilkan
          </button>
        </div>
      </section>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && !data && <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Memuat laporan...</div>}

      {data && <>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Progress produksi keseluruhan</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {fmtPercent(data.position.progressPercent)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {fmt(data.position.completedQuantity)} dari {fmt(data.position.targetQuantity)} unit target telah lolos QC (ACC).
              </p>
            </div>
            <div className="w-full sm:max-w-sm">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>Target diterima QC</span>
                <span className="font-semibold text-slate-700">{fmtPercent(data.position.progressPercent)}</span>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label="Progress produksi keseluruhan"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(data.position.progressPercent)}
              >
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, data.position.progressPercent))}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {statCards.map((card, index) => {
            const metricByIndex = ["spk", "transactions", "quantity", "sewing", "qc", "reject"] as const;
            const metric = metricByIndex[index];
            const active = activeMetric === metric;
            return <button key={card.label} type="button" onClick={() => selectMetric(metric)} aria-pressed={active}
              className={`group rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${active ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-3"><p className={`text-sm ${active ? "font-semibold text-blue-700" : "text-slate-500"}`}>{card.label}</p><span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700"}`}>{active ? "Dipilih" : "Lihat data"}</span></div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{fmt(card.value)}</p><p className="mt-1 text-xs text-slate-500">{card.detail}</p>
            </button>;
          })}
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
            <div><h2 className="font-semibold text-slate-900">Detail laporan</h2><p className="mt-1 text-xs text-slate-500">{data.period.startDate} — {data.period.endDate}</p></div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button onClick={() => setTab("position")} className={`rounded-md px-3 py-2 text-sm font-medium ${tab === "position" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>Posisi produksi</button>
                <button onClick={() => setTab("activity")} className={`rounded-md px-3 py-2 text-sm font-medium ${tab === "activity" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>Aktivitas transaksi</button>
              </div>
              {tab === "position" && <div className="flex flex-col gap-2 sm:flex-row">
                <label className="text-xs font-medium text-slate-500">Status SPK<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 sm:w-40"><option value="ALL">Semua status</option><option value="ACTIVE">Aktif</option><option value="COMPLETED">Selesai</option><option value="CANCELLED">Dibatalkan</option></select></label>
                <label className="relative block self-end"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari SPK, produk, penjahit" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 sm:w-64" /></label>
                {(statusFilter !== "ALL" || search || activeMetric !== "all") && <button type="button" onClick={() => { setStatusFilter("ALL"); setSearch(""); setActiveMetric("all"); }} className="self-end rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Reset filter</button>}
              </div>}
            </div>
          </div>

          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
            {activeMetric === "all" && "Menampilkan seluruh data sesuai filter status dan pencarian."}
            {activeMetric === "spk" && "Ringkasan SPK dipilih: daftar menampilkan SPK sesuai status dan pencarian."}
            {activeMetric === "transactions" && "Kartu Transaksi periode dipilih: menampilkan aktivitas transaksi pada rentang tanggal."}
            {activeMetric === "quantity" && "Kartu Kuantitas transaksi dipilih: menampilkan transaksi dengan kuantitas lebih dari 0."}
            {activeMetric === "sewing" && "Kartu Sisa jahit dipilih: hanya SPK yang masih memiliki sisa jahit."}
            {activeMetric === "qc" && "Kartu Barang di QC dipilih: hanya SPK yang memiliki barang dalam proses QC."}
            {activeMetric === "reject" && "Kartu Sisa rijek dipilih: hanya SPK yang memiliki sisa barang rijek."}
            <span className="ml-2 font-semibold">{tab === "position" ? `${filteredSpks.length} SPK ditampilkan` : `${filteredTransactions.length} transaksi ditampilkan`}</span>
          </div>
          {tab === "position" ? <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
                <th className="px-4 py-3 font-semibold">SPK / Penjahit</th><th className="px-4 py-3 font-semibold">Produk</th><th className="px-4 py-3 font-semibold">Progress SPK</th><th className="px-4 py-3 text-right font-semibold">Target</th><th className="px-4 py-3 text-right font-semibold">Pengiriman</th><th className="px-4 py-3 text-right font-semibold">Penerimaan</th><th className="px-4 py-3 text-right font-semibold">Sisa jahit</th><th className="px-4 py-3 text-right font-semibold">Di QC</th><th className="px-4 py-3 text-right font-semibold">QC ACC</th><th className="px-4 py-3 text-right font-semibold">QC rijek</th><th className="px-4 py-3 text-right font-semibold">Sisa rijek</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredSpks.flatMap((spk) => spk.items.map((item) => <tr key={`${spk.id}-${item.id}`} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-semibold text-slate-900">{spk.spkNumber}</div><div className="mt-0.5 text-xs text-slate-500">{spk.tailor.name}</div><div className="mt-1 text-[11px] text-slate-400">Status saat ini: {spk.currentStatus}</div></td>
                <td className="px-4 py-3"><div className="font-medium text-slate-800">{item.product.name}</div><div className="text-xs text-slate-500">{item.product.code}</div></td>
                <td className="px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-800">{fmtPercent(spk.progressPercent)}</span>
                    <span className="text-slate-500">{fmt(spk.completedQuantity)}/{fmt(spk.targetQuantity)}</span>
                  </div>
                  <div className="h-2 min-w-28 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Progress SPK ${spk.spkNumber}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spk.progressPercent)}>
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, spk.progressPercent))}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(item.targetQuantity)}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(item.summary.totalPengiriman)}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(item.summary.totalPenerimaan)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(item.summary.sisaJahit)}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(item.summary.barangDiQc)}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(item.summary.totalQcAcc)}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(item.summary.totalQcRijek)}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(item.summary.jumlahRijek)}</td>
              </tr>))}</tbody>
            </table>
            {filteredSpks.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Tidak ada data SPK yang cocok dengan pencarian.</div>}
          </div> : <div className="overflow-x-auto">
            <table className="min-w-[950px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Nomor transaksi</th><th className="px-4 py-3">SPK</th><th className="px-4 py-3">Produk</th><th className="px-4 py-3">Jenis transaksi</th><th className="px-4 py-3">Penjahit</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3">Petugas</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredTransactions.map((tx) => <tr key={tx.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(tx.createdAt)}</td><td className="px-4 py-3 font-medium text-slate-900">{tx.transactionNumber}</td><td className="px-4 py-3">{tx.spk.spkNumber}</td><td className="px-4 py-3"><div>{tx.product.name}</div><div className="text-xs text-slate-500">{tx.product.code}</div></td><td className="px-4 py-3">{tx.transactionType.name}</td><td className="px-4 py-3">{tx.tailor.name}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(tx.quantity)}</td><td className="px-4 py-3">{tx.employee.name}</td></tr>)}</tbody></table>
            {filteredTransactions.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Tidak ada transaksi yang cocok dengan kartu terpilih.</div>}
          </div>}
        </section>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Catatan interpretasi laporan</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{data.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          <p className="mt-2">Kolom status SPK menunjukkan status saat ini, bukan status pada akhir periode. Riwayat pembatalan historis belum tersedia di schema.</p>
        </div>
      </>}
    </main>
  );
}
