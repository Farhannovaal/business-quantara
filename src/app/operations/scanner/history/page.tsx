"use client";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";

type ScannerHistoryItem = {
  id: number;
  documentNumber: string;
  documentType: string | null;
  source: string;
  status: string;
  validationMessage: string | null;

  transactionId: number | null;

  scannedByUserId: number | null;

  scannedAt: string;
  processedAt: string | null;

  transaction: {
    id: number;
    transactionNumber: string;
    quantity: number;

    transactionType: {
      id: number;
      code: string;
      name: string;
    };

    spk: {
      id: number;
      spkNumber: string;
    };
  } | null;

  scannedBy: {
    id: number;
    name: string;
    email: string;
  } | null;
};

type HistoryResponse = {
  success: boolean;
  error?: string;

  data?: ScannerHistoryItem[];

  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const STATUS_OPTIONS = [
  {
    value: "",
    label: "Semua Status",
  },
  {
    value: "PENDING",
    label: "Pending",
  },
  {
    value: "VALID",
    label: "Valid",
  },
  {
    value: "INVALID",
    label: "Invalid",
  },
  {
    value: "PROCESSED",
    label: "Processed",
  },
  {
    value: "DUPLICATE",
    label: "Duplicate",
  },
  {
    value: "REVIEW_REQUIRED",
    label: "Review Required",
  },
];

const SOURCE_OPTIONS = [
  {
    value: "",
    label: "Semua Source",
  },
  {
    value: "MANUAL",
    label: "Manual",
  },
  {
    value: "QR",
    label: "QR",
  },
  {
    value: "BARCODE",
    label: "Barcode",
  },
  {
    value: "OCR",
    label: "OCR",
  },
];

export default function ScannerHistoryPage() {
  const [items, setItems] = useState<
    ScannerHistoryItem[]
  >([]);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [source, setSource] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [pagination, setPagination] =
    useState({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadHistory(
    requestedPage = page,
  ) {
    setLoading(true);
    setError("");

    try {
      const params =
        new URLSearchParams();

      params.set(
        "page",
        String(requestedPage),
      );

      params.set(
        "limit",
        "20",
      );

      if (search.trim()) {
        params.set(
          "search",
          search.trim(),
        );
      }

      if (status) {
        params.set(
          "status",
          status,
        );
      }

      if (source) {
        params.set(
          "source",
          source,
        );
      }

      const response =
        await fetch(
          `/api/scanner/history?${params.toString()}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

      const data =
        (await response.json()) as HistoryResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Gagal memuat scanner history.",
        );
      }

      setItems(data.data || []);

      setPagination(
        data.pagination || {
          page: requestedPage,
          limit: 20,
          total: 0,
          totalPages: 1,
        },
      );

      setPage(requestedPage);
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Gagal memuat scanner history.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory(1);
  }, [status, source]);

  function handleSearch() {
    loadHistory(1);
  }

  function handlePreviousPage() {
    if (page <= 1) {
      return;
    }

    loadHistory(page - 1);
  }

  function handleNextPage() {
    if (
      page >=
      pagination.totalPages
    ) {
      return;
    }

    loadHistory(page + 1);
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}

        <div className="mb-6">
          <button
            type="button"
            onClick={() =>
              window.history.back()
            }
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />

            Kembali
          </button>

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
              <History className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-xl font-semibold text-slate-800 md:text-2xl">
                Scanner History
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Riwayat dokumen yang dipindai dan
                transaksi yang dihasilkan.
              </p>
            </div>
          </div>
        </div>

        {/* FILTER */}

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
            {/* SEARCH */}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                  ) {
                    handleSearch();
                  }
                }}
                placeholder="Cari nomor nota atau transaksi..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* STATUS */}

            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value,
                )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {STATUS_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>

            {/* SOURCE */}

            <select
              value={source}
              onChange={(event) =>
                setSource(
                  event.target.value,
                )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {SOURCE_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>

            {/* SEARCH BUTTON */}

            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}

              Cari
            </button>
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* TABLE */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Dokumen
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Status
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Source
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    SPK
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Transaction
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Qty
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Scanned By
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Waktu
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center"
                    >
                      <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />

                        Memuat data...
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Tidak ada data scanner.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <HistoryRow
                      key={item.id}
                      item={item}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Total{" "}
              <strong className="text-slate-700">
                {pagination.total}
              </strong>{" "}
              dokumen
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={
                  handlePreviousPage
                }
                disabled={
                  loading ||
                  page <= 1
                }
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />

                Sebelumnya
              </button>

              <span className="px-2 text-sm text-slate-500">
                {page} /{" "}
                {pagination.totalPages}
              </span>

              <button
                type="button"
                onClick={
                  handleNextPage
                }
                disabled={
                  loading ||
                  page >=
                    pagination.totalPages
                }
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Berikutnya

                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function HistoryRow({
  item,
}: {
  item: ScannerHistoryItem;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
      <td className="px-4 py-4">
        <div className="font-medium text-slate-800">
          {item.documentNumber}
        </div>

        {item.documentType && (
          <div className="mt-1 text-xs text-slate-400">
            {item.documentType}
          </div>
        )}
      </td>

      <td className="px-4 py-4">
        <StatusBadge
          status={item.status}
        />
      </td>

      <td className="px-4 py-4">
        <span className="text-slate-600">
          {item.source}
        </span>
      </td>

      <td className="px-4 py-4">
        <span className="font-medium text-slate-700">
          {item.transaction
            ?.spk?.spkNumber || "-"}
        </span>
      </td>

      <td className="px-4 py-4">
        {item.transaction ? (
          <>
            <div className="font-medium text-slate-800">
              {
                item.transaction
                  .transactionNumber
              }
            </div>

            <div className="mt-1 text-xs text-slate-500">
              {
                item.transaction
                  .transactionType.name
              }
            </div>
          </>
        ) : (
          <span className="text-slate-400">
            Belum ada transaksi
          </span>
        )}
      </td>

      <td className="px-4 py-4">
        <span className="font-semibold text-slate-700">
          {item.transaction
            ?.quantity ?? "-"}
        </span>
      </td>

      <td className="px-4 py-4">
        {item.scannedBy ? (
          <>
            <div className="font-medium text-slate-700">
              {item.scannedBy.name}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              {item.scannedBy.email}
            </div>
          </>
        ) : (
          "-"
        )}
      </td>

      <td className="px-4 py-4">
        <div className="text-slate-700">
          {formatDate(item.scannedAt)}
        </div>

        {item.processedAt && (
          <div className="mt-1 text-xs text-emerald-600">
            Processed{" "}
            {formatDate(item.processedAt)}
          </div>
        )}
      </td>
    </tr>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    PENDING:
      "bg-amber-50 text-amber-700 border-amber-200",
    VALID:
      "bg-cyan-50 text-cyan-700 border-cyan-200",
    INVALID:
      "bg-rose-50 text-rose-700 border-rose-200",
    PROCESSED:
      "bg-emerald-50 text-emerald-700 border-emerald-200",
    DUPLICATE:
      "bg-orange-50 text-orange-700 border-orange-200",
    REVIEW_REQUIRED:
      "bg-violet-50 text-violet-700 border-violet-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        styles[status] ||
        "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "id-ID",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}