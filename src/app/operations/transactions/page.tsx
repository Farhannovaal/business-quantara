"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {

  ArrowLeftRight,
  Ban,
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

  status: "ACTIVE" | "CANCELLED";

  createdById: number;

  cancelledAt?: string | null;

  cancelledById?: number | null;

  cancellationReason?: string | null;

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

  "w-full min-w-0 rounded-xl border border-white/10 bg-[#151313] px-3 py-3 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-500 focus:ring-4 focus:ring-rose-950/60 disabled:cursor-not-allowed disabled:bg-white/[0.03]";

const labelClass = "mb-2 block text-sm font-semibold text-neutral-200";

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
  const [transactionStatus, setTransactionStatus] = useState<"ALL" | "ACTIVE" | "CANCELLED">("ALL");
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionPageSize, setTransactionPageSize] = useState(10);
  const [cancelTarget, setCancelTarget] = useState<Transaction | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

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

    return transactions.filter((transaction) => {
      const matchesSearch =
        !q ||
        transaction.transactionNumber.toLowerCase().includes(q) ||
        transaction.spk.spkNumber.toLowerCase().includes(q) ||
        transaction.transactionType.name.toLowerCase().includes(q) ||
        transaction.employee.name.toLowerCase().includes(q) ||
        (transaction.product?.name ?? "").toLowerCase().includes(q);

      const matchesStatus =
        transactionStatus === "ALL" || transaction.status === transactionStatus;

      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchTransaction, transactionStatus]);

  const transactionTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / transactionPageSize));
  const paginatedTransactions = useMemo(() => {
    const startIndex = (transactionPage - 1) * transactionPageSize;
    return filteredTransactions.slice(startIndex, startIndex + transactionPageSize);
  }, [filteredTransactions, transactionPage, transactionPageSize]);

  useEffect(() => {
    setTransactionPage(1);
  }, [searchTransaction, transactionStatus, transactionPageSize]);

  useEffect(() => {
    if (transactionPage > transactionTotalPages) {
      setTransactionPage(transactionTotalPages);
    }
  }, [transactionPage, transactionTotalPages]);

  async function handleCancelTransaction() {
    if (!cancelTarget || cancelling) return;

    try {
      setCancelling(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/transactions/${cancelTarget.id}/cancel`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cancellationReason: cancellationReason.trim() || null,
          }),
        },
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Gagal membatalkan transaksi.");
      }

      const transactionNumber = cancelTarget.transactionNumber;
      const spkIdToRefresh = selectedSpkId;

      setCancelTarget(null);
      setCancellationReason("");

      await loadInitialData();

      if (spkIdToRefresh) {
        await loadSpkDetail(spkIdToRefresh);
      }

      setSuccess(`Transaksi ${transactionNumber} berhasil dibatalkan.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membatalkan transaksi.");
    } finally {
      setCancelling(false);
    }
  }

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
      .map((product) => {
        const rawQuantity = quantityByProduct[product.productId] ?? "";
        const normalizedQuantity = rawQuantity.trim();

        if (normalizedQuantity === "") {
          return null;
        }

        return {
          productId: product.productId,
          quantity: Number(normalizedQuantity),
        };
      })
      .filter(
        (item): item is { productId: number; quantity: number } =>
          item !== null,
      );

    if (items.length === 0) {
      setError("Masukkan jumlah lebih dari 0 untuk minimal satu produk.");
      return;
    }

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        setError("Jumlah setiap produk harus berupa angka bulat lebih dari 0.");
        return;
      }

      const summary = selectedSpk.productSummaries?.find(
        (product) => product.productId === item.productId,
      );

      if (!summary || !summary.summary.nextTransactionTypes.includes(selectedType.code)) {
        const product = selectedSpk.items.find(
          (entry) => entry.productId === item.productId,
        );

        setError(
          `Proses ${selectedType.name} belum tersedia untuk ${product?.product.name ?? "salah satu produk"}.`,
        );
        return;
      }

      const max = getMaxQuantity(
        summary.quantity,
        summary.summary,
        selectedType.code,
      );

      if (item.quantity > max) {
        const product = selectedSpk.items.find(
          (entry) => entry.productId === item.productId,
        );

        setError(
          `Jumlah ${product?.product.name ?? "produk"} melebihi batas maksimum ${max}.`,
        );
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

      <div className="flex min-h-[60vh] items-center justify-center px-4 text-center text-sm text-neutral-400">

        <Loader2 className="mr-2 h-5 w-5 animate-spin" />

        Memuat data transaksi...

      </div>

    );

  }

  return (

    <div className="min-w-0 w-full space-y-5 overflow-x-clip rounded-2xl bg-gradient-to-br from-[#080808] via-[#0d0b0b] to-[#14090b] p-3 sm:space-y-6 sm:rounded-3xl sm:p-4 md:p-6">

      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex min-w-0 items-center gap-3">

          <div className="shrink-0 rounded-2xl bg-gradient-to-br from-rose-600 to-red-800 p-3 text-white shadow-md">

            <ArrowLeftRight className="h-5 w-5" />

          </div>

          <div className="min-w-0">

            <h1 className="text-xl font-semibold text-white sm:text-2xl">Transactions</h1>

            <p className="mt-1 text-sm leading-5 text-neutral-400">

              Input beberapa produk dalam satu kali penyimpanan.

            </p>

          </div>

        </div>

        <button

          type="button"

          onClick={() => void loadInitialData()}

          disabled={loading}

          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#151313] px-4 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-950/30 disabled:opacity-60 sm:w-auto"

        >

          <RefreshCw className="h-4 w-4" />

          Refresh

        </button>

      </header>

      {error && (

        <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">

          <div className="min-w-0">

            <strong>Transaksi gagal</strong>

            <div className="mt-1 break-words">{error}</div>

          </div>

          <button type="button" onClick={() => setError("")} aria-label="Tutup pesan error" className="shrink-0 rounded-lg p-1 hover:bg-rose-950/50">

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

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-[minmax(0,1.5fr)\_minmax(280px,1fr)]">

        <section className="min-w-0 rounded-2xl border border-white/10 bg-[#111010] shadow-lg shadow-black/30 sm:rounded-3xl">

          <div className="border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">

            <h2 className="font-semibold text-white">Input Transaction</h2>

            <p className="mt-1 text-sm leading-5 text-neutral-400">

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

                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />

                <input value={searchSpk} onChange={(event) => setSearchSpk(event.target.value)} placeholder="Cari SPK / produk / penjahit..." className={`${inputClass} bg-white/[0.04] pl-9`} />

              </div>

            </div>

            {loadingSpk && <div className="rounded-xl bg-rose-950/30 px-4 py-3 text-sm text-rose-300">Memuat status SPK...</div>}

            {selectedSpk && !loadingSpk && (

              <>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

                  <div className="min-w-0 rounded-xl border border-rose-900/30 bg-rose-950/20 p-3 sm:p-4">

                    <div className="text-xs text-neutral-400">SPK</div>

                    <div className="mt-1 break-words font-semibold text-white">{selectedSpk.spkNumber}</div>

                  </div>

                  <div className="min-w-0 rounded-xl border border-rose-900/30 bg-rose-950/20 p-3 sm:p-4">

                    <div className="text-xs text-neutral-400">Penjahit</div>

                    <div className="mt-1 break-words font-semibold text-white">{selectedSpk.tailor.name}</div>

                  </div>

                  <div className="min-w-0 rounded-xl border border-rose-900/30 bg-rose-950/20 p-3 sm:p-4">

                    <div className="text-xs text-neutral-400">Total jenis produk</div>

                    <div className="mt-1 font-semibold text-white">{selectedSpk.items.length}</div>

                  </div>

                </div>

                <div className="min-w-0">

                  <label className={labelClass}>Proses Transaksi</label>

                  <select value={selectedTypeId} onChange={(event) => setSelectedTypeId(event.target.value)} className={inputClass}>

                    <option value="">Pilih proses...</option>

                    {availableTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}

                  </select>

                  {availableTypes.length === 0 && (

                    <p className="mt-2 text-xs leading-5 text-amber-300">Tidak ada proses berikutnya yang tersedia pada produk di SPK ini.</p>

                  )}

                </div>

                <div className="min-w-0">

                  <label className={labelClass}>Karyawan</label>

                  <div className="relative">

                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />

                    <select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} className={`${inputClass} pl-10`}>

                      <option value="">Pilih karyawan...</option>

                      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}

                    </select>

                  </div>

                </div>

                <div className="min-w-0">

                  <div className="mb-2">

                    <label className="block text-sm font-semibold text-neutral-200">Jumlah per Produk</label>

                    <p className="mt-1 text-xs leading-5 text-neutral-400">Kosongkan produk yang tidak diproses.</p>

                  </div>

                  <div className="space-y-3 lg:hidden">

                    {selectedSpk.items.map((item) => {

                      const productSummary = selectedSpk.productSummaries?.find((entry) => entry.productId === item.productId);

                      const allowed = Boolean(productSummary && selectedType && productSummary.summary.nextTransactionTypes.includes(selectedType.code));

                      const max = productSummary && selectedType && allowed

                        ? getMaxQuantity(productSummary.quantity, productSummary.summary, selectedType.code)

                        : 0;

                      return (

                        <div key={item.productId} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">

                          <div className="break-words font-semibold text-white">{item.product.name}</div>

                          <div className="mt-0.5 break-words text-xs text-neutral-400">{item.product.code}</div>

                          {selectedType && !allowed && <p className="mt-2 text-xs text-amber-300">Proses tidak tersedia untuk produk ini.</p>}

                          <div className="mt-3 grid grid-cols-2 gap-3">

                            <div>

                              <div className="text-xs text-neutral-400">Qty SPK</div>

                              <div className="mt-1 font-semibold text-neutral-200">{item.quantity}</div>

                            </div>

                            <div>

                              <div className="text-xs text-neutral-400">Maksimum</div>

                              <div className="mt-1 font-semibold text-neutral-200">{allowed ? max : "—"}</div>

                            </div>

                          </div>

                          <label className="mt-3 block text-xs font-semibold text-neutral-300">Qty Proses</label>

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

                            className={`${inputClass} mt-1 disabled:bg-white/[0.03]`}

                          />

                        </div>

                      );

                    })}

                  </div>

                  <div className="hidden overflow-x-auto rounded-xl border border-white/10 lg:block">

                    <table className="w-full min-w-[560px] text-left text-sm">

                      <thead className="bg-white/[0.04]">

                        <tr>

                          <th className="px-3 py-3 font-semibold text-neutral-300">Produk</th>

                          <th className="px-3 py-3 text-right font-semibold text-neutral-300">Qty SPK</th>

                          <th className="px-3 py-3 text-right font-semibold text-neutral-300">Maksimum</th>

                          <th className="px-3 py-3 font-semibold text-neutral-300">Qty Proses</th>

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

                            <tr key={item.productId} className="border-t border-white/10">

                              <td className="max-w-[240px] px-3 py-3">

                                <div className="break-words font-medium text-white">{item.product.name}</div>

                                <div className="break-words text-xs text-neutral-400">{item.product.code}</div>

                                {selectedType && !allowed && <div className="mt-1 text-xs text-amber-300">Proses tidak tersedia</div>}

                              </td>

                              <td className="px-3 py-3 text-right text-neutral-300">{item.quantity}</td>

                              <td className="px-3 py-3 text-right text-neutral-300">{allowed ? max : "—"}</td>

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

                                  className="w-24 rounded-lg border border-white/10 px-2 py-2 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-950/60 disabled:bg-white/[0.03]"

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

            <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-5 sm:flex-row sm:justify-end sm:gap-3">

              <button type="button" onClick={resetForm} className="w-full rounded-xl border border-white/10 bg-[#151313] px-4 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.04] sm:w-auto sm:py-2.5">

                Reset

              </button>

              <button type="submit" disabled={submitting || !selectedSpk || !selectedTypeId || !selectedEmployeeId} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-800 px-5 py-3 text-sm font-semibold text-white transition hover:from-rose-700 hover:to-red-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5">

                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan...</> : <><CheckCircle2 className="h-4 w-4" />Simpan Transaksi</>}

              </button>

            </div>

          </form>

        </section>

        <aside className="min-w-0 rounded-2xl border border-white/10 bg-[#111010] p-4 shadow-lg shadow-black/30 sm:rounded-3xl sm:p-6">

          <h2 className="font-semibold text-white">Status Produk SPK</h2>

          <p className="mt-1 text-sm leading-5 text-neutral-400">Status produksi berdasarkan produk yang dipilih pada SPK.</p>

          {!selectedSpk ? (

            <div className="py-10 text-center text-sm text-neutral-400">

              <Package className="mx-auto h-8 w-8 text-neutral-500" />

              <p className="mt-3">Pilih SPK untuk melihat status.</p>

            </div>

          ) : (

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">

              {selectedSpk.items.map((item) => {

                const productSummary = selectedSpk.productSummaries?.find((entry) => entry.productId === item.productId);

                return (

                  <div key={item.productId} className="min-w-0 rounded-xl border border-rose-900/30 bg-rose-950/15 p-3 sm:p-4">

                    <div className="break-words font-semibold text-white">{item.product.name}</div>

                    <div className="break-words text-xs text-neutral-400">{item.product.code} · Qty SPK {item.quantity}</div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">

                      <div><span className="text-xs text-neutral-400">Sisa Jahit</span><div className="font-semibold text-white">{productSummary?.summary.sisaJahit ?? 0}</div></div>

                      <div><span className="text-xs text-neutral-400">Barang di QC</span><div className="font-semibold text-white">{productSummary?.summary.barangDiQc ?? 0}</div></div>

                      <div><span className="text-xs text-neutral-400">Pengiriman</span><div className="font-semibold text-white">{productSummary?.summary.totalPengiriman ?? 0}</div></div>

                      <div><span className="text-xs text-neutral-400">Rijek</span><div className="font-semibold text-white">{productSummary?.summary.jumlahRijek ?? 0}</div></div>

                    </div>

                  </div>

                );

              })}

            </div>

          )}

        </aside>

      </div>

      <section className="min-w-0 rounded-2xl border border-white/10 bg-[#111010] shadow-lg shadow-black/30 sm:rounded-3xl">

        <div className="flex min-w-0 flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">

          <div className="min-w-0">

            <h2 className="font-semibold text-white">Transaction History</h2>

            <p className="mt-1 text-sm leading-5 text-neutral-400">Riwayat transaksi produksi yang sudah tercatat.</p>

          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 sm:max-w-sm">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                value={searchTransaction}
                onChange={(event) => setSearchTransaction(event.target.value)}
                placeholder="Cari transaksi / SPK / produk..."
                className={`${inputClass} bg-white/[0.04] pl-9`}
              />
            </div>
            <select
              value={transactionStatus}
              onChange={(event) =>
                setTransactionStatus(event.target.value as "ALL" | "ACTIVE" | "CANCELLED")
              }
              className={inputClass}
              aria-label="Filter status transaksi"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>

        </div>

        <div className="space-y-3 p-3 sm:p-4 lg:hidden">

          {filteredTransactions.length === 0 ? (

            <div className="px-3 py-10 text-center text-sm text-neutral-400">Belum ada transaksi.</div>

          ) : paginatedTransactions.map((transaction) => (

            <article key={transaction.id} className="min-w-0 rounded-xl border border-white/10 p-3">

              <div className="flex min-w-0 items-start justify-between gap-3">

                <div className="min-w-0">

                  <div className="break-words font-semibold text-rose-300">{transaction.transactionNumber}</div>

                  <div className="mt-1 break-words text-xs text-neutral-400">SPK: {transaction.spk.spkNumber}</div>

                </div>

                <span className="shrink-0 rounded-lg bg-rose-950/30 px-2.5 py-1 text-sm font-bold text-rose-300">{transaction.quantity}</span>

              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    transaction.status === "CANCELLED"
                      ? "bg-red-950/50 text-red-300"
                      : "bg-emerald-950/50 text-emerald-300"
                  }`}
                >
                  {transaction.status === "CANCELLED" ? "Dibatalkan" : "Aktif"}
                </span>
                {transaction.status === "CANCELLED" && transaction.cancelledAt && (
                  <span className="text-xs text-neutral-500">
                    {formatDate(transaction.cancelledAt)}
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/10 pt-3 text-sm min-[420px]:grid-cols-2">
                <div className="min-w-0">
                  <div className="text-xs text-neutral-400">Produk</div>
                  <div className="break-words text-neutral-200">{transaction.product?.name ?? "-"}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-neutral-400">Proses</div>
                  <div className="break-words text-neutral-200">{transaction.transactionType.name}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-neutral-400">Karyawan</div>
                  <div className="break-words text-neutral-200">{transaction.employee.name}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-neutral-400">Tanggal</div>
                  <div className="break-words text-neutral-200">{formatDate(transaction.createdAt)}</div>
                </div>
              </div>

              {transaction.status === "CANCELLED" && transaction.cancellationReason && (
                <div className="mt-3 rounded-lg border border-red-900/30 bg-red-950/20 p-2.5 text-xs text-neutral-300">
                  <span className="font-semibold text-red-300">Alasan pembatalan:</span>{" "}
                  {transaction.cancellationReason}
                </div>
              )}

              {transaction.status === "ACTIVE" && (
                <div className="mt-3 flex justify-end border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCancelTarget(transaction);
                      setCancellationReason("");
                      setError("");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-950/50"
                  >
                    <Ban className="h-4 w-4" />
                    Cancel Transaction
                  </button>
                </div>
              )}

            </article>

          ))}

        </div>

        <div className="hidden overflow-x-auto lg:block">

          <table className="w-full min-w-[850px] text-left text-sm">

            <thead className="bg-white/[0.04]">

              <tr>

                {["Transaction", "SPK", "Produk", "Process", "Employee", "Qty", "Date", "Status", "Aksi"].map((label) => (

                  <th key={label} className="whitespace-nowrap px-4 py-3 font-semibold text-neutral-400 lg:px-5">{label}</th>

                ))}

              </tr>

            </thead>

            <tbody>

              {filteredTransactions.length === 0 ? (

                <tr><td colSpan={9} className="px-6 py-10 text-center text-neutral-400">Belum ada transaksi.</td></tr>

              ) : paginatedTransactions.map((transaction) => (

                <tr key={transaction.id} className="border-t border-white/10 transition hover:bg-rose-950/15">

                  <td className="max-w-48 break-words px-4 py-4 font-medium text-white lg:px-5">{transaction.transactionNumber}</td>

                  <td className="break-words px-4 py-4 text-neutral-300 lg:px-5">{transaction.spk.spkNumber}</td>

                  <td className="break-words px-4 py-4 text-neutral-300 lg:px-5">{transaction.product?.name ?? "-"}</td>

                  <td className="break-words px-4 py-4 text-neutral-300 lg:px-5">{transaction.transactionType.name}</td>

                  <td className="break-words px-4 py-4 text-neutral-300 lg:px-5">{transaction.employee.name}</td>

                  <td className="px-4 py-4 text-right font-semibold text-white lg:px-5">{transaction.quantity}</td>

                  <td className="whitespace-nowrap px-4 py-4 text-neutral-400 lg:px-5">{formatDate(transaction.createdAt)}</td>
                  <td className="px-4 py-4 lg:px-5">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                          transaction.status === "CANCELLED"
                            ? "bg-red-950/50 text-red-300"
                            : "bg-emerald-950/50 text-emerald-300"
                        }`}
                      >
                        {transaction.status === "CANCELLED" ? "Dibatalkan" : "Aktif"}
                      </span>
                      {transaction.status === "CANCELLED" && transaction.cancellationReason && (
                        <span className="max-w-48 whitespace-normal break-words text-xs text-neutral-500">
                          Alasan: {transaction.cancellationReason}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 lg:px-5">
                    {transaction.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelTarget(transaction);
                          setCancellationReason("");
                          setError("");
                        }}
                        className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-950/50"
                      >
                        <Ban className="h-4 w-4" />
                        Cancel
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-500">Tidak tersedia</span>
                    )}
                  </td>
                </tr>

              ))}

            </tbody>

          </table>

        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-col gap-2 text-sm text-neutral-400 sm:flex-row sm:items-center sm:gap-3">
            <span>
              Menampilkan {filteredTransactions.length === 0 ? 0 : (transactionPage - 1) * transactionPageSize + 1}
              –{Math.min(transactionPage * transactionPageSize, filteredTransactions.length)} dari {filteredTransactions.length} transaksi
            </span>
            <label className="flex items-center gap-2">
              <span>Per halaman</span>
              <select
                value={transactionPageSize}
                onChange={(event) => setTransactionPageSize(Number(event.target.value))}
                className="rounded-lg border border-white/10 bg-[#151313] px-2 py-1.5 text-sm text-white outline-none focus:border-rose-500"
                aria-label="Jumlah transaksi per halaman"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setTransactionPage((page) => Math.max(1, page - 1))}
              disabled={transactionPage <= 1}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="min-w-20 text-center text-sm text-neutral-400">
              Halaman {Math.min(transactionPage, transactionTotalPages)} / {transactionTotalPages}
            </span>
            <button
              type="button"
              onClick={() => setTransactionPage((page) => Math.min(transactionTotalPages, page + 1))}
              disabled={transactionPage >= transactionTotalPages}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>

      </section>

      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !cancelling) {
              setCancelTarget(null);
              setCancellationReason("");
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-transaction-title"
            className="my-auto w-full max-w-lg rounded-2xl border border-white/10 bg-[#111010] p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-red-950/50 p-3 text-red-300">
                <Ban className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="cancel-transaction-title" className="text-lg font-semibold text-white">
                  Batalkan Transaksi?
                </h2>
                <p className="mt-1 text-sm leading-5 text-neutral-400">
                  Transaksi akan ditandai sebagai dibatalkan dan tetap tersimpan dalam riwayat.
                </p>
              </div>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => {
                  setCancelTarget(null);
                  setCancellationReason("");
                }}
                aria-label="Tutup dialog"
                className="rounded-lg p-2 text-neutral-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div>
                <div className="text-xs text-neutral-500">Nomor Transaksi</div>
                <div className="mt-1 break-words font-semibold text-rose-300">
                  {cancelTarget.transactionNumber}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-neutral-500">SPK</div>
                  <div className="mt-1 break-words text-sm text-white">
                    {cancelTarget.spk.spkNumber}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Jumlah</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {cancelTarget.quantity}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Produk</div>
                <div className="mt-1 break-words text-sm text-white">
                  {cancelTarget.product?.name ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Proses</div>
                <div className="mt-1 break-words text-sm text-white">
                  {cancelTarget.transactionType.name}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="cancellation-reason" className={labelClass}>
                Alasan Pembatalan
                <span className="ml-1 font-normal text-neutral-500">(Opsional)</span>
              </label>
              <textarea
                id="cancellation-reason"
                value={cancellationReason}
                onChange={(event) => setCancellationReason(event.target.value)}
                maxLength={500}
                rows={3}
                disabled={cancelling}
                placeholder="Contoh: Salah memilih produk atau jumlah transaksi..."
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                {cancellationReason.length}/500 karakter
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/20 p-3 text-sm leading-5 text-amber-200">
              Pastikan transaksi yang dipilih benar. Pembatalan dapat memengaruhi perhitungan progres produksi.
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => {
                  setCancelTarget(null);
                  setCancellationReason("");
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.08] disabled:opacity-50 sm:py-2.5"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => void handleCancelTransaction()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50 sm:py-2.5"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Membatalkan...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    Konfirmasi Pembatalan
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>

  );

}
