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

type SPKDetail = {
  id: number;
  spkNumber: string;
  productId: number;
  tailorId: number;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;

  product: {
    id: number;
    code: string;
    name: string;
  };

  tailor: {
    id: number;
    name: string;
  };

  transactions: Transaction[];

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

      const response = await fetch(`/api/spks/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal mengambil detail SPK");
      }

      setSpk(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil detail SPK"
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

  function getStatusStyle(
    status: SPKDetail["status"]
  ) {
    switch (status) {
      case "ACTIVE":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";

      case "COMPLETED":
        return "border-blue-200 bg-blue-50 text-blue-700";

      case "CANCELLED":
        return "border-red-200 bg-red-50 text-red-700";

      default:
        return "border-gray-200 bg-gray-50 text-gray-700";
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function getTransactionLabel(code: string) {
    const labels: Record<string, string> = {
      PENGIRIMAN_SIAP_JAHIT: "Pengiriman Siap Jahit",
      PENERIMAAN_DARI_PENJAHIT: "Penerimaan dari Penjahit",
      QUALITY_CONTROL: "Quality Control",
      QC_RIJEK: "QC / Rijek",
      QC_ACC_DIKIRIM_KE_GUDANG:
        "QC / ACC Dikirim ke Gudang",
      PENGIRIMAN_RIJEK: "Pengiriman Rijek",
      PENERIMAAN_RIJEK: "Penerimaan Rijek",
    };

    return labels[code] || code;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2
              size={18}
              className="animate-spin"
            />
            Loading SPK...
          </div>
        </div>
      </div>
    );
  }

  if (error || !spk) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/operations/spk"
            className="mb-5 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to SPK
          </Link>

          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error || "SPK tidak ditemukan."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* Back */}
        <Link
          href="/operations/spk"
          className="mb-5 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to SPK
        </Link>

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">
                {spk.spkNumber}
              </h1>

              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyle(
                  spk.status
                )}`}
              >
                {spk.status}
              </span>
            </div>

            <p className="mt-1 text-sm text-gray-500">
              Production tracking dan transaction history.
            </p>
          </div>

          <button
            onClick={loadSpk}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Basic Info */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">

          {/* Product */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
              <Package size={17} />
              Product
            </div>

            <div className="font-semibold text-gray-900">
              {spk.product.name}
            </div>

            <div className="mt-1 text-sm text-gray-500">
              {spk.product.code}
            </div>
          </div>

          {/* Tailor */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
              <UserRound size={17} />
              Penjahit
            </div>

            <div className="font-semibold text-gray-900">
              {spk.tailor.name}
            </div>
          </div>

          {/* Transaction */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
              <Activity size={17} />
              Transactions
            </div>

            <div className="font-semibold text-gray-900">
              {spk.transactions.length}
            </div>

            <div className="mt-1 text-sm text-gray-500">
              Total recorded transactions
            </div>
          </div>
        </div>

        {/* Production Summary */}
        <div className="mb-6">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Production Summary
            </h2>

            <p className="mt-1 text-sm text-gray-500">
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

        {/* Next Process */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900">
              Next Allowed Process
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Transaction yang saat ini diperbolehkan berdasarkan
              state SPK.
            </p>
          </div>

          {spk.summary.nextTransactionTypes.length === 0 ? (
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">
              Tidak ada process berikutnya.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {spk.summary.nextTransactionTypes.map(
                (code) => (
                  <div
                    key={code}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700"
                  >
                    <ArrowRight size={15} />
                    {getTransactionLabel(code)}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              Transaction History
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Semua transaction yang tercatat untuk SPK ini.
            </p>
          </div>

          {spk.transactions.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center px-5 text-center">
              <div>
                <p className="font-medium text-gray-900">
                  Belum ada transaction
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Transaction pertama untuk SPK ini belum
                  dibuat.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Date
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Transaction
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Number
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Quantity
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Employee
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {spk.transactions.map(
                    (transaction) => (
                      <tr
                        key={transaction.id}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {formatDate(
                            transaction.createdAt
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {getTransactionLabel(
                              transaction.transactionType
                                .code
                            )}
                          </div>

                          <div className="mt-0.5 text-xs text-gray-500">
                            {
                              transaction.transactionType
                                .code
                            }
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {
                            transaction.transactionNumber
                          }
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                          {transaction.quantity}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700">
                          {transaction.employee.name}
                        </td>
                      </tr>
                    )
                  )}
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
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        highlight
          ? "border-gray-300"
          : "border-gray-200"
      }`}
    >
      <div className="text-sm text-gray-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-gray-900">
        {value.toLocaleString("id-ID")}
      </div>
    </div>
  );
}