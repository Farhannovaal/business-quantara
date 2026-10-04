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



type SPK = {

  id: number;

  spkNumber: string;

  status:

    | "ACTIVE"

    | "COMPLETED"

    | "CANCELLED";

  items: Array<{
    id: number;
    quantity: number;
    product: {
      id: number;
      code: string;
      name: string;
    };
  }>;

  tailor: {

    id: number;

    name: string;

  };

  summary?: {

    jumlahBarang: number;

    barangDiQc: number;

    sisaJahit: number;

    jumlahRijek: number;

    nextTransactionTypes: string[];

  };

};



type TrackingSPK = {

  id: number;

  spkNumber: string;

  status:

    | "ACTIVE"

    | "COMPLETED"

    | "CANCELLED";

  items: Array<{
    id: number;
    quantity: number;
    product: {
      id: number;
      code: string;
      name: string;
    };
  }>;

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

  return new Intl.NumberFormat("id-ID").format(

    value,

  );

}



function formatCurrency(value: number) {

  return new Intl.NumberFormat("id-ID", {

    style: "currency",

    currency: "IDR",

    maximumFractionDigits: 0,

  }).format(value);

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

  if (code === "QC_RIJEK") {

    return "bg-amber-50 text-amber-700 ring-amber-200";

  }



  if (code === "QUALITY_CONTROL") {

    return "bg-violet-50 text-violet-700 ring-violet-200";

  }



  if (code === "QC_ACC_DIKIRIM_KE_GUDANG") {

    return "bg-emerald-50 text-emerald-700 ring-emerald-200";

  }



  if (code === "PENGIRIMAN_SIAP_JAHIT") {

    return "bg-blue-50 text-blue-700 ring-blue-200";

  }



  return "bg-cyan-50 text-cyan-700 ring-cyan-200";

}



export default function Home() {

  const [spks, setSpks] = useState<SPK[]>([]);

  const [transactions, setTransactions] =

    useState<Transaction[]>([]);

  const [products, setProducts] = useState<Product[]>([]);

  const [trackingSpks, setTrackingSpks] =

    useState<TrackingSPK[]>([]);



  const [billingSummary, setBillingSummary] =

    useState<BillingSummary | null>(null);



  const [billingLoading, setBillingLoading] =

    useState(true);



  const [generatingBilling, setGeneratingBilling] =

    useState(false);



  const [showBillingConfirm, setShowBillingConfirm] =

    useState(false);



  const [billingMessage, setBillingMessage] =

    useState("");



  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] =

    useState(false);

  const [error, setError] = useState("");



  async function loadDashboard(

    showLoader = true,

  ) {

    try {

      if (showLoader) {

        setLoading(true);

      } else {

        setRefreshing(true);

      }



      setError("");



      const [

        spkResponse,

        transactionResponse,

        productResponse,

        trackingResponse,

        billingResponse,

      ] = await Promise.all([

        fetch("/api/spks", {

          cache: "no-store",

        }),



        fetch("/api/transactions", {

          cache: "no-store",

        }),



        fetch("/api/products", {

          cache: "no-store",

        }),



        fetch("/api/tracking", {

          cache: "no-store",

        }),



        fetch("/api/tailor-billing/summary", {

          cache: "no-store",

        }),

      ]);



      if (!spkResponse.ok) {

        throw new Error(

          "Gagal mengambil data SPK.",

        );

      }



      if (!transactionResponse.ok) {

        throw new Error(

          "Gagal mengambil data transaksi.",

        );

      }



      if (!productResponse.ok) {

        throw new Error(

          "Gagal mengambil data produk.",

        );

      }



      if (!trackingResponse.ok) {

        throw new Error(

          "Gagal mengambil data tracking.",

        );

      }



      if (!billingResponse.ok) {

        throw new Error(

          "Gagal mengambil summary billing penjahit.",

        );

      }



      const [

        spkJson,

        transactionJson,

        productJson,

        trackingJson,

        billingJson,

      ] = await Promise.all([

        spkResponse.json(),

        transactionResponse.json(),

        productResponse.json(),

        trackingResponse.json(),

        billingResponse.json(),

      ]);



      if (!billingJson.success) {

        throw new Error(

          billingJson.error ||

            "Gagal mengambil summary billing penjahit.",

        );

      }



      setSpks(spkJson.data ?? []);

      setTransactions(transactionJson.data ?? []);

      setProducts(productJson.data ?? []);

      setTrackingSpks(trackingJson.data ?? []);



      setBillingSummary(

        billingJson.data ?? null,

      );



      setBillingMessage("");

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "Gagal memuat dashboard.",

      );

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

    () =>

      spks.filter(

        (spk) => spk.status === "ACTIVE",

      ),

    [spks],

  );



  const todayTransactions = useMemo(

    () =>

      transactions.filter((transaction) =>

        isToday(transaction.createdAt),

      ),

    [transactions],

  );



  const activeTrackingSpks = useMemo(

    () =>

      trackingSpks.filter(

        (spk) => spk.status === "ACTIVE",

      ),

    [trackingSpks],

  );



  const inProduction = useMemo(

    () =>

      activeTrackingSpks.reduce(

        (total, spk) =>

          total +

          Number(

            spk.summary.jumlahBarang ?? 0,

          ),

        0,

      ),

    [activeTrackingSpks],

  );



  const activeProducts = useMemo(

    () =>

      products.filter(

        (product) => product.isActive,

      ),

    [products],

  );



  const recentTransactions =

    transactions.slice(0, 5);



  const statTones: Record<

    "indigo" | "cyan" | "violet" | "emerald",

    {

      icon: string;

      value: string;

      ring: string;

    }

  > = {

    indigo: {

      icon: "bg-indigo-50 text-indigo-600",

      value: "text-indigo-700",

      ring:

        "hover:border-indigo-200 hover:shadow-indigo-100",

    },



    cyan: {

      icon: "bg-cyan-50 text-cyan-600",

      value: "text-cyan-700",

      ring:

        "hover:border-cyan-200 hover:shadow-cyan-100",

    },



    violet: {

      icon: "bg-violet-50 text-violet-600",

      value: "text-violet-700",

      ring:

        "hover:border-violet-200 hover:shadow-violet-100",

    },



    emerald: {

      icon: "bg-emerald-50 text-emerald-600",

      value: "text-emerald-700",

      ring:

        "hover:border-emerald-200 hover:shadow-emerald-100",

    },

  };



  const stats: Array<{

    label: string;

    value: string;

    description: string;

    icon: typeof ClipboardList;

    tone:

      | "indigo"

      | "cyan"

      | "violet"

      | "emerald";

  }> = [

    {

      label: "Active SPK",

      value: formatNumber(

        activeSpks.length,

      ),

      description:

        "Production orders running",

      icon: ClipboardList,

      tone: "indigo",

    },



    {

      label: "Today's Transactions",

      value: formatNumber(

        todayTransactions.length,

      ),

      description: "Recorded today",

      icon: Activity,

      tone: "cyan",

    },



    {

      label: "In Production",

      value: formatNumber(inProduction),

      description:

        "Items currently in process",

      icon: Factory,

      tone: "violet",

    },



    {

      label: "Active Products",

      value: formatNumber(

        activeProducts.length,

      ),

      description:

        "Active product master data",

      icon: Boxes,

      tone: "emerald",

    },

  ];



  async function generateAllBilling() {

    try {

      setGeneratingBilling(true);

      setBillingMessage("");

      setError("");



      const response = await fetch(

        "/api/tailor-billing/generate-all",

        {

          method: "POST",

        },

      );



      const result = await response.json();



      if (!response.ok || !result.success) {

        throw new Error(

          result.error ||

            "Gagal generate semua billing.",

        );

      }



      const data = result.data;



      setShowBillingConfirm(false);



      setBillingMessage(

        data.createdBills > 0

          ? `${data.createdBills} billing berhasil dibuat sebagai Draft.`

          : result.message ||

              "Tidak ada billing yang dibuat.",

      );



      await loadDashboard(false);

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "Gagal generate semua billing.",

      );

    } finally {

      setGeneratingBilling(false);

    }

  }



  if (loading) {

    return (

      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">

        <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white px-5 py-4 text-sm font-semibold text-indigo-600 shadow-xl shadow-indigo-100">

          <Loader2 className="h-5 w-5 animate-spin" />

          Memuat dashboard...

        </div>

      </div>

    );

  }



  return (

    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/10 to-violet-50/10">

      <main className="min-h-screen pb-24 lg:ml-64 lg:pb-0">







        <div className="relative p-4 sm:p-6 lg:p-8">




          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-indigo-300/15 blur-3xl" />



          <div className="pointer-events-none absolute left-0 top-40 h-64 w-64 rounded-full bg-violet-300/10 blur-3xl" />







          <div className="relative mb-6 sm:mb-8">

            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-indigo-600 shadow-sm sm:text-xs">

              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />



              System operational

            </div>



            <h2 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">

              Good morning, Administrator

            </h2>



            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">

              Here's what's happening with

              your business operations today.

            </p>

          </div>





          {error && (

            <div className="relative mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">

              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />



              <span className="flex-1">

                {error}

              </span>



              <button

                type="button"

                onClick={() => setError("")}

                className="rounded-lg p-1 text-rose-400 transition hover:bg-rose-100 hover:text-rose-600"

              >

                <X className="h-4 w-4" />

              </button>

            </div>

          )}



          <div className="relative mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">

            {stats.map((stat) => {

              const Icon = stat.icon;



              const tone =

                statTones[stat.tone];



              return (

                <div

                  key={stat.label}

                  className={`group rounded-2xl border border-white/80 bg-white p-4 shadow-lg shadow-slate-200/40 backdrop-blur transition hover:-translate-y-0.5 sm:p-5 ${tone.ring}`}

                >

                  <div className="mb-4 flex items-center justify-between sm:mb-5">

                    <div

                      className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${tone.icon}`}

                    >

                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />

                    </div>



                    <span className="hidden rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:inline-flex">

                      Live

                    </span>

                  </div>



                  <p

                    className={`text-2xl font-bold sm:text-3xl ${tone.value}`}

                  >

                    {stat.value}

                  </p>



                  <p className="mt-1.5 text-xs font-bold text-slate-700 sm:mt-2 sm:text-sm">

                    {stat.label}

                  </p>



                  <p className="mt-1 hidden text-xs text-slate-400 sm:block">

                    {stat.description}

                  </p>

                </div>

              );

            })}

          </div>








          <PermissionGate permission="tailor-billing.view">

            <div className="relative mb-6 overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-xl shadow-indigo-100/40 sm:mb-8">

              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-indigo-100/50 blur-3xl" />



              <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-violet-100/40 blur-3xl" />



              <div className="relative p-4 sm:p-6">

                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                  <div className="flex items-start gap-3 sm:gap-4">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 sm:h-12 sm:w-12 sm:rounded-2xl">

                      <CircleDollarSign className="h-5 w-5 sm:h-6 sm:w-6" />

                    </div>



                    <div>

                      <div className="flex flex-wrap items-center gap-2">

                        <h3 className="text-sm font-bold text-slate-800 sm:text-base">

                          Billing Penjahit

                        </h3>



                        <span className="rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-indigo-600 sm:px-2.5 sm:text-[10px]">

                          Live

                        </span>

                      </div>



                      <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">

                        Quantity QC ACC yang sudah

                        siap dibuatkan billing.

                      </p>

                    </div>

                  </div>



                  {billingLoading ? (

                    <div className="flex items-center gap-2 text-xs font-medium text-slate-400 sm:text-sm">

                      <Loader2 className="h-4 w-4 animate-spin" />



                      Menghitung billing...

                    </div>

                  ) : billingSummary ? (

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">

                      <BillingMetric

                        label="SPK Siap"

                        value={formatNumber(

                          billingSummary.readySpkCount,

                        )}

                      />



                      <BillingMetric

                        label="Penjahit"

                        value={formatNumber(

                          billingSummary.readyTailorCount,

                        )}

                      />



                      <BillingMetric

                        label="Quantity"

                        value={`${formatNumber(

                          billingSummary.readyQuantity,

                        )} pcs`}

                      />



                      <BillingMetric

                        label="Estimasi"

                        value={formatCurrency(

                          billingSummary.readyAmount,

                        )}

                      />

                    </div>

                  ) : (

                    <div className="text-xs text-slate-400 sm:text-sm">

                      Data billing tidak

                      tersedia.

                    </div>

                  )}

                </div>






                {billingSummary &&

                  billingSummary.readySpkCount >

                    0 && (

                    <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-5 lg:flex-row lg:items-center lg:justify-between">

                      <div>

                        <p className="text-sm font-semibold text-slate-700">

                          Ada{" "}

                          {formatNumber(

                            billingSummary.readySpkCount,

                          )}{" "}

                          SPK yang siap

                          ditagihkan.

                        </p>



                        <p className="mt-1 text-xs text-slate-400">

                          Generate akan membuat

                          satu Draft Billing untuk

                          setiap penjahit.

                        </p>

                      </div>



                      <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">

                        <Link

                          href="/master/tailor-billing"

                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 sm:w-auto"

                        >

                          Lihat Billing



                          <ArrowRight className="h-4 w-4" />

                        </Link>



                        <PermissionGate permission="tailor-billing.create">

                          <button

                            type="button"

                            onClick={() =>

                              setShowBillingConfirm(

                                true,

                              )

                            }

                            disabled={

                              generatingBilling

                            }

                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"

                          >

                            <CircleDollarSign className="h-4 w-4" />



                            Generate Semua

                            Billing

                          </button>

                        </PermissionGate>

                      </div>

                    </div>

                  )}






                {billingSummary &&

                  billingSummary.readySpkCount ===

                    0 && (

                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">

                      <div className="flex items-start gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">

                          <Check className="h-4 w-4" />

                        </div>



                        <div>

                          <p className="text-sm font-semibold text-slate-700">

                            Tidak ada billing yang

                            menunggu dibuat.

                          </p>



                          <p className="mt-1 text-xs text-slate-400">

                            Semua quantity yang saat

                            ini sudah memenuhi syarat

                            telah ditagihkan.

                          </p>

                        </div>

                      </div>



                      <Link

                        href="/master/tailor-billing"

                        className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"

                      >

                        Lihat Billing



                        <ArrowRight className="h-4 w-4" />

                      </Link>

                    </div>

                  )}






                {billingSummary &&

                  billingSummary.missingRateSpkCount >

                    0 && (

                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">

                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />



                      <div>

                        <p className="text-xs font-bold text-amber-800">

                          Ada{" "}

                          {formatNumber(

                            billingSummary.missingRateSpkCount,

                          )}{" "}

                          SPK yang belum memiliki

                          tarif penjahit.

                        </p>



                        <p className="mt-1 text-xs text-amber-700">

                          SPK tersebut tidak akan

                          ikut dalam Generate Semua

                          Billing.

                        </p>

                      </div>

                    </div>

                  )}






                {billingMessage && (

                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700 sm:text-sm">

                    <Check className="h-4 w-4 shrink-0" />



                    {billingMessage}

                  </div>

                )}

              </div>

            </div>

          </PermissionGate>








          <div className="relative grid gap-6 xl:grid-cols-3">




            <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-slate-200/50 xl:col-span-2">

              <div className="flex items-center justify-between border-b border-indigo-50 px-4 py-4 sm:px-6 sm:py-5">

                <div>

                  <h3 className="text-sm font-bold text-slate-800">

                    Recent Transactions

                  </h3>



                  <p className="mt-1 text-xs text-slate-400">

                    Latest operational activities

                  </p>

                </div>



                <Link

                  href="/operations/transactions"

                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 transition hover:text-indigo-700"

                >

                  View all



                  <ArrowRight className="h-3.5 w-3.5" />

                </Link>

              </div>



              {recentTransactions.length ===

              0 ? (

                <div className="px-6 py-14 text-center">

                  <Activity className="mx-auto h-8 w-8 text-slate-300" />



                  <p className="mt-3 text-sm font-semibold text-slate-600">

                    No transactions yet

                  </p>



                  <p className="mt-1 text-xs text-slate-400">

                    Transactions will appear here

                    once recorded.

                  </p>

                </div>

              ) : (

                <div className="divide-y divide-slate-100">

                  {recentTransactions.map(

                    (transaction) => (

                      <div

                        key={transaction.id}

                        className="flex gap-3 px-4 py-4 transition hover:bg-indigo-50/30 sm:items-center sm:justify-between sm:gap-4 sm:px-6"

                      >

                        <div className="flex min-w-0 items-start gap-3">

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:h-10 sm:w-10">

                            <Activity className="h-4 w-4" />

                          </div>



                          <div className="min-w-0">

                            <p className="truncate text-sm font-bold text-slate-800">

                              {

                                transaction

                                  .transactionType

                                  .name

                              }

                            </p>



                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-400 sm:text-xs">

                              <span>

                                {

                                  transaction.transactionNumber

                                }

                              </span>



                              <span className="hidden sm:inline">

                                •

                              </span>



                              <span>

                                {

                                  transaction.spk

                                    .spkNumber

                                }

                              </span>



                              <span className="hidden sm:inline">

                                •

                              </span>



                              <span className="hidden sm:inline">

                                {

                                  transaction.employee

                                    .name

                                }

                              </span>

                            </div>



                            <p className="mt-1 text-[10px] text-slate-400 sm:hidden">

                              {

                                transaction.employee

                                  .name

                              }

                            </p>



                            <div className="mt-2 sm:hidden">

                              <span

                                className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ${transactionTone(

                                  transaction

                                    .transactionType

                                    .code,

                                )}`}

                              >

                                Recorded

                              </span>

                            </div>

                          </div>

                        </div>



                        <div className="shrink-0 text-right">

                          <p className="text-sm font-bold text-slate-800">

                            {formatNumber(

                              transaction.quantity,

                            )}

                          </p>



                          <p className="text-[9px] uppercase tracking-wide text-slate-400 sm:text-[10px]">

                            units

                          </p>



                          <div className="mt-1 hidden sm:block">

                            <p className="text-xs font-medium text-slate-500">

                              {formatTime(

                                transaction.createdAt,

                              )}

                            </p>



                            <span

                              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${transactionTone(

                                transaction

                                  .transactionType

                                  .code,

                              )}`}

                            >

                              Recorded

                            </span>

                          </div>

                        </div>

                      </div>

                    ),

                  )}

                </div>

              )}

            </div>






            <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-slate-200/50">

              <div className="border-b border-indigo-50 px-4 py-4 sm:px-6 sm:py-5">

                <h3 className="text-sm font-bold text-slate-800">

                  Quick Actions

                </h3>



                <p className="mt-1 text-xs text-slate-400">

                  Common operational tasks

                </p>

              </div>



              <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 xl:grid-cols-1">

                <QuickAction

                  href="/operations/spk"

                  icon={ClipboardList}

                  title="Create SPK"

                  description="Create a new production order"

                />



                <QuickAction

                  href="/operations/transactions"

                  icon={Activity}

                  title="Record Transaction"

                  description="Record operational activity"

                />



                <QuickAction

                  href="/operations/tracking"

                  icon={BarChart3}

                  title="Track Production"

                  description="Monitor production journey"

                />



                <QuickAction

                  href="/automation/workflows"

                  icon={Workflow}

                  title="Manage Workflow"

                  description="Configure business processes"

                />

              </div>

            </div>

          </div>








          <div className="relative mt-6 overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-slate-200/50">

            <div className="flex items-center justify-between border-b border-indigo-50 px-4 py-4 sm:px-6 sm:py-5">

              <div>

                <h3 className="text-sm font-bold text-slate-800">

                  Active Production

                </h3>



                <p className="mt-1 text-xs text-slate-400">

                  Current production orders and

                  their position.

                </p>

              </div>



              <Link

                href="/operations/tracking"

                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"

              >

                Open tracking

              </Link>

            </div>



            <div className="overflow-x-auto">

              <table className="w-full min-w-[720px] text-left text-sm">

                <thead>

                  <tr className="border-b border-indigo-50 bg-gradient-to-r from-indigo-50/70 to-violet-50/50">

                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">

                      SPK

                    </th>



                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">

                      Product

                    </th>



                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">

                      Tailor

                    </th>



                    <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400">

                      Items

                    </th>



                    <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400">

                      Position

                    </th>

                  </tr>

                </thead>



                <tbody>

                  {activeTrackingSpks

                    .slice(0, 5)

                    .map((spk) => {

                      const position =

                        spk.summary

                          .barangDiQc > 0

                          ? "QC"

                          : spk.summary

                                .sisaJahit >

                            0

                            ? "Jahit"

                            : spk.summary

                                  .jumlahRijek >

                              0

                              ? "Rijek"

                              : spk.summary

                                    .jumlahBarang >

                                0

                                ? "Production"

                                : "Belum mulai";



                      return (

                        <tr

                          key={spk.id}

                          className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/30"

                        >

                          <td className="px-6 py-4">

                            <Link

                              href={`/operations/spk/${spk.id}`}

                              className="font-bold text-indigo-600 hover:text-indigo-700"

                            >

                              {spk.spkNumber}

                            </Link>

                          </td>



                          <td className="px-6 py-4 text-slate-600">

                            {spk.items?.length ? (
  spk.items.map((item) => (
    <div
      key={item.id}
      className="flex items-center justify-between gap-4"
    >
      <span className="font-medium text-slate-700">
        {item.product?.name ?? "-"}
      </span>

      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
        {formatNumber(item.quantity)} pcs
      </span>
    </div>
  ))
) : (
  "-"
)}

                          </td>



                          <td className="px-6 py-4 text-slate-600">

                            {spk.tailor.name}

                          </td>



                          <td className="px-6 py-4 text-right font-bold text-slate-800">

                            {formatNumber(

                              spk.summary

                                .jumlahBarang,

                            )}

                          </td>



                          <td className="px-6 py-4 text-right">

                            <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 ring-1 ring-violet-200">

                              {position}

                            </span>

                          </td>

                        </tr>

                      );

                    })}



                  {activeTrackingSpks.length ===

                    0 && (

                    <tr>

                      <td

                        colSpan={5}

                        className="px-6 py-12 text-center text-sm text-slate-400"

                      >

                        No active production

                        orders.

                      </td>

                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </div>

        </div>

      </main>








      {showBillingConfirm &&

        billingSummary && (

          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">

            <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl">

              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">

                <div className="flex items-start justify-between">

                  <div>

                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">

                      <CircleDollarSign className="h-5 w-5" />

                    </div>



                    <h3 className="text-lg font-bold text-slate-800">

                      Generate Semua Billing?

                    </h3>



                    <p className="mt-1 text-sm text-slate-500">

                      Sistem akan membuat billing

                      sebagai{" "}

                      <strong>Draft</strong>.

                    </p>

                  </div>



                  <button

                    type="button"

                    onClick={() =>

                      setShowBillingConfirm(

                        false,

                      )

                    }

                    disabled={generatingBilling}

                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"

                  >

                    <X className="h-5 w-5" />

                  </button>

                </div>

              </div>



              <div className="space-y-3 px-5 py-5 sm:px-6">

                <div className="rounded-2xl bg-slate-50 p-4">

                  <div className="grid grid-cols-2 gap-4">

                    <div>

                      <p className="text-xs text-slate-400">

                        Penjahit

                      </p>



                      <p className="mt-1 text-lg font-bold text-slate-800">

                        {formatNumber(

                          billingSummary.readyTailorCount,

                        )}

                      </p>

                    </div>



                    <div>

                      <p className="text-xs text-slate-400">

                        SPK

                      </p>



                      <p className="mt-1 text-lg font-bold text-slate-800">

                        {formatNumber(

                          billingSummary.readySpkCount,

                        )}

                      </p>

                    </div>



                    <div>

                      <p className="text-xs text-slate-400">

                        Quantity

                      </p>



                      <p className="mt-1 text-lg font-bold text-slate-800">

                        {formatNumber(

                          billingSummary.readyQuantity,

                        )}{" "}

                        pcs

                      </p>

                    </div>



                    <div>

                      <p className="text-xs text-slate-400">

                        Estimasi Total

                      </p>



                      <p className="mt-1 text-lg font-bold text-indigo-700">

                        {formatCurrency(

                          billingSummary.readyAmount,

                        )}

                      </p>

                    </div>

                  </div>

                </div>



                <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-xs leading-5 text-cyan-700">

                  Generate hanya membuat{" "}

                  <strong>Draft Billing</strong>.

                  Pembayaran tetap harus melalui

                  proses Submit dan Pay.

                </div>

              </div>



              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">

                <button

                  type="button"

                  onClick={() =>

                    setShowBillingConfirm(

                      false,

                    )

                  }

                  disabled={generatingBilling}

                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"

                >

                  Batal

                </button>



                <PermissionGate permission="tailor-billing.create">

                  <button

                    type="button"

                    onClick={

                      generateAllBilling

                    }

                    disabled={generatingBilling}

                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"

                  >

                    {generatingBilling ? (

                      <>

                        <Loader2 className="h-4 w-4 animate-spin" />



                        Generating...

                      </>

                    ) : (

                      <>

                        <Check className="h-4 w-4" />



                        Generate Billing

                      </>

                    )}

                  </button>

                </PermissionGate>

              </div>

            </div>

          </div>

        )}

    </div>

  );

}



function BillingMetric({

  label,

  value,

}: {

  label: string;

  value: string;

}) {

  return (

    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 sm:min-w-[120px] sm:rounded-2xl sm:px-4 sm:py-3">

      <p className="truncate text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">

        {label}

      </p>



      <p className="mt-1 truncate text-xs font-bold text-slate-800 sm:text-sm">

        {value}

      </p>

    </div>

  );

}



function QuickAction({

  href,

  icon: Icon,

  title,

  description,

}: {

  href: string;

  icon: typeof Activity;

  title: string;

  description: string;

}) {

  return (

    <Link

      href={href}

      className="group flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-indigo-50/60 hover:shadow-sm"

    >

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100 transition group-hover:bg-indigo-600 group-hover:text-white">

        <Icon className="h-4 w-4" />

      </div>



      <div className="min-w-0">

        <p className="text-sm font-bold text-slate-700">

          {title}

        </p>



        <p className="mt-0.5 text-xs text-slate-400">

          {description}

        </p>

      </div>



      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />

    </Link>

  );

}
