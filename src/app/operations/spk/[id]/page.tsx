"use client";

import Link from "next/link";

import { useParams } from "next/navigation";

import { useEffect, useState } from "react";

import {

  ArrowLeft,

  Package,

  UserRound,

  Activity,

  RefreshCw,

  Loader2,

  ArrowRight,

} from "lucide-react";

type Transaction = {

  id: number;

  transactionNumber: string;

  quantity: number;

  createdAt: string;

  product?: {

    id: number;

    code: string;

    name: string;

  } | null;

  transactionType: {

    id: number;

    code: string;

    name: string;

  };

  employee: {

    id: number;

    name: string;

  };

};

type Product = {

  id: number;

  code: string;

  name: string;

};

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

  nextTransactionTypes: string[];

};

type SPKItem = {

  id: number;

  productId: number;

  quantity: number;

  product: Product;

};

type ProductSummary = {

  productId: number;

  product: Product;

  quantity: number;

  summary: Summary;

};

type SPKDetail = {

  id: number;

  spkNumber: string;

  tailorId: number;

  status: "ACTIVE" | "COMPLETED" | "CANCELLED";

  createdAt: string;

  updatedAt: string;

  items: SPKItem[];

  tailor: {

    id: number;

    name: string;

  };

  transactions: Transaction[];

  summary: Summary;

  productSummaries: ProductSummary[];

};

export default function SPKDetailPage() {

  const params = useParams();

  const id = params.id as string;

  const [spk, setSpk] = useState<SPKDetail | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  async function loadSpk() {

    try {

      setLoading(true);

      setError("");

      const response = await fetch(`/api/spks/${id}`, {

        cache: "no-store",

      });

      const result = await response.json();

      if (!response.ok || !result.success) {

        throw new Error(result.error || "Gagal mengambil detail SPK");

      }

      setSpk(result.data);

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "Gagal mengambil detail SPK",

      );

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    if (id) {

      loadSpk();

    }

  }, [id]);

  function getStatusStyle(status: SPKDetail["status"]) {

    switch (status) {

      case "ACTIVE":

        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";

      case "COMPLETED":

        return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300";

      case "CANCELLED":

        return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300";

      default:

        return "border-border bg-muted text-foreground";

    }

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

  function getTransactionLabel(code: string) {

    const labels: Record<string, string> = {

      PENGIRIMAN_SIAP_JAHIT: "Pengiriman Siap Jahit",

      PENERIMAAN_DARI_PENJAHIT: "Penerimaan dari Penjahit",

      QUALITY_CONTROL: "Quality Control",

      QC_RIJEK: "QC / Rijek",

      QC_ACC_DIKIRIM_KE_GUDANG: "QC / ACC Dikirim ke Gudang",

      PENGIRIMAN_RIJEK: "Pengiriman Rijek",

      PENERIMAAN_RIJEK: "Penerimaan Rijek",

    };

    return labels[code] || code;

  }

  if (loading) {

    return (

      <div className="min-h-screen bg-background p-4 text-foreground sm:p-6">

        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center">

          <div className="flex items-center gap-2 text-sm text-muted-foreground">

            <Loader2 size={18} className="animate-spin" />

            Loading SPK...

          </div>

        </div>

      </div>

    );

  }

  if (error || !spk) {

    return (

      <div className="min-h-screen bg-background p-4 text-foreground sm:p-6">

        <div className="mx-auto max-w-7xl">

          <Link

            href="/operations/spk"

            className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"

          >

            <ArrowLeft size={16} className="text-rose-600 dark:text-rose-400" />

            Back to SPK

          </Link>

          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">

            {error || "SPK tidak ditemukan."}

          </div>

        </div>

      </div>

    );

  }

  return (

    <div className="min-h-screen bg-background p-4 text-foreground sm:p-6">

      <div className="mx-auto max-w-7xl">

        <Link

          href="/operations/spk"

          className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"

        >

          <ArrowLeft size={16} className="text-rose-600 dark:text-rose-400" />

          Back to SPK

        </Link>

        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">

          <div>

            <div className="flex flex-wrap items-center gap-3">

              <h1 className="text-2xl font-semibold text-foreground">

                {spk.spkNumber}

              </h1>

              <span

                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyle(

                  spk.status,

                )}`}

              >

                {spk.status}

              </span>

            </div>

            <p className="mt-1 text-sm text-muted-foreground">

              Production tracking dan transaction history.

            </p>

          </div>

          <button

            type="button"

            onClick={loadSpk}

            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"

          >

            <RefreshCw size={16} className="text-rose-600 dark:text-rose-400" />

            Refresh

          </button>

        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:col-span-1">

            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">

              <Package size={17} />

              Products

            </div>

            <div className="space-y-3">

              {spk.items.length === 0 ? (

                <div className="text-sm text-muted-foreground">

                  Tidak ada product.

                </div>

              ) : (

                spk.items.map((item) => (

                  <div

                    key={item.id}

                    className="rounded-lg border border-border/70 bg-muted px-3 py-2.5"

                  >

                    <div className="flex items-center justify-between gap-3">

                      <div className="min-w-0">

                        <div className="truncate font-semibold text-foreground">

                          {item.product.name}

                        </div>

                        <div className="mt-0.5 text-xs text-muted-foreground">

                          {item.product.code}

                        </div>

                      </div>

                      <span className="shrink-0 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-foreground ring-1 ring-white/10">

                        {formatNumber(item.quantity)} pcs

                      </span>

                    </div>

                  </div>

                ))

              )}

            </div>

          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">

            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">

              <UserRound size={17} />

              Penjahit

            </div>

            <div className="font-semibold text-foreground">

              {spk.tailor.name}

            </div>

            <div className="mt-1 text-sm text-muted-foreground">

              {spk.items.length} product dalam SPK

            </div>

          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">

            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">

              <Activity size={17} />

              Transactions

            </div>

            <div className="font-semibold text-foreground">

              {spk.transactions.length}

            </div>

            <div className="mt-1 text-sm text-muted-foreground">

              Total recorded transactions

            </div>

          </div>

        </div>

        <div className="mb-6">

          <div className="mb-3">

            <h2 className="text-lg font-semibold text-foreground">

              Production Summary

            </h2>

            <p className="mt-1 text-sm text-muted-foreground">

              Current production state berdasarkan transaction.

            </p>

          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <SummaryCard

              label="Total Pengiriman"

              value={spk.summary.totalPengiriman}

            />

            <SummaryCard

              label="Total Penerimaan"

              value={spk.summary.totalPenerimaan}

            />

            <SummaryCard

              label="Sisa Jahit"

              value={spk.summary.sisaJahit}

              highlight

            />

            <SummaryCard

              label="Barang di QC"

              value={spk.summary.barangDiQc}

              highlight

            />

            <SummaryCard

              label="QC Rijek"

              value={spk.summary.totalQcRijek}

            />

            <SummaryCard

              label="QC ACC"

              value={spk.summary.totalQcAcc}

            />

            <SummaryCard

              label="Rijek"

              value={spk.summary.jumlahRijek}

            />

            <SummaryCard

              label="Total Barang"

              value={spk.summary.jumlahBarang}

              highlight

            />

          </div>

        </div>

        <div className="mb-6 rounded-xl border border-border bg-card shadow-sm">

          <div className="border-b border-border px-5 py-4">

            <h2 className="font-semibold text-foreground">

              Product Production Summary

            </h2>

            <p className="mt-1 text-sm text-muted-foreground">

              Production state dan next process untuk setiap product dalam SPK.

            </p>

          </div>

          <div className="divide-y divide-border">

            {spk.productSummaries.length === 0 ? (

              <div className="px-5 py-6 text-sm text-muted-foreground">

                Tidak ada product summary.

              </div>

            ) : (

              spk.productSummaries.map((item) => (

                <div key={item.productId} className="p-5">

                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                    <div>

                      <div className="font-semibold text-foreground">

                        {item.product.name}

                      </div>

                      <div className="mt-0.5 text-xs text-muted-foreground">

                        {item.product.code}

                      </div>

                    </div>

                    <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground ring-1 ring-white/10">

                      Qty SPK: {formatNumber(item.quantity)} pcs

                    </span>

                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                    <SummaryCard

                      label="Pengiriman"

                      value={item.summary.totalPengiriman}

                    />

                    <SummaryCard

                      label="Penerimaan"

                      value={item.summary.totalPenerimaan}

                    />

                    <SummaryCard

                      label="Sisa Jahit"

                      value={item.summary.sisaJahit}

                      highlight

                    />

                    <SummaryCard

                      label="Barang di QC"

                      value={item.summary.barangDiQc}

                      highlight

                    />

                    <SummaryCard

                      label="QC Rijek"

                      value={item.summary.totalQcRijek}

                    />

                    <SummaryCard

                      label="QC ACC"

                      value={item.summary.totalQcAcc}

                    />

                    <SummaryCard

                      label="Rijek"

                      value={item.summary.jumlahRijek}

                    />

                    <SummaryCard

                      label="Total Barang"

                      value={item.summary.jumlahBarang}

                      highlight

                    />

                  </div>

                  <div className="mt-4">

                    <div className="mb-2 text-sm font-semibold text-foreground">

                      Next Allowed Process

                    </div>

                    {item.summary.nextTransactionTypes.length === 0 ? (

                      <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">

                        Tidak ada process berikutnya.

                      </div>

                    ) : (

                      <div className="flex flex-wrap gap-2">

                        {item.summary.nextTransactionTypes.map((code) => (

                          <div

                            key={code}

                            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"

                          >

                            <ArrowRight size={15} className="text-rose-600 dark:text-rose-400" />

                            {getTransactionLabel(code)}

                          </div>

                        ))}

                      </div>

                    )}

                  </div>

                </div>

              ))

            )}

          </div>

        </div>

        <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">

          <div className="mb-4">

            <h2 className="font-semibold text-foreground">

              Next Allowed Process

            </h2>

            <p className="mt-1 text-sm text-muted-foreground">

              Transaction yang saat ini diperbolehkan berdasarkan state seluruh SPK.

            </p>

          </div>

          {spk.summary.nextTransactionTypes.length === 0 ? (

            <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">

              Tidak ada process berikutnya.

            </div>

          ) : (

            <div className="flex flex-wrap gap-2">

              {spk.summary.nextTransactionTypes.map((code) => (

                <div

                  key={code}

                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"

                >

                  <ArrowRight size={15} className="text-rose-600 dark:text-rose-400" />

                  {getTransactionLabel(code)}

                </div>

              ))}

            </div>

          )}

        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">

          <div className="border-b border-border px-5 py-4">

            <h2 className="font-semibold text-foreground">

              Transaction History

            </h2>

            <p className="mt-1 text-sm text-muted-foreground">

              Semua transaction yang tercatat untuk SPK ini.

            </p>

          </div>

          {spk.transactions.length === 0 ? (

            <div className="flex min-h-48 items-center justify-center px-5 text-center">

              <div>

                <p className="font-medium text-foreground">

                  Belum ada transaction

                </p>

                <p className="mt-1 text-sm text-muted-foreground">

                  Transaction pertama untuk SPK ini belum dibuat.

                </p>

              </div>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[900px]">

                <thead>

                  <tr className="border-b border-border bg-muted">

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">

                      Date

                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">

                      Product

                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">

                      Transaction

                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">

                      Number

                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">

                      Quantity

                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">

                      Employee

                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-border">

                  {spk.transactions.map((transaction) => (

                    <tr

                      key={transaction.id}

                      className="hover:bg-muted"

                    >

                      <td className="px-5 py-4 text-sm text-muted-foreground">

                        {formatDate(transaction.createdAt)}

                      </td>

                      <td className="px-5 py-4">

                        {transaction.product ? (

                          <>

                            <div className="text-sm font-medium text-foreground">

                              {transaction.product.name}

                            </div>

                            <div className="mt-0.5 text-xs text-muted-foreground">

                              {transaction.product.code}

                            </div>

                          </>

                        ) : (

                          <span className="text-sm text-muted-foreground">-</span>

                        )}

                      </td>

                      <td className="px-5 py-4">

                        <div className="text-sm font-medium text-foreground">

                          {getTransactionLabel(

                            transaction.transactionType.code,

                          )}

                        </div>

                        <div className="mt-0.5 text-xs text-muted-foreground">

                          {transaction.transactionType.code}

                        </div>

                      </td>

                      <td className="px-5 py-4 text-sm text-muted-foreground">

                        {transaction.transactionNumber}

                      </td>

                      <td className="px-5 py-4 text-right text-sm font-semibold text-foreground">

                        {formatNumber(transaction.quantity)}

                      </td>

                      <td className="px-5 py-4 text-sm text-foreground">

                        {transaction.employee.name}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </div>

  );

}

function SummaryCard({

  label,

  value,

  highlight = false,

}: {

  label: string;

  value: number;

  highlight?: boolean;

}) {

  return (

    <div

      className={`rounded-xl border bg-card p-5 shadow-sm ${

        highlight ? "border-border" : "border-border"

      }`}

    >

      <div className="text-sm text-muted-foreground">{label}</div>

      <div className="mt-2 text-2xl font-semibold text-foreground">

        {value.toLocaleString("id-ID")}

      </div>

    </div>

  );

}
