"use client";



import { useEffect, useMemo, useState } from "react";

import {

  ArrowLeftRight,

  CheckCircle2,

  ChevronDown,

  Loader2,

  Package,

  RefreshCw,

  Search,

  UserRound,

  X,

} from "lucide-react";



type SPKProductItem = {
  id: number;
  productId: number;
  quantity: number;
  product: {
    id: number;
    code: string;
    name: string;
  };
};

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

type SPKProductSummary = {
  productId: number;
  product: {
    id: number;
    code: string;
    name: string;
  };
  quantity: number;
  summary: SPKSummary;
};

type SPK = {
  id: number;
  spkNumber: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  items: SPKProductItem[];
  tailor: {
    id: number;
    name: string;
  };
  summary?: SPKSummary;
  productSummaries?: SPKProductSummary[];
};

type TransactionType = {

  id: number;

  code: string;

  name: string;

  description?: string | null;

  sequence: number;

  isActive: boolean;

};



type Employee = {

  id: number;

  name: string;

  isActive: boolean;

};



type Transaction = {

  id: number;

  transactionNumber: string;

  quantity: number;

  createdAt: string;

  spk: {

    spkNumber: string;

  };

  transactionType: {

    code: string;

    name: string;

  };

  employee: {

    name: string;

  };

};



const API_BASE = "";



function getMaxQuantity(
  summary: SPKSummary,
  transactionTypeCode: string,
): number | null {



  switch (transactionTypeCode) {

    case "PENGIRIMAN_SIAP_JAHIT":

      return null;



    case "PENERIMAAN_DARI_PENJAHIT":

      return summary.sisaJahit;



    case "QUALITY_CONTROL":

    case "QC_RIJEK":

    case "QC_ACC_DIKIRIM_KE_GUDANG":

      return summary.barangDiQc;



    case "PENGIRIMAN_RIJEK":

      return Math.max(

        summary.totalQcRijek - summary.totalPengirimanRijek,

        0,

      );



    case "PENERIMAAN_RIJEK":

      return Math.max(

        summary.totalPengirimanRijek - summary.totalPenerimaanRijek,

        0,

      );



    default:

      return null;

  }

}



function formatDate(value: string) {

  return new Date(value).toLocaleString("id-ID", {

    dateStyle: "medium",

    timeStyle: "short",

  });

}



function getProcessLabel(code: string) {

  const labels: Record<string, string> = {

    PENGIRIMAN_SIAP_JAHIT: "Pengiriman Siap Jahit",

    PENERIMAAN_DARI_PENJAHIT: "Penerimaan dari Penjahit",

    QUALITY_CONTROL: "Quality Control",

    QC_RIJEK: "QC / Rijek",

    QC_ACC_DIKIRIM_KE_GUDANG: "QC / ACC dikirim ke Gudang",

    PENGIRIMAN_RIJEK: "Pengiriman Rijek",

    PENERIMAAN_RIJEK: "Penerimaan Rijek",

  };



  return labels[code] ?? code;

}



export default function TransactionsPage() {

  const [spks, setSpks] = useState<SPK[]>([]);

  const [transactionTypes, setTransactionTypes] = useState<

    TransactionType[]

  >([]);

  const [employees, setEmployees] = useState<Employee[]>([]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);



  const [selectedSpkId, setSelectedSpkId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");

  const [selectedTypeId, setSelectedTypeId] = useState("");

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const [quantity, setQuantity] = useState("");



  const [searchSpk, setSearchSpk] = useState("");

  const [searchTransaction, setSearchTransaction] = useState("");



  const [selectedSpk, setSelectedSpk] = useState<SPK | null>(null);



  const [loading, setLoading] = useState(true);

  const [loadingSpk, setLoadingSpk] = useState(false);

  const [submitting, setSubmitting] = useState(false);



  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");



  async function loadInitialData() {

    try {

      setLoading(true);

      setError("");



      const [spkRes, typeRes, employeeRes, transactionRes] =

        await Promise.all([

          fetch(`${API_BASE}/api/spks`),

          fetch("/api/transaction-types?forTransaction=true"),

          fetch(`${API_BASE}/api/employees`),

          fetch(`${API_BASE}/api/transactions`),

        ]);



      if (!spkRes.ok) {

        throw new Error("Gagal mengambil data SPK.");

      }



      if (!typeRes.ok) {

        throw new Error("Gagal mengambil transaction type.");

      }



      if (!employeeRes.ok) {

        throw new Error("Gagal mengambil data karyawan.");

      }



      if (!transactionRes.ok) {

        throw new Error("Gagal mengambil transaction history.");

      }



      const [spkJson, typeJson, employeeJson, transactionJson] =

        await Promise.all([

          spkRes.json(),

          typeRes.json(),

          employeeRes.json(),

          transactionRes.json(),

        ]);



      setSpks(spkJson.data ?? []);

      setTransactionTypes(typeJson.data ?? []);

      setEmployees(

        (employeeJson.data ?? []).filter(

          (employee: Employee) => employee.isActive,

        ),

      );

      setTransactions(transactionJson.data ?? []);

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "Terjadi kesalahan saat mengambil data.",

      );

    } finally {

      setLoading(false);

    }

  }



  async function loadSpkDetail(id: string) {

    if (!id) {

      setSelectedSpk(null);
      setSelectedProductId("");

      setSelectedTypeId("");

      setQuantity("");

      return;

    }



    try {

      setLoadingSpk(true);

      setError("");

      setSuccess("");



      const response = await fetch(`${API_BASE}/api/spks/${id}`);

      const json = await response.json();



      if (!response.ok) {

        throw new Error(

          json.error ?? "Gagal mengambil detail SPK.",

        );

      }



      setSelectedSpk(json.data);

      // Reset product, proses, dan quantity ketika SPK berubah.
      const items = json.data?.items ?? [];
      setSelectedProductId(
        items.length === 1 ? String(items[0].productId) : "",
      );
      setSelectedTypeId("");
      setQuantity("");

    } catch (err) {

      setSelectedSpk(null);
      setSelectedProductId("");

      setError(

        err instanceof Error

          ? err.message

          : "Gagal mengambil detail SPK.",

      );

    } finally {

      setLoadingSpk(false);

    }

  }



  useEffect(() => {

    loadInitialData();

  }, []);



  useEffect(() => {

    loadSpkDetail(selectedSpkId);

  }, [selectedSpkId]);



  const selectedProductSummary = useMemo(() => {
    if (!selectedSpk || !selectedProductId) {
      return null;
    }

    return (
      selectedSpk.productSummaries?.find(
        (item) => String(item.productId) === selectedProductId,
      ) ?? null
    );
  }, [selectedSpk, selectedProductId]);

  const selectedProduct = useMemo(() => {
    if (!selectedSpk || !selectedProductId) {
      return null;
    }

    return (
      selectedSpk.items.find(
        (item) => String(item.productId) === selectedProductId,
      )?.product ?? null
    );
  }, [selectedSpk, selectedProductId]);

  const availableTransactionTypes = useMemo(() => {
    if (!selectedProductSummary) return [];

    const allowed = new Set(
      selectedProductSummary.summary.nextTransactionTypes,
    );

    return transactionTypes
      .filter((type) => type.isActive && allowed.has(type.code))
      .sort((a, b) => a.sequence - b.sequence);
  }, [selectedProductSummary, transactionTypes]);

  const selectedTransactionType = useMemo(() => {
    return transactionTypes.find(
      (type) => String(type.id) === selectedTypeId,
    );
  }, [transactionTypes, selectedTypeId]);

  const maxQuantity = useMemo(() => {
    if (!selectedProductSummary || !selectedTransactionType) {
      return null;
    }

    return getMaxQuantity(
      selectedProductSummary.summary,
      selectedTransactionType.code,
    );
  }, [selectedProductSummary, selectedTransactionType]);



  const filteredSpks = useMemo(() => {
    const keyword = searchSpk.trim().toLowerCase();

    if (!keyword) return spks;

    return spks.filter((spk) => {
      const matchesProduct = spk.items.some(
        (item) =>
          item.product.name.toLowerCase().includes(keyword) ||
          item.product.code.toLowerCase().includes(keyword),
      );

      return (
        spk.spkNumber.toLowerCase().includes(keyword) ||
        matchesProduct ||
        spk.tailor.name.toLowerCase().includes(keyword)
      );
    });
  }, [spks, searchSpk]);



  const filteredTransactions = useMemo(() => {

    const keyword = searchTransaction.trim().toLowerCase();



    if (!keyword) return transactions;



    return transactions.filter((transaction) => {

      return (

        transaction.transactionNumber

          .toLowerCase()

          .includes(keyword) ||

        transaction.spk.spkNumber

          .toLowerCase()

          .includes(keyword) ||

        transaction.transactionType.name

          .toLowerCase()

          .includes(keyword) ||

        transaction.employee.name

          .toLowerCase()

          .includes(keyword)

      );

    });

  }, [transactions, searchTransaction]);



  async function handleSubmit(

    event: React.FormEvent<HTMLFormElement>,

  ) {

    event.preventDefault();



    if (!selectedSpk) {

      setError("Pilih SPK terlebih dahulu.");

      return;

    }

    if (!selectedProductId) {
      setError("Pilih produk terlebih dahulu.");
      return;
    }



    if (!selectedTypeId) {

      setError("Pilih proses transaksi.");

      return;

    }



    if (!selectedEmployeeId) {

      setError("Pilih karyawan.");

      return;

    }



    const parsedQuantity = Number(quantity);



    if (

      !Number.isInteger(parsedQuantity) ||

      parsedQuantity <= 0

    ) {

      setError("Jumlah harus berupa angka bulat lebih dari 0.");

      return;

    }



    if (

      maxQuantity !== null &&

      parsedQuantity > maxQuantity

    ) {

      setError(

        `Jumlah melebihi batas. Maximum untuk proses ini adalah ${maxQuantity}.`,

      );

      return;

    }



    try {

      setSubmitting(true);

      setError("");

      setSuccess("");



      const response = await fetch(

        `${API_BASE}/api/transactions`,

        {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            spkId: selectedSpk.id,
            productId: Number(selectedProductId),

            transactionTypeId: Number(selectedTypeId),

            employeeId: Number(selectedEmployeeId),

            quantity: parsedQuantity,

          }),

        },

      );



      const json = await response.json();



      if (!response.ok) {

        throw new Error(

          json.error ?? "Gagal menyimpan transaksi.",

        );

      }



      setSuccess(

        `Transaksi ${json.data.transactionNumber} berhasil disimpan.`,

      );



      setQuantity("");



      // Refresh detail SPK agar state langsung berubah.

      await loadSpkDetail(String(selectedSpk.id));



      // Refresh list transaction.

      const transactionResponse = await fetch(

        `${API_BASE}/api/transactions`,

      );



      if (transactionResponse.ok) {

        const transactionJson =

          await transactionResponse.json();



        setTransactions(transactionJson.data ?? []);

      }

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "Gagal menyimpan transaksi.",

      );

    } finally {

      setSubmitting(false);

    }

  }



  function resetForm() {

    setSelectedSpkId("");

    setSelectedSpk(null);
    setSelectedProductId("");

    setSelectedTypeId("");

    setSelectedEmployeeId("");

    setQuantity("");

    setError("");

    setSuccess("");

  }



  if (loading) {

    return (

      <div className="flex min-h-[500px] items-center justify-center">

        <div className="flex items-center gap-2 text-sm text-slate-500">

          <Loader2 className="h-5 w-5 animate-spin" />

          Memuat data transaksi...

        </div>

      </div>

    );

  }



  return (

    <div className="relative space-y-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50/30 p-4 md:p-6">

      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-violet-300/15 blur-3xl" />

      {/* Header */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>

          <div className="flex items-center gap-3">

            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-3 text-white shadow-lg shadow-indigo-200">

              <ArrowLeftRight className="h-5 w-5" />

            </div>



            <div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-800">

                Transactions

              </h1>

              <p className="mt-1 text-sm text-slate-500">

                Catat transaksi produksi berdasarkan state SPK.

              </p>

            </div>

          </div>

        </div>



        <button

          type="button"

          onClick={loadInitialData}

          className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-100 bg-white/90 px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"

        >

          <RefreshCw className="h-4 w-4" />

          Refresh

        </button>

      </div>



      {/* Alerts */}

      {error && (

        <div className="flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-red-50 px-4 py-3 text-sm text-rose-700 shadow-sm">

          <div>

            <div className="font-semibold">Transaksi gagal</div>

            <div className="mt-1">{error}</div>

          </div>



          <button

            type="button"

            onClick={() => setError("")}

            className="rounded-md p-1 hover:bg-rose-100"

          >

            <X className="h-4 w-4" />

          </button>

        </div>

      )}



      {success && (

        <div className="flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">

          <div className="flex items-start gap-2">

            <CheckCircle2 className="mt-0.5 h-4 w-4" />



            <div>

              <div className="font-semibold">

                Transaksi berhasil

              </div>

              <div className="mt-1">{success}</div>

            </div>

          </div>



          <button

            type="button"

            onClick={() => setSuccess("")}

            className="rounded-md p-1 hover:bg-emerald-100"

          >

            <X className="h-4 w-4" />

          </button>

        </div>

      )}



      {/* Main transaction form */}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)\_minmax(320px,1fr)]">

        <div className="rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-slate-200/50 backdrop-blur">

          <div className="border-b border-indigo-50 px-6 py-5">

            <h2 className="text-base font-semibold text-slate-800">

              Input Transaction

            </h2>

            <p className="mt-1 text-sm text-slate-500">

              Pilih SPK untuk melihat proses yang tersedia.

            </p>

          </div>



          <form

            onSubmit={handleSubmit}

            className="space-y-5 p-6"

          >

            {/* SPK */}

            <div>

              <label className="mb-2 block text-sm font-medium text-slate-700">

                SPK

              </label>



              <div className="relative">

                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />



                <select

                  value={selectedSpkId}

                  onChange={(event) =>

                    setSelectedSpkId(event.target.value)

                  }

                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm shadow-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"

                >

                  <option value="">Pilih SPK...</option>



                  {filteredSpks.map((spk) => (

                    <option

                      key={spk.id}

                      value={spk.id}

                      disabled={spk.status !== "ACTIVE"}

                    >

                      {spk.spkNumber} —{" "}
                      {spk.items
                        .map(
                          (item) =>
                            `${item.product.code} - ${item.product.name}`,
                        )
                        .join(", ")}

                      {spk.status !== "ACTIVE"

                        ? ` (${spk.status})`

                        : ""}

                    </option>

                  ))}

                </select>



                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              </div>



              <input

                value={searchSpk}

                onChange={(event) =>

                  setSearchSpk(event.target.value)

                }

                placeholder="Cari SPK / produk / penjahit..."

                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"

              />

            </div>



            {/* Loading detail */}

            {loadingSpk && (

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-600">

                <div className="flex items-center gap-2">

                  <Loader2 className="h-4 w-4 animate-spin" />

                  Memuat status SPK...

                </div>

              </div>

            )}



            {selectedSpk && !loadingSpk && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Produk
                </label>

                <div className="relative">
                  <select
                    value={selectedProductId}
                    onChange={(event) => {
                      setSelectedProductId(event.target.value);
                      setSelectedTypeId("");
                      setQuantity("");
                      setError("");
                    }}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-3 pr-10 text-sm shadow-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  >
                    <option value="">Pilih produk...</option>

                    {selectedSpk.items.map((item) => (
                      <option key={item.productId} value={item.productId}>
                        {item.product.code} — {item.product.name} — Qty SPK:{" "}
                        {item.quantity}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            )}

            {/* SPK info */}

            {selectedSpk && !loadingSpk && (

              <>

                <div className="grid gap-3 sm:grid-cols-3">

                  <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white p-4 shadow-sm">
                    <div className="text-xs text-slate-500">
                      Produk
                    </div>
                    <div className="mt-1 font-semibold text-slate-800">
                      {selectedProduct?.name ?? "Belum dipilih"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {selectedProduct?.code ?? "-"}
                    </div>
                  </div>



                  <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white p-4 shadow-sm">

                    <div className="text-xs text-slate-500">

                      Penjahit

                    </div>

                    <div className="mt-1 font-semibold text-slate-800">

                      {selectedSpk.tailor.name}

                    </div>

                  </div>



                  <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white p-4 shadow-sm">

                    <div className="text-xs text-slate-500">

                      Jumlah Barang

                    </div>

                    <div className="mt-1 font-semibold text-slate-800">

                      {selectedProductSummary?.summary.jumlahBarang ?? 0}

                    </div>

                  </div>

                </div>



                {/* Current state */}

                <div>

                  <div className="mb-2 text-sm font-medium text-slate-700">

                    Current State

                  </div>



                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">

                      <div className="text-xs text-slate-500">

                        Pengiriman

                      </div>

                      <div className="mt-1 text-lg font-semibold text-slate-800">

                        {selectedProductSummary?.summary.totalPengiriman ?? 0}

                      </div>

                    </div>



                    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">

                      <div className="text-xs text-slate-500">

                        Penerimaan

                      </div>

                      <div className="mt-1 text-lg font-semibold text-slate-800">

                        {selectedProductSummary?.summary.totalPenerimaan ?? 0}

                      </div>

                    </div>



                    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">

                      <div className="text-xs text-slate-500">

                        Sisa Jahit

                      </div>

                      <div className="mt-1 text-lg font-semibold text-slate-800">

                        {selectedProductSummary?.summary.sisaJahit ?? 0}

                      </div>

                    </div>



                    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">

                      <div className="text-xs text-slate-500">

                        Barang di QC

                      </div>

                      <div className="mt-1 text-lg font-semibold text-slate-800">

                        {selectedProductSummary?.summary.barangDiQc ?? 0}

                      </div>

                    </div>

                  </div>

                </div>



                {/* Process */}

                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-700">

                    Proses Transaksi

                  </label>



                  {availableTransactionTypes.length === 0 ? (

                    <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 text-sm text-amber-700 shadow-sm">

                      Tidak ada proses yang tersedia untuk

                      SPK ini saat ini.

                    </div>

                  ) : (

                    <div className="relative">

                      <select

                        value={selectedTypeId}

                        onChange={(event) => {

                          setSelectedTypeId(

                            event.target.value,

                          );

                          setQuantity("");

                        }}

                        className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-3 pr-10 text-sm shadow-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"

                      >

                        <option value="">

                          Pilih proses...

                        </option>



                        {availableTransactionTypes.map(

                          (type) => (

                            <option

                              key={type.id}

                              value={type.id}

                            >

                              {type.name}

                            </option>

                          ),

                        )}

                      </select>



                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    </div>

                  )}

                </div>



                {/* Employee */}

                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-700">

                    Karyawan

                  </label>



                  <div className="relative">

                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />



                    <select

                      value={selectedEmployeeId}

                      onChange={(event) =>

                        setSelectedEmployeeId(

                          event.target.value,

                        )

                      }

                      className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm shadow-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"

                    >

                      <option value="">

                        Pilih karyawan...

                      </option>



                      {employees.map((employee) => (

                        <option

                          key={employee.id}

                          value={employee.id}

                        >

                          {employee.name}

                        </option>

                      ))}

                    </select>



                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  </div>

                </div>



                {/* Quantity */}

                <div>

                  <div className="mb-2 flex items-center justify-between">

                    <label className="text-sm font-medium text-slate-700">

                      Jumlah Barang

                    </label>



                    {maxQuantity !== null && (

                      <span className="text-xs text-slate-500">

                        Maximum:{" "}

                        <strong className="text-slate-800">

                          {maxQuantity}

                        </strong>

                      </span>

                    )}

                  </div>



                  <input

                    type="number"

                    min={1}

                    max={

                      maxQuantity !== null

                        ? maxQuantity

                        : undefined

                    }

                    value={quantity}

                    onChange={(event) =>

                      setQuantity(event.target.value)

                    }

                    placeholder="Masukkan jumlah..."

                    disabled={!selectedProductId || !selectedTypeId}

                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"

                  />



                  {maxQuantity !== null &&

                    selectedTypeId && (

                      <div className="mt-2 text-xs text-slate-500">

                        Quantity tidak boleh melebihi{" "}

                        <strong>{maxQuantity}</strong>.

                      </div>

                    )}

                </div>



                {/* Actions */}

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">

                  <button

                    type="button"

                    onClick={resetForm}

                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"

                  >

                    Reset

                  </button>



                  <button

                    type="submit"

                    disabled={

                      submitting ||
                      !selectedSpk ||
                      !selectedProductId ||
                      !selectedTypeId ||
                      !selectedEmployeeId ||
                      !quantity

                    }

                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"

                  >

                    {submitting ? (

                      <>

                        <Loader2 className="h-4 w-4 animate-spin" />

                        Menyimpan...

                      </>

                    ) : (

                      <>

                        <CheckCircle2 className="h-4 w-4" />

                        Simpan Transaksi

                      </>

                    )}

                  </button>

                </div>

              </>

            )}

          </form>

        </div>



        {/* SPK summary */}

        <div className="relative space-y-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50/30 p-4 md:p-6">

      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-violet-300/15 blur-3xl" />

          <div className="rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-slate-200/50 backdrop-blur">

            <div className="border-b border-indigo-50 px-6 py-5">

              <h2 className="text-base font-semibold text-slate-800">

                SPK Status

              </h2>

              <p className="mt-1 text-sm text-slate-500">

                State produksi saat ini.

              </p>

            </div>



            <div className="space-y-3 p-6">

              {!selectedSpk ? (

                <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 px-4 py-10 text-center">

                  <Package className="mx-auto h-8 w-8 text-slate-300" />

                  <p className="mt-3 text-sm text-slate-500">

                    Pilih SPK untuk melihat status.

                  </p>

                </div>

              ) : (

                <>

                  <div className="flex items-center justify-between">

                    <span className="text-sm text-slate-500">

                      SPK

                    </span>

                    <span className="font-semibold text-slate-800">

                      {selectedSpk.spkNumber}

                    </span>

                  </div>



                  <div className="flex items-center justify-between">

                    <span className="text-sm text-slate-500">

                      Status

                    </span>

                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">

                      {selectedSpk.status}

                    </span>

                  </div>



                  <div className="flex items-center justify-between">

                    <span className="text-sm text-slate-500">

                      Sisa Jahit

                    </span>

                    <span className="font-semibold text-slate-800">

                      {selectedProductSummary?.summary.sisaJahit ?? 0}

                    </span>

                  </div>



                  <div className="flex items-center justify-between">

                    <span className="text-sm text-slate-500">

                      Barang di QC

                    </span>

                    <span className="font-semibold text-slate-800">

                      {selectedProductSummary?.summary.barangDiQc ?? 0}

                    </span>

                  </div>



                  <div className="flex items-center justify-between">

                    <span className="text-sm text-slate-500">

                      Rijek

                    </span>

                    <span className="font-semibold text-slate-800">

                      {selectedProductSummary?.summary.jumlahRijek ?? 0}

                    </span>

                  </div>



                  <div className="border-t border-slate-100 pt-4">

                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">

                      Proses Berikutnya

                    </div>



                    <div className="mt-3 space-y-2">

                      {availableTransactionTypes.map(

                        (type) => (

                          <div

                            key={type.id}

                            className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-2.5 text-sm font-semibold text-indigo-700 transition hover:border-indigo-200 hover:shadow-sm"

                          >

                            {type.name}

                          </div>

                        ),

                      )}

                    </div>

                  </div>

                </>

              )}

            </div>

          </div>

        </div>

      </div>



      {/* Transaction History */}

      <div className="rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-slate-200/50 backdrop-blur">

        <div className="flex flex-col gap-3 border-b border-indigo-50 px-6 py-5 md:flex-row md:items-center md:justify-between">

          <div>

            <h2 className="text-base font-semibold text-slate-800">

              Transaction History

            </h2>

            <p className="mt-1 text-sm text-slate-500">

              Riwayat transaksi produksi yang sudah tercatat.

            </p>

          </div>



          <div className="relative w-full md:w-80">

            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />



            <input

              value={searchTransaction}

              onChange={(event) =>

                setSearchTransaction(event.target.value)

              }

              placeholder="Cari transaksi..."

              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"

            />

          </div>

        </div>



        <div className="overflow-x-auto">

          <table className="w-full min-w-[850px] text-left text-sm">

            <thead>

              <tr className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-violet-50/60">

                <th className="px-6 py-3 font-medium text-slate-500">

                  Transaction

                </th>

                <th className="px-6 py-3 font-medium text-slate-500">

                  SPK

                </th>

                <th className="px-6 py-3 font-medium text-slate-500">

                  Process

                </th>

                <th className="px-6 py-3 font-medium text-slate-500">

                  Employee

                </th>

                <th className="px-6 py-3 text-right font-medium text-slate-500">

                  Qty

                </th>

                <th className="px-6 py-3 font-medium text-slate-500">

                  Date

                </th>

              </tr>

            </thead>



            <tbody>

              {filteredTransactions.length === 0 ? (

                <tr>

                  <td

                    colSpan={6}

                    className="px-6 py-10 text-center text-sm text-slate-500"

                  >

                    Belum ada transaksi.

                  </td>

                </tr>

              ) : (

                filteredTransactions.map((transaction) => (

                  <tr

                    key={transaction.id}

                    className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/30"

                  >

                    <td className="px-6 py-4 font-medium text-slate-800">

                      {transaction.transactionNumber}

                    </td>



                    <td className="px-6 py-4 text-slate-600">

                      {transaction.spk.spkNumber}

                    </td>



                    <td className="px-6 py-4 text-slate-600">

                      {transaction.transactionType.name}

                    </td>



                    <td className="px-6 py-4 text-slate-600">

                      {transaction.employee.name}

                    </td>



                    <td className="px-6 py-4 text-right font-semibold text-slate-800">

                      {transaction.quantity}

                    </td>



                    <td className="px-6 py-4 text-slate-500">

                      {formatDate(transaction.createdAt)}

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );

}
