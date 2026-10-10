"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  Loader2,
  Package,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";

type Product = { id: number; code: string; name: string };
type SPKItem = { id: number; productId: number; quantity: number; product: Product };
type SPKSummary = {
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
type ProductSummary = { productId: number; product: Product; quantity: number; summary: SPKSummary };
type SPK = {
  id: number;
  spkNumber: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  items: SPKItem[];
  tailor: { id: number; name: string };
  summary?: SPKSummary;
  productSummaries?: ProductSummary[];
};
type TransactionType = { id: number; code: string; name: string; sequence: number; isActive: boolean };
type Employee = { id: number; name: string; isActive: boolean };
type Transaction = {
  id: number;
  transactionNumber: string;
  quantity: number;
  createdAt: string;
  spk: { spkNumber: string };
  product?: Product;
  transactionType: { code: string; name: string };
  employee: { name: string };
};

function getMaxQuantity(productQuantity: number, summary: SPKSummary, code: string): number {
  switch (code) {
    case "PENGIRIMAN_SIAP_JAHIT":
      return Math.max(productQuantity - summary.totalPengiriman, 0);
    case "PENERIMAAN_DARI_PENJAHIT":
      return summary.sisaJahit;
    case "QUALITY_CONTROL":
    case "QC_RIJEK":
    case "QC_ACC_DIKIRIM_KE_GUDANG":
      return summary.barangDiQc;
    case "PENGIRIMAN_RIJEK":
      return Math.max(summary.totalQcRijek - summary.totalPengirimanRijek, 0);
    case "PENERIMAAN_RIJEK":
      return Math.max(summary.totalPengirimanRijek - summary.totalPenerimaanRijek, 0);
    default:
      return 0;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100";
const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

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
      setLoading(true);
      setError("");
      const [spkRes, typeRes, employeeRes, transactionRes] = await Promise.all([
        fetch("/api/spks"),
        fetch("/api/transaction-types?forTransaction=true"),
        fetch("/api/employees"),
        fetch("/api/transactions"),
      ]);
      if (!spkRes.ok) throw new Error("Gagal mengambil data SPK.");
      if (!typeRes.ok) throw new Error("Gagal mengambil transaction type.");
      if (!employeeRes.ok) throw new Error("Gagal mengambil data karyawan.");
      if (!transactionRes.ok) throw new Error("Gagal mengambil riwayat transaksi.");
      const [spkJson, typeJson, employeeJson, transactionJson] = await Promise.all([
        spkRes.json(),
        typeRes.json(),
        employeeRes.json(),
        transactionRes.json(),
      ]);
      setSpks(spkJson.data ?? []);
      setTransactionTypes(typeJson.data ?? []);
      setEmployees((employeeJson.data ?? []).filter((employee: Employee) => employee.isActive));
      setTransactions(transactionJson.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat mengambil data.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSpkDetail(id: string) {
    if (!id) {
      setSelectedSpk(null);
      setQuantityByProduct({});
      setSelectedTypeId("");
      return;
    }
    try {
      setLoadingSpk(true);
      setError("");
      setSuccess("");
      const response = await fetch(`/api/spks/${id}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Gagal mengambil detail SPK.");
      setSelectedSpk(json.data);
      setQuantityByProduct({});
      setSelectedTypeId("");
    } catch (e) {
      setSelectedSpk(null);
      setQuantityByProduct({});
      setError(e instanceof Error ? e.message : "Gagal mengambil detail SPK.");
    } finally {
      setLoadingSpk(false);
    }
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    void loadSpkDetail(selectedSpkId);
  }, [selectedSpkId]);

  const selectedType = useMemo(
    () => transactionTypes.find((type) => String(type.id) === selectedTypeId),
    [transactionTypes, selectedTypeId],
  );

  const availableTypes = useMemo(() => {
    if (!selectedSpk) return [];
    const allowed = new Set(
      (selectedSpk.productSummaries ?? []).flatMap((product) => product.summary.nextTransactionTypes),
    );
    return transactionTypes
      .filter((type) => type.isActive && allowed.has(type.code))
      .sort((a, b) => a.sequence - b.sequence);
  }, [selectedSpk, transactionTypes]);

  const filteredSpks = useMemo(() => {
    const q = searchSpk.trim().toLowerCase();
    if (!q) return spks;
    return spks.filter(
      (spk) =>
        spk.spkNumber.toLowerCase().includes(q) ||
        spk.tailor.name.toLowerCase().includes(q) ||
        spk.items.some(
          (item) => item.product.name.toLowerCase().includes(q) || item.product.code.toLowerCase().includes(q),
        ),
    );
  }, [spks, searchSpk]);

  const filteredTransactions = useMemo(() => {
    const q = searchTransaction.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (transaction) =>
        transaction.transactionNumber.toLowerCase().includes(q) ||
        transaction.spk.spkNumber.toLowerCase().includes(q) ||
        transaction.transactionType.name.toLowerCase().includes(q) ||
        transaction.employee.name.toLowerCase().includes(q) ||
        (transaction.product?.name ?? "").toLowerCase().includes(q),
    );
  }, [transactions, searchTransaction]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSpk) {
      setError("Pilih SPK terlebih dahulu.");
      return;
    }
    if (!selectedType) {
      setError("Pilih proses transaksi.");
      return;
    }
    if (!selectedEmployeeId) {
      setError("Pilih karyawan.");
      return;
    }

    const items = selectedSpk.items
      .map((product) => ({
        productId: product.productId,
        quantity: Number(quantityByProduct[product.productId] ?? ""),
      }))
      .filter(
        (item) =>
          quantityByProduct[item.productId]?.trim() !== "" &&
          Number.isFinite(item.quantity),
      );

    if (items.length === 0) {
      setError("Masukkan jumlah untuk minimal satu produk.");
      return;
    }

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        setError("Jumlah setiap produk harus berupa angka bulat lebih dari 0.");
        return;
      }
      const summary = selectedSpk.productSummaries?.find((product) => product.productId === item.productId);
      if (!summary || !summary.summary.nextTransactionTypes.includes(selectedType.code)) {
        const product = selectedSpk.items.find((entry) => entry.productId === item.productId);
        setError(`Proses ${selectedType.name} belum tersedia untuk ${product?.product.name ?? "salah satu produk"}.`);
        return;
      }
      const max = getMaxQuantity(summary.quantity, summary.summary, selectedType.code);
      if (item.quantity > max) {
        const product = selectedSpk.items.find((entry) => entry.productId === item.productId);
        setError(`Jumlah ${product?.product.name ?? "produk"} melebihi batas maksimum ${max}.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spkId: selectedSpk.id,
          transactionTypeId: Number(selectedTypeId),
          employeeId: Number(selectedEmployeeId),
          items,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Gagal menyimpan transaksi.");
      const created = Array.isArray(json.data) ? json.data : [json.data];
      setSuccess(
        `${created.length} transaksi berhasil disimpan${created.length ? `: ${created.map((transaction: Transaction) => transaction.transactionNumber).join(", ")}` : "."}`,
      );
      setQuantityByProduct({});
      await loadSpkDetail(String(selectedSpk.id));
      const historyResponse = await fetch("/api/transactions");
      if (historyResponse.ok) {
        const historyJson = await historyResponse.json();
        setTransactions(historyJson.data ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan transaksi.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSelectedSpkId("");
    setSelectedSpk(null);
    setSelectedTypeId("");
    setSelectedEmployeeId("");
    setQuantityByProduct({});
    setError("");
    setSuccess("");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 text-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Memuat data transaksi...
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full space-y-5 overflow-x-clip rounded-2xl bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50/30 p-3 sm:space-y-6 sm:rounded-3xl sm:p-4 md:p-6">
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-3 text-white shadow-md">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">Transactions</h1>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Input beberapa produk dalam satu kali penyimpanan.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadInitialData()}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-60 sm:w-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {error && (
        <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="min-w-0">
            <strong>Transaksi gagal</strong>
            <div className="mt-1 break-words">{error}</div>
          </div>
          <button type="button" onClick={() => setError("")} aria-label="Tutup pesan error" className="shrink-0 rounded-lg p-1 hover:bg-rose-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <div className="flex min-w-0 gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <strong>Transaksi berhasil</strong>
              <div className="mt-1 break-words">{success}</div>
            </div>
          </div>
          <button type="button" onClick={() => setSuccess("")} aria-label="Tutup pesan sukses" className="shrink-0 rounded-lg p-1 hover:bg-emerald-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <section className="min-w-0 rounded-2xl border border-white bg-white/95 shadow-lg shadow-slate-200/50 sm:rounded-3xl">
          <div className="border-b border-indigo-50 px-4 py-4 sm:px-6 sm:py-5">
            <h2 className="font-semibold text-slate-800">Input Transaction</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Pilih SPK, proses, karyawan, lalu isi jumlah produk yang akan diproses.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="min-w-0 space-y-5 p-4 sm:p-6">
            <div className="min-w-0">
              <label className={labelClass}>SPK</label>
              <select value={selectedSpkId} onChange={(event) => setSelectedSpkId(event.target.value)} className={inputClass}>
                <option value="">Pilih SPK...</option>
                {filteredSpks.map((spk) => (
                  <option key={spk.id} value={spk.id} disabled={spk.status !== "ACTIVE"}>
                    {spk.spkNumber} — {spk.items.map((item) => item.product.name).join(", ")}
                    {spk.status !== "ACTIVE" ? ` (${spk.status})` : ""}
                  </option>
                ))}
              </select>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={searchSpk} onChange={(event) => setSearchSpk(event.target.value)} placeholder="Cari SPK / produk / penjahit..." className={`${inputClass} bg-slate-50 pl-9`} />
              </div>
            </div>

            {loadingSpk && <div className="rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-700">Memuat status SPK...</div>}

            {selectedSpk && !loadingSpk && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="min-w-0 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 sm:p-4">
                    <div className="text-xs text-slate-500">SPK</div>
                    <div className="mt-1 break-words font-semibold text-slate-800">{selectedSpk.spkNumber}</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 sm:p-4">
                    <div className="text-xs text-slate-500">Penjahit</div>
                    <div className="mt-1 break-words font-semibold text-slate-800">{selectedSpk.tailor.name}</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 sm:p-4">
                    <div className="text-xs text-slate-500">Total jenis produk</div>
                    <div className="mt-1 font-semibold text-slate-800">{selectedSpk.items.length}</div>
                  </div>
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>Proses Transaksi</label>
                  <select value={selectedTypeId} onChange={(event) => setSelectedTypeId(event.target.value)} className={inputClass}>
                    <option value="">Pilih proses...</option>
                    {availableTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                  {availableTypes.length === 0 && (
                    <p className="mt-2 text-xs leading-5 text-amber-700">Tidak ada proses berikutnya yang tersedia pada produk di SPK ini.</p>
                  )}
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>Karyawan</label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} className={`${inputClass} pl-10`}>
                      <option value="">Pilih karyawan...</option>
                      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-2">
                    <label className="block text-sm font-semibold text-slate-700">Jumlah per Produk</label>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Kosongkan produk yang tidak diproses.</p>
                  </div>

                  {/* Mobile: setiap produk berupa kartu agar tidak perlu scroll tabel. */}
                  <div className="space-y-3 lg:hidden">
                    {selectedSpk.items.map((item) => {
                      const productSummary = selectedSpk.productSummaries?.find((entry) => entry.productId === item.productId);
                      const allowed = Boolean(productSummary && selectedType && productSummary.summary.nextTransactionTypes.includes(selectedType.code));
                      const max = productSummary && selectedType && allowed
                        ? getMaxQuantity(productSummary.quantity, productSummary.summary, selectedType.code)
                        : 0;
                      return (
                        <div key={item.productId} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                          <div className="break-words font-semibold text-slate-800">{item.product.name}</div>
                          <div className="mt-0.5 break-words text-xs text-slate-500">{item.product.code}</div>
                          {selectedType && !allowed && <p className="mt-2 text-xs text-amber-700">Proses tidak tersedia untuk produk ini.</p>}
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-slate-500">Qty SPK</div>
                              <div className="mt-1 font-semibold text-slate-700">{item.quantity}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Maksimum</div>
                              <div className="mt-1 font-semibold text-slate-700">{allowed ? max : "—"}</div>
                            </div>
                          </div>
                          <label className="mt-3 block text-xs font-semibold text-slate-600">Qty Proses</label>
                          <input
                            type="number"
                            min={1}
                            max={max > 0 ? max : undefined}
                            step={1}
                            inputMode="numeric"
                            value={quantityByProduct[item.productId] ?? ""}
                            disabled={!selectedType || !allowed || max <= 0}
                            onChange={(event) => setQuantityByProduct((current) => ({ ...current, [item.productId]: event.target.value }))}
                            placeholder={max > 0 ? "Masukkan jumlah" : "Pilih proses terlebih dahulu"}
                            className={`${inputClass} mt-1 disabled:bg-slate-100`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop: tabel ditampilkan saat lebar layar benar-benar mencukupi. */}
                  <div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-3 font-semibold text-slate-600">Produk</th>
                          <th className="px-3 py-3 text-right font-semibold text-slate-600">Qty SPK</th>
                          <th className="px-3 py-3 text-right font-semibold text-slate-600">Maksimum</th>
                          <th className="px-3 py-3 font-semibold text-slate-600">Qty Proses</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSpk.items.map((item) => {
                          const productSummary = selectedSpk.productSummaries?.find((entry) => entry.productId === item.productId);
                          const allowed = Boolean(productSummary && selectedType && productSummary.summary.nextTransactionTypes.includes(selectedType.code));
                          const max = productSummary && selectedType && allowed
                            ? getMaxQuantity(productSummary.quantity, productSummary.summary, selectedType.code)
                            : 0;
                          return (
                            <tr key={item.productId} className="border-t border-slate-100">
                              <td className="max-w-[240px] px-3 py-3">
                                <div className="break-words font-medium text-slate-800">{item.product.name}</div>
                                <div className="break-words text-xs text-slate-500">{item.product.code}</div>
                                {selectedType && !allowed && <div className="mt-1 text-xs text-amber-600">Proses tidak tersedia</div>}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-600">{item.quantity}</td>
                              <td className="px-3 py-3 text-right text-slate-600">{allowed ? max : "—"}</td>
                              <td className="px-3 py-3">
                                <input
                                  type="number"
                                  min={1}
                                  max={max > 0 ? max : undefined}
                                  step={1}
                                  inputMode="numeric"
                                  value={quantityByProduct[item.productId] ?? ""}
                                  disabled={!selectedType || !allowed || max <= 0}
                                  onChange={(event) => setQuantityByProduct((current) => ({ ...current, [item.productId]: event.target.value }))}
                                  placeholder={max > 0 ? "Jumlah" : "-"}
                                  className="w-24 rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end sm:gap-3">
              <button type="button" onClick={resetForm} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:w-auto sm:py-2.5">
                Reset
              </button>
              <button type="submit" disabled={submitting || !selectedSpk || !selectedTypeId || !selectedEmployeeId} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan...</> : <><CheckCircle2 className="h-4 w-4" />Simpan Transaksi</>}
              </button>
            </div>
          </form>
        </section>

        <aside className="min-w-0 rounded-2xl border border-white bg-white/95 p-4 shadow-lg shadow-slate-200/50 sm:rounded-3xl sm:p-6">
          <h2 className="font-semibold text-slate-800">Status Produk SPK</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">Status produksi berdasarkan produk yang dipilih pada SPK.</p>
          {!selectedSpk ? (
            <div className="py-10 text-center text-sm text-slate-500">
              <Package className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3">Pilih SPK untuk melihat status.</p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {selectedSpk.items.map((item) => {
                const productSummary = selectedSpk.productSummaries?.find((entry) => entry.productId === item.productId);
                return (
                  <div key={item.productId} className="min-w-0 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 sm:p-4">
                    <div className="break-words font-semibold text-slate-800">{item.product.name}</div>
                    <div className="break-words text-xs text-slate-500">{item.product.code} · Qty SPK {item.quantity}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-xs text-slate-500">Sisa Jahit</span><div className="font-semibold text-slate-800">{productSummary?.summary.sisaJahit ?? 0}</div></div>
                      <div><span className="text-xs text-slate-500">Barang di QC</span><div className="font-semibold text-slate-800">{productSummary?.summary.barangDiQc ?? 0}</div></div>
                      <div><span className="text-xs text-slate-500">Pengiriman</span><div className="font-semibold text-slate-800">{productSummary?.summary.totalPengiriman ?? 0}</div></div>
                      <div><span className="text-xs text-slate-500">Rijek</span><div className="font-semibold text-slate-800">{productSummary?.summary.jumlahRijek ?? 0}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      <section className="min-w-0 rounded-2xl border border-white bg-white/95 shadow-lg shadow-slate-200/50 sm:rounded-3xl">
        <div className="flex min-w-0 flex-col gap-3 border-b border-indigo-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-800">Transaction History</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">Riwayat transaksi produksi yang sudah tercatat.</p>
          </div>
          <div className="relative w-full min-w-0 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchTransaction} onChange={(event) => setSearchTransaction(event.target.value)} placeholder="Cari transaksi / SPK / produk..." className={`${inputClass} bg-slate-50 pl-9`} />
          </div>
        </div>

        {/* Mobile: riwayat sebagai kartu, tanpa tabel yang melebar. */}
        <div className="space-y-3 p-3 sm:p-4 lg:hidden">
          {filteredTransactions.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-slate-500">Belum ada transaksi.</div>
          ) : filteredTransactions.map((transaction) => (
            <article key={transaction.id} className="min-w-0 rounded-xl border border-slate-200 p-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="break-words font-semibold text-indigo-700">{transaction.transactionNumber}</div>
                  <div className="mt-1 break-words text-xs text-slate-500">SPK: {transaction.spk.spkNumber}</div>
                </div>
                <span className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-bold text-indigo-700">{transaction.quantity}</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 text-sm min-[420px]:grid-cols-2">
                <div className="min-w-0"><div className="text-xs text-slate-500">Produk</div><div className="break-words text-slate-700">{transaction.product?.name ?? "-"}</div></div>
                <div className="min-w-0"><div className="text-xs text-slate-500">Proses</div><div className="break-words text-slate-700">{transaction.transactionType.name}</div></div>
                <div className="min-w-0"><div className="text-xs text-slate-500">Karyawan</div><div className="break-words text-slate-700">{transaction.employee.name}</div></div>
                <div className="min-w-0"><div className="text-xs text-slate-500">Tanggal</div><div className="break-words text-slate-700">{formatDate(transaction.createdAt)}</div></div>
              </div>
            </article>
          ))}
        </div>

        {/* Desktop: tabel; mobile dan tablet menggunakan kartu agar tidak melebar. */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-indigo-50/70">
              <tr>
                {["Transaction", "SPK", "Produk", "Process", "Employee", "Qty", "Date"].map((label) => (
                  <th key={label} className="whitespace-nowrap px-4 py-3 font-semibold text-slate-500 lg:px-5">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">Belum ada transaksi.</td></tr>
              ) : filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="border-t border-slate-100 transition hover:bg-indigo-50/30">
                  <td className="max-w-48 break-words px-4 py-4 font-medium text-slate-800 lg:px-5">{transaction.transactionNumber}</td>
                  <td className="break-words px-4 py-4 text-slate-600 lg:px-5">{transaction.spk.spkNumber}</td>
                  <td className="break-words px-4 py-4 text-slate-600 lg:px-5">{transaction.product?.name ?? "-"}</td>
                  <td className="break-words px-4 py-4 text-slate-600 lg:px-5">{transaction.transactionType.name}</td>
                  <td className="break-words px-4 py-4 text-slate-600 lg:px-5">{transaction.employee.name}</td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-800 lg:px-5">{transaction.quantity}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-500 lg:px-5">{formatDate(transaction.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
