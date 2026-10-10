"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Loader2, Package, RefreshCw, Search, UserRound, X } from "lucide-react";

type Product = { id: number; code: string; name: string };
type SPKItem = { id: number; productId: number; quantity: number; product: Product };
type SPKSummary = {
  totalPengiriman: number; totalPenerimaan: number; totalQcRijek: number; totalQcAcc: number;
  totalPengirimanRijek: number; totalPenerimaanRijek: number; sisaJahit: number; barangDiQc: number;
  jumlahRijek: number; jumlahBarang: number; nextTransactionTypes: string[];
};
type ProductSummary = { productId: number; product: Product; quantity: number; summary: SPKSummary };
type SPK = {
  id: number; spkNumber: string; status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  items: SPKItem[]; tailor: { id: number; name: string }; summary?: SPKSummary; productSummaries?: ProductSummary[];
};
type TransactionType = { id: number; code: string; name: string; sequence: number; isActive: boolean };
type Employee = { id: number; name: string; isActive: boolean };
type Transaction = {
  id: number; transactionNumber: string; quantity: number; createdAt: string;
  spk: { spkNumber: string }; product?: Product;
  transactionType: { code: string; name: string }; employee: { name: string };
};

function getMaxQuantity(productQuantity: number, summary: SPKSummary, code: string): number {
  switch (code) {
    case "PENGIRIMAN_SIAP_JAHIT": return Math.max(productQuantity - summary.totalPengiriman, 0);
    case "PENERIMAAN_DARI_PENJAHIT": return summary.sisaJahit;
    case "QUALITY_CONTROL":
    case "QC_RIJEK":
    case "QC_ACC_DIKIRIM_KE_GUDANG": return summary.barangDiQc;
    case "PENGIRIMAN_RIJEK": return Math.max(summary.totalQcRijek - summary.totalPengirimanRijek, 0);
    case "PENERIMAAN_RIJEK": return Math.max(summary.totalPengirimanRijek - summary.totalPenerimaanRijek, 0);
    default: return 0;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function TransactionsPage() {
  const [spks, setSpks] = useState<SPK[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedSpkId, setSelectedSpkId] = useState("");
  const [selectedSpk, setSelectedSpk] = useState<SPK | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [quantityByProduct, setQuantityByProduct] = useState<Record<number, string>>({});
  const [searchSpk, setSearchSpk] = useState("");
  const [searchTransaction, setSearchTransaction] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSpk, setLoadingSpk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadInitialData() {
    try {
      setLoading(true); setError("");
      const [spkRes, typeRes, employeeRes, transactionRes] = await Promise.all([
        fetch("/api/spks"), fetch("/api/transaction-types?forTransaction=true"),
        fetch("/api/employees"), fetch("/api/transactions"),
      ]);
      if (!spkRes.ok) throw new Error("Gagal mengambil data SPK.");
      if (!typeRes.ok) throw new Error("Gagal mengambil transaction type.");
      if (!employeeRes.ok) throw new Error("Gagal mengambil data karyawan.");
      if (!transactionRes.ok) throw new Error("Gagal mengambil riwayat transaksi.");
      const [spkJson, typeJson, employeeJson, transactionJson] = await Promise.all([
        spkRes.json(), typeRes.json(), employeeRes.json(), transactionRes.json(),
      ]);
      setSpks(spkJson.data ?? []);
      setTransactionTypes(typeJson.data ?? []);
      setEmployees((employeeJson.data ?? []).filter((employee: Employee) => employee.isActive));
      setTransactions(transactionJson.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat mengambil data.");
    } finally { setLoading(false); }
  }

  async function loadSpkDetail(id: string) {
    if (!id) { setSelectedSpk(null); setQuantityByProduct({}); setSelectedTypeId(""); return; }
    try {
      setLoadingSpk(true); setError(""); setSuccess("");
      const response = await fetch(`/api/spks/${id}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Gagal mengambil detail SPK.");
      setSelectedSpk(json.data);
      setQuantityByProduct({}); setSelectedTypeId("");
    } catch (e) {
      setSelectedSpk(null); setQuantityByProduct({});
      setError(e instanceof Error ? e.message : "Gagal mengambil detail SPK.");
    } finally { setLoadingSpk(false); }
  }

  useEffect(() => { void loadInitialData(); }, []);
  useEffect(() => { void loadSpkDetail(selectedSpkId); }, [selectedSpkId]);

  const selectedType = useMemo(() => transactionTypes.find((t) => String(t.id) === selectedTypeId), [transactionTypes, selectedTypeId]);
  const availableTypes = useMemo(() => {
    if (!selectedSpk) return [];
    const allowed = new Set((selectedSpk.productSummaries ?? []).flatMap((p) => p.summary.nextTransactionTypes));
    return transactionTypes.filter((t) => t.isActive && allowed.has(t.code)).sort((a, b) => a.sequence - b.sequence);
  }, [selectedSpk, transactionTypes]);

  const filteredSpks = useMemo(() => {
    const q = searchSpk.trim().toLowerCase();
    if (!q) return spks;
    return spks.filter((spk) => spk.spkNumber.toLowerCase().includes(q)
      || spk.tailor.name.toLowerCase().includes(q)
      || spk.items.some((item) => item.product.name.toLowerCase().includes(q) || item.product.code.toLowerCase().includes(q)));
  }, [spks, searchSpk]);

  const filteredTransactions = useMemo(() => {
    const q = searchTransaction.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) => t.transactionNumber.toLowerCase().includes(q)
      || t.spk.spkNumber.toLowerCase().includes(q)
      || t.transactionType.name.toLowerCase().includes(q)
      || t.employee.name.toLowerCase().includes(q)
      || (t.product?.name ?? "").toLowerCase().includes(q));
  }, [transactions, searchTransaction]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSpk) { setError("Pilih SPK terlebih dahulu."); return; }
    if (!selectedType) { setError("Pilih proses transaksi."); return; }
    if (!selectedEmployeeId) { setError("Pilih karyawan."); return; }

    const items = selectedSpk.items
      .map((product) => ({ productId: product.productId, quantity: Number(quantityByProduct[product.productId] ?? "") }))
      .filter((item) => quantityByProduct[item.productId]?.trim() !== "" && Number.isFinite(item.quantity));

    if (items.length === 0) { setError("Masukkan jumlah untuk minimal satu produk."); return; }
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        setError("Jumlah setiap produk harus berupa angka bulat lebih dari 0."); return;
      }
      const summary = selectedSpk.productSummaries?.find((p) => p.productId === item.productId);
      if (!summary || !summary.summary.nextTransactionTypes.includes(selectedType.code)) {
        const product = selectedSpk.items.find((p) => p.productId === item.productId);
        setError(`Proses ${selectedType.name} belum tersedia untuk ${product?.product.name ?? "salah satu produk"}.`); return;
      }
      const max = getMaxQuantity(summary.quantity, summary.summary, selectedType.code);
      if (item.quantity > max) {
        const product = selectedSpk.items.find((p) => p.productId === item.productId);
        setError(`Jumlah ${product?.product.name ?? "produk"} melebihi batas maksimum ${max}.`); return;
      }
    }

    try {
      setSubmitting(true); setError(""); setSuccess("");
      const response = await fetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spkId: selectedSpk.id, transactionTypeId: Number(selectedTypeId), employeeId: Number(selectedEmployeeId), items }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Gagal menyimpan transaksi.");
      const created = Array.isArray(json.data) ? json.data : [json.data];
      setSuccess(`${created.length} transaksi berhasil disimpan${created.length ? `: ${created.map((t: Transaction) => t.transactionNumber).join(", ")}` : "."}`);
      setQuantityByProduct({});
      await loadSpkDetail(String(selectedSpk.id));
      const historyResponse = await fetch("/api/transactions");
      if (historyResponse.ok) { const historyJson = await historyResponse.json(); setTransactions(historyJson.data ?? []); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan transaksi.");
    } finally { setSubmitting(false); }
  }

  function resetForm() {
    setSelectedSpkId(""); setSelectedSpk(null); setSelectedTypeId(""); setSelectedEmployeeId("");
    setQuantityByProduct({}); setError(""); setSuccess("");
  }

  if (loading) return <div className="flex min-h-[500px] items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Memuat data transaksi...</div>;

  return <div className="space-y-6 rounded-3xl bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50/30 p-4 md:p-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-3 text-white"><ArrowLeftRight className="h-5 w-5" /></div><div><h1 className="text-2xl font-semibold text-slate-800">Transactions</h1><p className="mt-1 text-sm text-slate-500">Input beberapa produk dalam satu kali penyimpanan.</p></div></div>
      <button type="button" onClick={() => void loadInitialData()} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700"><RefreshCw className="h-4 w-4" />Refresh</button>
    </header>

    {error && <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><div><strong>Transaksi gagal</strong><div className="mt-1">{error}</div></div><button type="button" onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}
    {success && <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" /><div><strong>Transaksi berhasil</strong><div className="mt-1 break-words">{success}</div></div></div><button type="button" onClick={() => setSuccess("")}><X className="h-4 w-4" /></button></div>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
      <section className="rounded-3xl border border-white bg-white/95 shadow-xl">
        <div className="border-b border-indigo-50 px-6 py-5"><h2 className="font-semibold text-slate-800">Input Transaction</h2><p className="mt-1 text-sm text-slate-500">Pilih SPK, proses, karyawan, lalu isi jumlah untuk produk yang akan diproses.</p></div>
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div><label className="mb-2 block text-sm font-medium text-slate-700">SPK</label><select value={selectedSpkId} onChange={(e) => setSelectedSpkId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800"><option value="">Pilih SPK...</option>{filteredSpks.map((spk) => <option key={spk.id} value={spk.id} disabled={spk.status !== "ACTIVE"}>{spk.spkNumber} — {spk.items.map((i) => i.product.name).join(", ")}{spk.status !== "ACTIVE" ? ` (${spk.status})` : ""}</option>)}</select><div className="relative mt-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchSpk} onChange={(e) => setSearchSpk(e.target.value)} placeholder="Cari SPK / produk / penjahit..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs" /></div></div>
          {loadingSpk && <div className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-700">Memuat status SPK...</div>}
          {selectedSpk && !loadingSpk && <>
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-indigo-50/50 p-4"><div className="text-xs text-slate-500">SPK</div><div className="mt-1 font-semibold text-slate-800">{selectedSpk.spkNumber}</div></div><div className="rounded-xl border bg-indigo-50/50 p-4"><div className="text-xs text-slate-500">Penjahit</div><div className="mt-1 font-semibold text-slate-800">{selectedSpk.tailor.name}</div></div><div className="rounded-xl border bg-indigo-50/50 p-4"><div className="text-xs text-slate-500">Total jenis produk</div><div className="mt-1 font-semibold text-slate-800">{selectedSpk.items.length}</div></div></div>
            <div><label className="mb-2 block text-sm font-medium text-slate-700">Proses Transaksi</label><select value={selectedTypeId} onChange={(e) => setSelectedTypeId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Pilih proses...</option>{availableTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>{availableTypes.length === 0 && <p className="mt-2 text-xs text-amber-700">Tidak ada proses berikutnya yang tersedia pada produk di SPK ini.</p>}</div>
            <div><label className="mb-2 block text-sm font-medium text-slate-700">Karyawan</label><div className="relative"><UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm"><option value="">Pilih karyawan...</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div></div>
            <div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-medium text-slate-700">Jumlah per Produk</label><span className="text-xs text-slate-500">Kosongkan produk yang tidak diproses</span></div><div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-3 font-medium text-slate-600">Produk</th><th className="px-3 py-3 text-right font-medium text-slate-600">Qty SPK</th><th className="px-3 py-3 text-right font-medium text-slate-600">Maksimum</th><th className="px-3 py-3 font-medium text-slate-600">Qty Proses</th></tr></thead><tbody>{selectedSpk.items.map((item) => {const ps = selectedSpk.productSummaries?.find((p) => p.productId === item.productId); const allowed = Boolean(ps && selectedType && ps.summary.nextTransactionTypes.includes(selectedType.code)); const max = ps && selectedType && allowed ? getMaxQuantity(ps.quantity, ps.summary, selectedType.code) : 0; return <tr key={item.productId} className="border-t border-slate-100"><td className="px-3 py-3"><div className="font-medium text-slate-800">{item.product.name}</div><div className="text-xs text-slate-500">{item.product.code}</div>{selectedType && !allowed && <div className="mt-1 text-xs text-amber-600">Proses tidak tersedia</div>}</td><td className="px-3 py-3 text-right text-slate-600">{item.quantity}</td><td className="px-3 py-3 text-right text-slate-600">{allowed ? max : "—"}</td><td className="px-3 py-3"><input type="number" min={1} max={max > 0 ? max : undefined} value={quantityByProduct[item.productId] ?? ""} disabled={!selectedType || !allowed || max <= 0} onChange={(e) => setQuantityByProduct((current) => ({ ...current, [item.productId]: e.target.value }))} placeholder={max > 0 ? "Jumlah" : "-"} className="w-24 rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-indigo-400 disabled:bg-slate-100" /></td></tr>;})}</tbody></table></div></div>
          </>}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600">Reset</button><button type="submit" disabled={submitting || !selectedSpk || !selectedTypeId || !selectedEmployeeId} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan...</> : <><CheckCircle2 className="h-4 w-4" />Simpan Transaksi</>}</button></div>
        </form>
      </section>

      <aside className="rounded-3xl border border-white bg-white/95 p-6 shadow-xl"><h2 className="font-semibold text-slate-800">Status Produk SPK</h2><p className="mt-1 text-sm text-slate-500">Status produksi berdasarkan produk yang dipilih pada SPK.</p>{!selectedSpk ? <div className="py-10 text-center text-sm text-slate-500"><Package className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3">Pilih SPK untuk melihat status.</p></div> : <div className="mt-4 space-y-3">{selectedSpk.items.map((item) => {const ps = selectedSpk.productSummaries?.find((p) => p.productId === item.productId); return <div key={item.productId} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4"><div className="font-semibold text-slate-800">{item.product.name}</div><div className="text-xs text-slate-500">{item.product.code} · Qty SPK {item.quantity}</div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><span className="text-slate-500">Sisa Jahit</span><div className="font-semibold">{ps?.summary.sisaJahit ?? 0}</div></div><div><span className="text-slate-500">Barang di QC</span><div className="font-semibold">{ps?.summary.barangDiQc ?? 0}</div></div><div><span className="text-slate-500">Pengiriman</span><div className="font-semibold">{ps?.summary.totalPengiriman ?? 0}</div></div><div><span className="text-slate-500">Rijek</span><div className="font-semibold">{ps?.summary.jumlahRijek ?? 0}</div></div></div></div>;})}</div>}</aside>
    </div>

    <section className="rounded-3xl border border-white bg-white/95 shadow-xl"><div className="flex flex-col gap-3 border-b border-indigo-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-800">Transaction History</h2><p className="mt-1 text-sm text-slate-500">Riwayat transaksi produksi yang sudah tercatat.</p></div><div className="relative sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchTransaction} onChange={(e) => setSearchTransaction(e.target.value)} placeholder="Cari transaksi / SPK / produk..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm" /></div></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-indigo-50/70"><tr>{["Transaction", "SPK", "Produk", "Process", "Employee", "Qty", "Date"].map((label) => <th key={label} className="px-5 py-3 font-medium text-slate-500">{label}</th>)}</tr></thead><tbody>{filteredTransactions.length === 0 ? <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">Belum ada transaksi.</td></tr> : filteredTransactions.map((t) => <tr key={t.id} className="border-t border-slate-100 hover:bg-indigo-50/30"><td className="px-5 py-4 font-medium text-slate-800">{t.transactionNumber}</td><td className="px-5 py-4 text-slate-600">{t.spk.spkNumber}</td><td className="px-5 py-4 text-slate-600">{t.product?.name ?? "-"}</td><td className="px-5 py-4 text-slate-600">{t.transactionType.name}</td><td className="px-5 py-4 text-slate-600">{t.employee.name}</td><td className="px-5 py-4 text-right font-semibold text-slate-800">{t.quantity}</td><td className="px-5 py-4 text-slate-500">{formatDate(t.createdAt)}</td></tr>)}</tbody></table></div></section>
  </div>;
}
