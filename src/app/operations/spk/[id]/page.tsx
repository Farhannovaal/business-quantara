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
  ChevronLeft,
  ChevronRight,
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
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

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

  useEffect(() => {
    if (!spk) return;

    setSelectedProductId((current) => {
      const stillExists = spk.items.some((item) => item.productId === current);
      return stillExists ? current : (spk.items[0]?.productId ?? null);
    });
  }, [spk]);

  const selectedProductSummary =
    spk?.productSummaries.find(
      (item) => item.productId === selectedProductId,
    ) ?? null;

  useEffect(() => {
    setHistoryPage(1);
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

  const historyTransactions = spk
    ? [...spk.transactions].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          b.id - a.id,
      )
    : [];

  const historyTotal = historyTransactions.length;
  const historyTotalPages = Math.max(
    1,
    Math.ceil(historyTotal / historyPageSize),
  );
  const historyStart =
    historyTotal === 0 ? 0 : (historyPage - 1) * historyPageSize + 1;
  const historyEnd = Math.min(historyPage * historyPageSize, historyTotal);
  const paginatedHistory = historyTransactions.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize,
  );


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

        <div className="mb-6 grid items-start gap-4 md:grid-cols-3">

          <div className="h-fit min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">

            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Package size={17} />
                Products
              </div>
              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">
                {formatNumber(spk.items.length)}
              </span>
            </div>

            {spk.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Tidak ada product.
              </div>
            ) : (
              <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                {spk.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selectedProductId === item.productId}
                    onClick={() => setSelectedProductId(item.productId)}
                    className={`min-w-0 rounded-lg border px-3 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/40 ${
                      selectedProductId === item.productId
                        ? "border-rose-500/60 bg-rose-500/10 ring-1 ring-rose-500/20"
                        : "border-border/70 bg-muted hover:border-rose-300/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {item.product.name}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.product.code}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-semibold tabular-nums text-foreground">
                        {formatNumber(item.quantity)} pcs
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {spk.items.length > 8 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Gulir daftar untuk melihat seluruh {formatNumber(spk.items.length)} produk.
              </p>
            )}

          </div>

          <div className="h-fit min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">

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

          <div className="h-fit min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">

            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">

              <Activity size={17} />

              Transactions

            </div>

            <div className="font-semibold text-foreground">

              {historyTotal}

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

              label="Total Dalam Proses"

              value={spk.summary.jumlahBarang}

              highlight

            />

          </div>

        </div>

        <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-foreground">
                Product Production Summary
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pilih produk pada bagian Products untuk melihat progress produksinya.
              </p>
            </div>

            {selectedProductSummary && (
              <span className="w-fit rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {selectedProductSummary.product.name}
              </span>
            )}
          </div>

          {!selectedProductSummary ? (
            <div className="px-5 py-10 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Pilih produk untuk melihat summary
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Klik salah satu produk pada card Products di atas.
              </p>
            </div>
          ) : (
            <div className="p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-foreground">
                    {selectedProductSummary.product.name}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {selectedProductSummary.product.code}
                  </div>
                </div>

                <span className="w-fit rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                  Qty SPK: {formatNumber(selectedProductSummary.quantity)} pcs
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  label="Pengiriman"
                  value={selectedProductSummary.summary.totalPengiriman}
                />
                <SummaryCard
                  label="Penerimaan"
                  value={selectedProductSummary.summary.totalPenerimaan}
                />
                <SummaryCard
                  label="Sisa Jahit"
                  value={selectedProductSummary.summary.sisaJahit}
                  highlight
                />
                <SummaryCard
                  label="Barang di QC"
                  value={selectedProductSummary.summary.barangDiQc}
                  highlight
                />
                <SummaryCard
                  label="QC Rijek"
                  value={selectedProductSummary.summary.totalQcRijek}
                />
                <SummaryCard
                  label="QC ACC"
                  value={selectedProductSummary.summary.totalQcAcc}
                />
                <SummaryCard
                  label="Rijek"
                  value={selectedProductSummary.summary.jumlahRijek}
                />
                <SummaryCard
                  label="Total Barang"
                  value={selectedProductSummary.summary.jumlahBarang}
                  highlight
                />
              </div>

              <div className="mt-4">
                <div className="mb-2 text-sm font-semibold text-foreground">
                  Next Allowed Process
                </div>

                {selectedProductSummary.summary.nextTransactionTypes.length === 0 ? (
                  <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                    Tidak ada process berikutnya.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedProductSummary.summary.nextTransactionTypes.map((code) => (
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
          )}
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

        <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">

          <div className="border-b border-border px-5 py-4">

            <h2 className="font-semibold text-foreground">

              Transaction History

            </h2>

            <p className="mt-1 text-sm text-muted-foreground">

              Riwayat transaksi yang tercatat untuk SPK ini.

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

            <>
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

                  {paginatedHistory.map((transaction) => (

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

            {historyTotal > 0 && (
              <div className="flex flex-col gap-3 border-t border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span>
                    Menampilkan {formatNumber(historyStart)}–
                    {formatNumber(historyEnd)} dari{" "}
                    {formatNumber(historyTotal)} transaksi
                  </span>

                  <label className="inline-flex items-center gap-2">
                    <span>Baris</span>
                    <select
                      value={historyPageSize}
                      onChange={(event) => {
                        setHistoryPageSize(Number(event.target.value));
                        setHistoryPage(1);
                      }}
                      className="rounded-lg border border-border bg-muted px-2 py-1.5 text-xs text-foreground outline-none transition focus:border-rose-500"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setHistoryPage((page) => Math.max(1, page - 1))
                    }
                    disabled={historyPage <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-rose-300 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                    Sebelumnya
                  </button>

                  <span className="min-w-[86px] text-center text-xs font-medium tabular-nums text-muted-foreground">
                    {historyPage} / {historyTotalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setHistoryPage((page) =>
                        Math.min(historyTotalPages, page + 1),
                      )
                    }
                    disabled={historyPage >= historyTotalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-rose-300 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Berikutnya
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
            </>

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
