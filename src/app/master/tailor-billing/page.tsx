"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";

import PermissionGate from "@/components/auth/permission-gate";

type BillStatus = "DRAFT" | "SUBMITTED" | "PAID" | "CANCELLED";

type Tailor = {
  id: number;
  name: string;
};

type BillingSummary = {
  spkId: number;
  spkNumber: string;

  tailorId: number;
  tailorName: string;

  productId: number;
  productCode: string;
  productName: string;

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

  totalAlreadyBilled: number;
  billableQuantity: number;

  rate: number;
  billableAmount: number;
};

type BillItem = {
  id: number;
  spkId: number;
  productId: number;
  quantity: number | string;
  rate: number | string;
  amount: number | string;
  spk: {
    id: number;
    spkNumber: string;
  };
  product: {
    id: number;
    code: string;
    name: string;
  };
};

type TailorBill = {
  id: number;
  billNumber: string;
  tailorId: number;
  status: BillStatus;
  subtotal: number | string;
  totalAmount: number | string;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;

  tailor: {
    id: number;
    name: string;
  };

  createdBy: {
    id: number;
    name: string;
    email: string;
  } | null;

  items: BillItem[];
};

type SelectedItem = {
  spkId: number;
  productId: number;
  quantity: number;
};

const STATUS_CONFIG: Record<
  BillStatus,
  {
    label: string;
    className: string;
  }
> = {
  DRAFT: {
    label: "Draft",
    className:
      "bg-amber-50 text-amber-700 border border-amber-200",
  },
  SUBMITTED: {
    label: "Submitted",
    className:
      "bg-cyan-50 text-cyan-700 border border-cyan-200",
  },
  PAID: {
    label: "Paid",
    className:
      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  CANCELLED: {
    label: "Cancelled",
    className:
      "bg-rose-50 text-rose-700 border border-rose-200",
  },
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatNumber(value: number | string) {
  return new Intl.NumberFormat("id-ID").format(
    Number(value) || 0,
  );
}

function formatDate(value: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan.";
}

export default function TailorBillingPage() {
  const [bills, setBills] = useState<TailorBill[]>([]);
  const [eligible, setEligible] = useState<BillingSummary[]>([]);
  const [tailors, setTailors] = useState<Tailor[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingEligible, setLoadingEligible] =
    useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<BillStatus | "ALL">("ALL");
  const [tailorFilter, setTailorFilter] =
    useState<number | "ALL">("ALL");

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [selectedBill, setSelectedBill] =
    useState<TailorBill | null>(null);

  const [selectedTailorId, setSelectedTailorId] =
    useState<number | "">("");

  const [selectedItems, setSelectedItems] = useState<
    SelectedItem[]
  >([]);

  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] =
    useState<number | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ============================================================
  // FETCH BILLS
  // ============================================================

  async function fetchBills() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }

      if (tailorFilter !== "ALL") {
        params.set("tailorId", String(tailorFilter));
      }

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(
        `/api/tailor-billing?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Gagal mengambil data tagihan.",
        );
      }

      setBills(result.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // FETCH TAILORS
  // ============================================================

  async function fetchTailors() {
    try {
      const response = await fetch("/api/tailors", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Gagal mengambil data penjahit.",
        );
      }

      setTailors(result.data || []);
    } catch (err) {
      console.error("Fetch tailors error:", err);
    }
  }

  // ============================================================
  // FETCH ELIGIBLE
  // ============================================================

  async function fetchEligible() {
    try {
      setLoadingEligible(true);
      setError("");

      const response = await fetch(
        "/api/tailor-billing/eligible",
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Gagal mengambil SPK yang dapat ditagihkan.",
        );
      }

      setEligible(result.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingEligible(false);
    }
  }

  useEffect(() => {
    fetchTailors();
  }, []);

  useEffect(() => {
    fetchBills();
  }, [statusFilter, tailorFilter]);

  // ============================================================
  // SUMMARY
  // ============================================================

  const summary = useMemo(() => {
    return {
      total: bills.length,
      draft: bills.filter(
        (bill) => bill.status === "DRAFT",
      ).length,
      submitted: bills.filter(
        (bill) => bill.status === "SUBMITTED",
      ).length,
      paid: bills.filter(
        (bill) => bill.status === "PAID",
      ).length,
      cancelled: bills.filter(
        (bill) => bill.status === "CANCELLED",
      ).length,
    };
  }, [bills]);

  // ============================================================
  // ELIGIBLE BY TAILOR
  // ============================================================

  const eligibleForSelectedTailor = useMemo(() => {
    if (!selectedTailorId) {
      return [];
    }

    return eligible.filter(
      (item) => item.tailorId === selectedTailorId,
    );
  }, [eligible, selectedTailorId]);

  // ============================================================
  // SELECTED TOTAL
  // ============================================================

  const selectedTotal = useMemo(() => {
    return selectedItems.reduce((total, selected) => {
      const item = eligible.find(
        (entry) => entry.spkId === selected.spkId,
      );

      if (!item) {
        return total;
      }

      return (
        total +
        selected.quantity * Number(item.rate)
      );
    }, 0);
  }, [selectedItems, eligible]);

  // ============================================================
  // OPEN CREATE MODAL
  // ============================================================

  function openCreateModal() {
    setShowCreate(true);
    setSelectedTailorId("");
    setSelectedItems([]);
    setNotes("");
    setError("");
    setSuccess("");

    fetchEligible();
  }

  // ============================================================
  // CLOSE CREATE
  // ============================================================

  function closeCreateModal() {
    if (saving) return;

    setShowCreate(false);
    setSelectedTailorId("");
    setSelectedItems([]);
    setNotes("");
  }

  // ============================================================
  // CHANGE TAILOR
  // ============================================================

  function handleTailorChange(
    value: string,
  ) {
    const tailorId = value
      ? Number(value)
      : "";

    setSelectedTailorId(tailorId);
    setSelectedItems([]);
  }

  // ============================================================
  // CHECK ITEM SELECTED
  // ============================================================

  function isSelected(spkId: number) {
    return selectedItems.some(
      (item) => item.spkId === spkId,
    );
  }

  // ============================================================
  // GET SELECTED QUANTITY
  // ============================================================

  function getSelectedQuantity(spkId: number) {
    return (
      selectedItems.find(
        (item) => item.spkId === spkId,
      )?.quantity || 0
    );
  }

  // ============================================================
  // TOGGLE ITEM
  // ============================================================

  function toggleItem(item: BillingSummary) {
    const exists = isSelected(item.spkId);

    if (exists) {
      setSelectedItems((current) =>
        current.filter(
          (selected) =>
            selected.spkId !== item.spkId,
        ),
      );

      return;
    }

    setSelectedItems((current) => [
      ...current,
      {
        spkId: item.spkId,
        productId: item.productId,
        quantity: item.billableQuantity,
      },
    ]);
  }

  // ============================================================
  // CHANGE QUANTITY
  // ============================================================

  function changeQuantity(
    item: BillingSummary,
    value: string,
  ) {
    let quantity = Number(value);

    if (!Number.isFinite(quantity)) {
      quantity = 0;
    }

    quantity = Math.floor(quantity);

    if (quantity < 0) {
      quantity = 0;
    }

    if (quantity > item.billableQuantity) {
      quantity = item.billableQuantity;
    }

    setSelectedItems((current) => {
      const exists = current.some(
        (selected) =>
          selected.spkId === item.spkId,
      );

      if (!exists) {
        return [
          ...current,
          {
            spkId: item.spkId,
            productId: item.productId,
            quantity,
          },
        ];
      }

      return current.map((selected) =>
        selected.spkId === item.spkId
          ? {
              ...selected,
              quantity,
            }
          : selected,
      );
    });
  }

  // ============================================================
  // CREATE BILL
  // ============================================================

  async function createBill() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!selectedTailorId) {
        throw new Error(
          "Silakan pilih penjahit.",
        );
      }

      const validItems = selectedItems.filter(
        (item) => item.quantity > 0,
      );

      if (validItems.length === 0) {
        throw new Error(
          "Pilih minimal satu SPK dengan quantity lebih dari 0.",
        );
      }

      const response = await fetch(
        "/api/tailor-billing",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tailorId: selectedTailorId,
            items: validItems,
            notes: notes.trim() || null,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Gagal membuat tagihan.",
        );
      }

      setSuccess(
        `Tagihan ${result.data?.billNumber || ""} berhasil dibuat.`,
      );

      setShowCreate(false);

      await fetchBills();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // DETAIL
  // ============================================================

  async function openDetail(
    bill: TailorBill,
  ) {
    try {
      setError("");

      const response = await fetch(
        `/api/tailor-billing/${bill.id}`,
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Gagal mengambil detail tagihan.",
        );
      }

      setSelectedBill(result.data);
      setShowDetail(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  // ============================================================
  // BILL ACTION
  // ============================================================

  async function processBillAction(
    billId: number,
    action:
      | "submit"
      | "pay"
      | "cancel",
  ) {
    const actionLabel =
      action === "submit"
        ? "submit"
        : action === "pay"
          ? "bayar"
          : "batalkan";

    const confirmed = window.confirm(
      `Yakin ingin ${actionLabel} tagihan ini?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(billId);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/tailor-billing/${billId}/${action}`,
        {
          method: "POST",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            `Gagal ${actionLabel} tagihan.`,
        );
      }

      setSuccess(
        `Tagihan berhasil ${
          action === "submit"
            ? "disubmit"
            : action === "pay"
              ? "dibayar"
              : "dibatalkan"
        }.`,
      );

      if (
        selectedBill &&
        selectedBill.id === billId
      ) {
        setSelectedBill(result.data);
      }

      await fetchBills();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  }

  // ============================================================
  // REFRESH
  // ============================================================

  async function refresh() {
    await fetchBills();

    if (showCreate) {
      await fetchEligible();
    }
  }

  return (
    <PermissionGate permission="tailor-billing.view">
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-6 py-6">
          {/* ================================================= */}
          {/* HEADER */}
          {/* ================================================= */}

          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
                <FileText className="h-4 w-4" />
                Master Data
                <span>/</span>
                Tailor Billing
              </div>

              <h1 className="text-2xl font-bold text-slate-800">
                Tailor Billing
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Kelola tagihan dan pembayaran penjahit
                berdasarkan hasil QC ACC.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={refresh}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>

              <PermissionGate permission="tailor-billing.create">
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700"
                >
                  <Plus className="h-4 w-4" />
                  Buat Tagihan
                </button>
              </PermissionGate>
            </div>
          </div>

          {/* ================================================= */}
          {/* ALERT */}
          {/* ================================================= */}

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

              <div className="flex-1">
                {error}
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                className="text-rose-400 hover:text-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <Check className="mt-0.5 h-5 w-5 shrink-0" />

              <div className="flex-1">
                {success}
              </div>

              <button
                type="button"
                onClick={() => setSuccess("")}
                className="text-emerald-400 hover:text-emerald-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ================================================= */}
          {/* SUMMARY */}
          {/* ================================================= */}

          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <SummaryCard
              label="Total Tagihan"
              value={summary.total}
              icon={<FileText className="h-5 w-5" />}
            />

            <SummaryCard
              label="Draft"
              value={summary.draft}
              icon={
                <FileText className="h-5 w-5" />
              }
            />

            <SummaryCard
              label="Submitted"
              value={summary.submitted}
              icon={
                <Send className="h-5 w-5" />
              }
            />

            <SummaryCard
              label="Paid"
              value={summary.paid}
              icon={
                <CircleDollarSign className="h-5 w-5" />
              }
            />

            <SummaryCard
              label="Cancelled"
              value={summary.cancelled}
              icon={
                <X className="h-5 w-5" />
              }
            />
          </div>

          {/* ================================================= */}
          {/* FILTER */}
          {/* ================================================= */}

          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1fr_200px_240px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      fetchBills();
                    }
                  }}
                  placeholder="Cari nomor tagihan atau penjahit..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | BillStatus
                      | "ALL",
                  )
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="ALL">
                  Semua Status
                </option>
                <option value="DRAFT">
                  Draft
                </option>
                <option value="SUBMITTED">
                  Submitted
                </option>
                <option value="PAID">
                  Paid
                </option>
                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>

              <select
                value={tailorFilter}
                onChange={(event) =>
                  setTailorFilter(
                    event.target.value === "ALL"
                      ? "ALL"
                      : Number(
                          event.target.value,
                        ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="ALL">
                  Semua Penjahit
                </option>

                {tailors.map((tailor) => (
                  <option
                    key={tailor.id}
                    value={tailor.id}
                  >
                    {tailor.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={fetchBills}
                className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white transition hover:bg-slate-900"
              >
                Cari
              </button>
            </div>
          </div>

          {/* ================================================= */}
          {/* TABLE */}
          {/* ================================================= */}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-800">
                Daftar Tagihan
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Menampilkan {bills.length} tagihan.
              </p>
            </div>

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Memuat data...
                </div>
              </div>
            ) : bills.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <FileText className="h-6 w-6 text-slate-400" />
                </div>

                <h3 className="font-semibold text-slate-700">
                  Belum ada tagihan
                </h3>

                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Belum ada data tagihan yang sesuai
                  dengan filter saat ini.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        No. Tagihan
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Penjahit
                      </th>

                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Item
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Total
                      </th>

                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Dibuat
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {bills.map((bill) => (
                      <tr
                        key={bill.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              openDetail(bill)
                            }
                            className="font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            {bill.billNumber}
                          </button>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-800">
                            {bill.tailor.name}
                          </div>

                          <div className="mt-0.5 text-xs text-slate-500">
                            {bill.createdBy?.name ||
                              "-"}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center text-sm text-slate-600">
                          {bill.items.length}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="font-semibold text-slate-800">
                            {formatCurrency(
                              bill.totalAmount,
                            )}
                          </div>

                          <div className="text-xs text-slate-400">
                            {formatNumber(
                              bill.items.reduce(
                                (total, item) =>
                                  total +
                                  Number(
                                    item.quantity,
                                  ),
                                0,
                              ),
                            )}{" "}
                            pcs
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <StatusBadge
                            status={bill.status}
                          />
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {formatDate(
                            bill.createdAt,
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              openDetail(bill)
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ===================================================== */}
        {/* CREATE MODAL */}
        {/* ===================================================== */}

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* HEADER */}

              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Buat Tagihan Penjahit
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Pilih hasil QC ACC yang ingin
                    dimasukkan ke tagihan.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* BODY */}

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {/* TAILOR */}

                <div className="mb-5">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Penjahit
                  </label>

                  <select
                    value={selectedTailorId}
                    onChange={(event) =>
                      handleTailorChange(
                        event.target.value,
                      )
                    }
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      Pilih penjahit...
                    </option>

                    {tailors.map((tailor) => (
                      <option
                        key={tailor.id}
                        value={tailor.id}
                      >
                        {tailor.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* LOADING */}

                {loadingEligible &&
                  selectedTailorId && (
                    <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-10">
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Menghitung barang yang dapat
                        ditagihkan...
                      </div>
                    </div>
                  )}

                {/* NO TAILOR */}

                {!selectedTailorId &&
                  !loadingEligible && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                      <CircleDollarSign className="mx-auto mb-3 h-8 w-8 text-slate-400" />

                      <h3 className="font-semibold text-slate-700">
                        Pilih penjahit terlebih dahulu
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Setelah penjahit dipilih,
                        SPK yang dapat ditagihkan akan
                        ditampilkan.
                      </p>
                    </div>
                  )}

                {/* EMPTY */}

                {selectedTailorId &&
                  !loadingEligible &&
                  eligibleForSelectedTailor.length ===
                    0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                      <AlertCircle className="mx-auto mb-3 h-8 w-8 text-slate-400" />

                      <h3 className="font-semibold text-slate-700">
                        Tidak ada SPK yang dapat
                        ditagihkan
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Belum ada hasil QC ACC yang
                        tersedia atau seluruhnya sudah
                        ditagihkan.
                      </p>
                    </div>
                  )}

                {/* SPK LIST */}

                {selectedTailorId &&
                  !loadingEligible &&
                  eligibleForSelectedTailor.length >
                    0 && (
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-800">
                            SPK yang Dapat Ditagihkan
                          </h3>

                          <p className="text-xs text-slate-500">
                            Pilih SPK dan tentukan
                            quantity yang akan dibayar.
                          </p>
                        </div>

                        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                          {
                            selectedItems.filter(
                              (item) =>
                                item.quantity > 0,
                            ).length
                          }{" "}
                          item dipilih
                        </div>
                      </div>

                      <div className="space-y-3">
                        {eligibleForSelectedTailor.map(
                          (item) => {
                            const selected =
                              isSelected(
                                item.spkId,
                              );

                            const quantity =
                              getSelectedQuantity(
                                item.spkId,
                              );

                            const amount =
                              quantity *
                              Number(item.rate);

                            return (
                              <div
                                key={item.spkId}
                                className={`rounded-xl border p-4 transition ${
                                  selected
                                    ? "border-indigo-300 bg-indigo-50/40"
                                    : "border-slate-200 bg-white"
                                }`}
                              >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                                  {/* CHECKBOX */}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleItem(
                                        item,
                                      )
                                    }
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                                      selected
                                        ? "border-indigo-600 bg-indigo-600 text-white"
                                        : "border-slate-300 bg-white"
                                    }`}
                                  >
                                    {selected && (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                  </button>

                                  {/* INFO */}

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-bold text-slate-800">
                                        {item.spkNumber}
                                      </span>

                                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                        {item.productCode}
                                      </span>
                                    </div>

                                    <div className="mt-1 text-sm text-slate-700">
                                      {item.productName}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                                      <span>
                                        QC ACC:{" "}
                                        <strong className="text-slate-700">
                                          {formatNumber(
                                            item.totalQcAcc,
                                          )}{" "}
                                          pcs
                                        </strong>
                                      </span>

                                      <span>
                                        Sudah ditagihkan:{" "}
                                        <strong className="text-slate-700">
                                          {formatNumber(
                                            item.totalAlreadyBilled,
                                          )}{" "}
                                          pcs
                                        </strong>
                                      </span>

                                      <span>
                                        Bisa ditagihkan:{" "}
                                        <strong className="text-indigo-700">
                                          {formatNumber(
                                            item.billableQuantity,
                                          )}{" "}
                                          pcs
                                        </strong>
                                      </span>
                                    </div>
                                  </div>

                                  {/* RATE */}

                                  <div className="min-w-[130px]">
                                    <div className="text-xs text-slate-400">
                                      Tarif / pcs
                                    </div>

                                    <div className="mt-1 font-semibold text-slate-800">
                                      {formatCurrency(
                                        item.rate,
                                      )}
                                    </div>
                                  </div>

                                  {/* QUANTITY */}

                                  <div className="w-full lg:w-[150px]">
                                    <label className="mb-1 block text-xs font-medium text-slate-500">
                                      Qty dibayar
                                    </label>

                                    <input
                                      type="number"
                                      min={0}
                                      max={
                                        item.billableQuantity
                                      }
                                      value={
                                        selected
                                          ? quantity
                                          : 0
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        changeQuantity(
                                          item,
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                      onFocus={() => {
                                        if (
                                          !selected
                                        ) {
                                          toggleItem(
                                            item,
                                          );
                                        }
                                      }}
                                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    />
                                  </div>

                                  {/* AMOUNT */}

                                  <div className="min-w-[150px] text-right">
                                    <div className="text-xs text-slate-400">
                                      Jumlah
                                    </div>

                                    <div className="mt-1 font-bold text-indigo-700">
                                      {formatCurrency(
                                        amount,
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}

                {/* NOTES */}

                {selectedTailorId &&
                  eligibleForSelectedTailor.length >
                    0 && (
                    <div className="mt-5">
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Catatan
                      </label>

                      <textarea
                        value={notes}
                        onChange={(event) =>
                          setNotes(
                            event.target.value,
                          )
                        }
                        rows={3}
                        placeholder="Tambahkan catatan jika diperlukan..."
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  )}
              </div>

              {/* FOOTER */}

              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xs text-slate-500">
                      Total Tagihan
                    </div>

                    <div className="text-xl font-bold text-slate-800">
                      {formatCurrency(
                        selectedTotal,
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeCreateModal}
                      disabled={saving}
                      className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Batal
                    </button>

                    <button
                      type="button"
                      onClick={createBill}
                      disabled={
                        saving ||
                        selectedTotal <= 0
                      }
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Buat Draft
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* DETAIL MODAL */}
        {/* ===================================================== */}

        {showDetail && selectedBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* HEADER */}

              <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-800">
                      {selectedBill.billNumber}
                    </h2>

                    <StatusBadge
                      status={
                        selectedBill.status
                      }
                    />
                  </div>

                  <p className="text-sm text-slate-500">
                    {selectedBill.tailor.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowDetail(false)
                  }
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* BODY */}

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {/* META */}

                <div className="mb-5 grid gap-4 sm:grid-cols-3">
                  <InfoBox
                    label="Penjahit"
                    value={
                      selectedBill.tailor.name
                    }
                  />

                  <InfoBox
                    label="Dibuat Oleh"
                    value={
                      selectedBill.createdBy?.name ||
                      "-"
                    }
                  />

                  <InfoBox
                    label="Tanggal Dibuat"
                    value={formatDate(
                      selectedBill.createdAt,
                    )}
                  />
                </div>

                {/* ITEMS */}

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-700">
                      Detail Item
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            SPK
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Produk
                          </th>

                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Qty
                          </th>

                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Tarif
                          </th>

                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Jumlah
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {selectedBill.items.map(
                          (item) => (
                            <tr
                              key={item.id}
                            >
                              <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                {item.spk.spkNumber}
                              </td>

                              <td className="px-4 py-3">
                                <div className="text-sm text-slate-700">
                                  {item.product.name}
                                </div>

                                <div className="text-xs text-slate-400">
                                  {item.product.code}
                                </div>
                              </td>

                              <td className="px-4 py-3 text-right text-sm text-slate-700">
                                {formatNumber(
                                  item.quantity,
                                )}{" "}
                                pcs
                              </td>

                              <td className="px-4 py-3 text-right text-sm text-slate-700">
                                {formatCurrency(
                                  item.rate,
                                )}
                              </td>

                              <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">
                                {formatCurrency(
                                  item.amount,
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TOTAL */}

                <div className="mt-5 flex justify-end">
                  <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>Subtotal</span>

                      <span className="font-medium text-slate-700">
                        {formatCurrency(
                          selectedBill.subtotal,
                        )}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                      <span className="font-semibold text-slate-800">
                        Total
                      </span>

                      <span className="text-xl font-bold text-indigo-700">
                        {formatCurrency(
                          selectedBill.totalAmount,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* NOTES */}

                {selectedBill.notes && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Catatan
                    </div>

                    <p className="whitespace-pre-wrap text-sm text-slate-600">
                      {selectedBill.notes}
                    </p>
                  </div>
                )}

                {/* PAID */}

                {selectedBill.paidAt && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    Dibayar pada{" "}
                    <strong>
                      {formatDate(
                        selectedBill.paidAt,
                      )}
                    </strong>
                  </div>
                )}
              </div>

              {/* FOOTER */}

              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setShowDetail(false)
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Tutup
                </button>

                <div className="flex flex-wrap justify-end gap-2">
                  {selectedBill.status ===
                    "DRAFT" && (
                    <>
                      <PermissionGate permission="tailor-billing.update">
                        <button
                          type="button"
                          disabled={
                            processingId ===
                            selectedBill.id
                          }
                          onClick={() =>
                            processBillAction(
                              selectedBill.id,
                              "cancel",
                            )
                          }
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </button>

                        <button
                          type="button"
                          disabled={
                            processingId ===
                            selectedBill.id
                          }
                          onClick={() =>
                            processBillAction(
                              selectedBill.id,
                              "submit",
                            )
                          }
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {processingId ===
                          selectedBill.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Submit
                        </button>
                      </PermissionGate>
                    </>
                  )}

                  {selectedBill.status ===
                    "SUBMITTED" && (
                    <>
                      <PermissionGate permission="tailor-billing.update">
                        <button
                          type="button"
                          disabled={
                            processingId ===
                            selectedBill.id
                          }
                          onClick={() =>
                            processBillAction(
                              selectedBill.id,
                              "cancel",
                            )
                          }
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </button>
                      </PermissionGate>

                      <PermissionGate permission="tailor-billing.pay">
                        <button
                          type="button"
                          disabled={
                            processingId ===
                            selectedBill.id
                          }
                          onClick={() =>
                            processBillAction(
                              selectedBill.id,
                              "pay",
                            )
                          }
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {processingId ===
                          selectedBill.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CircleDollarSign className="h-4 w-4" />
                          )}
                          Mark as Paid
                        </button>
                      </PermissionGate>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  );
}

// ============================================================
// COMPONENTS
// ============================================================

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {label}
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          {icon}
        </div>
      </div>

      <div className="text-2xl font-bold text-slate-800">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: BillStatus;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-medium text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-slate-700">
        {value}
      </div>
    </div>
  );
}