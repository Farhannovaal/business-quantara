"use client";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import PermissionGate from "@/components/auth/permission-gate";
type TailorRate = {
  id: number;
  tailorId: number;
  productId: number;
  rate: number | string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  tailor: {
    id: number;
    name: string;
  };
  product: {
    id: number;
    code: string;
    name: string;
  };
};
type Tailor = {
  id: number;
  name: string;
  isActive: boolean;
};
type Product = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};
type FormData = {
  tailorId: string;
  productId: string;
  rate: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
};
const initialForm: FormData = {
  tailorId: "",
  productId: "",
  rate: "",
  effectiveFrom: new Date().toISOString().split("T")[0],
  effectiveTo: "",
  isActive: true,
};
export default function TailorRatesPage() {
  const [rates, setRates] = useState<TailorRate[]>([]);
  const [tailors, setTailors] = useState<Tailor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFormData, setLoadingFormData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TailorRate | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function fetchRates() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/tailor-rates", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Gagal mengambil data tarif penjahit.",
        );
      }
      setRates(result.data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data tarif penjahit.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function fetchFormData() {
    try {
      setLoadingFormData(true);
      const [tailorResponse, productResponse] = await Promise.all([
        fetch("/api/tailors", {
          cache: "no-store",
        }),
        fetch("/api/products", {
          cache: "no-store",
        }),
      ]);
      const tailorResult = await tailorResponse.json();
      const productResult = await productResponse.json();
      if (!tailorResponse.ok || !tailorResult.success) {
        throw new Error(
          tailorResult.error || "Gagal mengambil data penjahit.",
        );
      }
      if (!productResponse.ok || !productResult.success) {
        throw new Error(
          productResult.error || "Gagal mengambil data produk.",
        );
      }
      setTailors(tailorResult.data || []);
      setProducts(productResult.data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data form.",
      );
    } finally {
      setLoadingFormData(false);
    }
  }
  useEffect(() => {
    fetchRates();
    fetchFormData();
  }, []);
  function openCreateModal() {
    setEditingRate(null);
    setForm({
      ...initialForm,
      effectiveFrom: new Date().toISOString().split("T")[0],
    });
    setError("");
    setModalOpen(true);
  }
  function openEditModal(rate: TailorRate) {
    setEditingRate(rate);
    setForm({
      tailorId: String(rate.tailorId),
      productId: String(rate.productId),
      rate: String(rate.rate),
      effectiveFrom: formatDateInput(rate.effectiveFrom),
      effectiveTo: rate.effectiveTo
        ? formatDateInput(rate.effectiveTo)
        : "",
      isActive: rate.isActive,
    });
    setError("");
    setModalOpen(true);
  }
  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingRate(null);
    setForm(initialForm);
  }
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.tailorId) {
      setError("Pilih penjahit terlebih dahulu.");
      return;
    }
    if (!form.productId) {
      setError("Pilih produk terlebih dahulu.");
      return;
    }
    const numericRate = Number(form.rate);
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      setError("Tarif harus lebih besar dari 0.");
      return;
    }
    if (!form.effectiveFrom) {
      setError("Tanggal mulai tarif wajib diisi.");
      return;
    }
    if (
      form.effectiveTo &&
      new Date(form.effectiveTo) < new Date(form.effectiveFrom)
    ) {
      setError("Tanggal akhir tidak boleh sebelum tanggal mulai.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      let response: Response;
      if (editingRate) {
        response = await fetch(`/api/tailor-rates/${editingRate.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rate: numericRate,
            effectiveTo: form.effectiveTo || null,
            isActive: form.isActive,
          }),
        });
      } else {
        response = await fetch("/api/tailor-rates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tailorId: Number(form.tailorId),
            productId: Number(form.productId),
            rate: numericRate,
            effectiveFrom: form.effectiveFrom,
            effectiveTo: form.effectiveTo || null,
          }),
        });
      }
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            (editingRate
              ? "Gagal memperbarui tarif."
              : "Gagal membuat tarif."),
        );
      }
      setSuccess(
        editingRate
          ? "Tarif berhasil diperbarui."
          : "Tarif berhasil ditambahkan.",
      );
      setModalOpen(false);
      setEditingRate(null);
      setForm(initialForm);
      await fetchRates();
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan tarif.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function handleDeactivate(rate: TailorRate) {
    const confirmed = window.confirm(
      `Nonaktifkan tarif ${rate.tailor.name} - ${rate.product.name}?`,
    );
    if (!confirmed) return;
    try {
      setError("");
      setSuccess("");
      const response = await fetch(`/api/tailor-rates/${rate.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Gagal menonaktifkan tarif.",
        );
      }
      setSuccess("Tarif berhasil dinonaktifkan.");
      await fetchRates();
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menonaktifkan tarif.",
      );
    }
  }
  const filteredRates = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rates.filter((rate) => {
      const matchesSearch =
        !keyword ||
        rate.tailor.name.toLowerCase().includes(keyword) ||
        rate.product.name.toLowerCase().includes(keyword) ||
        rate.product.code.toLowerCase().includes(keyword);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && rate.isActive) ||
        (statusFilter === "INACTIVE" && !rate.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [rates, search, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRates.length / pageSize));
  const startItem = filteredRates.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, filteredRates.length);
  const paginatedRates = useMemo(
    () => filteredRates.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRates, currentPage, pageSize],
  );
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  const totalRates = rates.length;
  const activeRates = rates.filter((rate) => rate.isActive).length;
  const inactiveRates = rates.filter((rate) => !rate.isActive).length;
  function formatCurrency(value: number | string) {
    const numericValue = Number(value);
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericValue);
  }
  function formatDate(value: string | null) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  }
  function formatDateInput(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return (
    <PermissionGate permission="tailor-rate.view">
      <div className="relative min-h-full space-y-6 overflow-hidden rounded-3xl bg-background text-foreground p-4 md:p-6">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <CircleDollarSign className="h-6 w-6 text-rose-700 dark:text-rose-300" />
                <h1 className="text-2xl font-bold text-foreground">
                  Tailor Rates
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Kelola tarif jasa penjahit berdasarkan produk dan periode
                berlaku.
              </p>
            </div>
            <PermissionGate permission="tailor-rate.manage">
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-800"
              >
                <Plus className="h-4 w-4" />
                Tambah Tarif
              </button>
            </PermissionGate>
          </div>
          {error && !modalOpen && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">{error}</div>
              <button
                type="button"
                onClick={() => setError("")}
                className="rounded-lg p-1 hover:bg-rose-100 dark:hover:bg-rose-950/40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>{success}</span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard
              label="Total Tarif"
              value={totalRates}
              icon={<CircleDollarSign className="h-5 w-5" />}
              iconClass="border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300"
            />
            <SummaryCard
              label="Tarif Aktif"
              value={activeRates}
              icon={<ToggleRight className="h-5 w-5" />}
              iconClass="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600"
            />
            <SummaryCard
              label="Tarif Nonaktif"
              value={inactiveRates}
              icon={<ToggleLeft className="h-5 w-5" />}
              iconClass="border border-border bg-muted text-muted-foreground"
            />
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari penjahit, produk, atau kode produk..."
                  className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-rose-400 focus:bg-card focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900/40"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as
                          | "ALL"
                          | "ACTIVE"
                          | "INACTIVE",
                      )
                    }
                    className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-9 text-sm font-medium text-foreground outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900/40"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <button
                  type="button"
                  onClick={fetchRates}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-muted-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      loading ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px]">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Penjahit
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Produk
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Tarif / pcs
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Berlaku Mulai
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Berlaku Sampai
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {loading ? (
                    <TableLoading />
                  ) : filteredRates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <CircleDollarSign className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="font-semibold text-foreground">
                            Tidak ada tarif ditemukan
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {search
                              ? "Coba gunakan kata kunci pencarian lain."
                              : "Belum ada tarif penjahit yang tersedia."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRates.map((rate) => (
                      <tr
                        key={rate.id}
                        className="transition hover:bg-muted/70"
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium text-foreground">
                            {rate.tailor.name}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            ID #{rate.tailor.id}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-foreground">
                            {rate.product.name}
                          </div>
                          <div className="mt-0.5 inline-flex rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            {rate.product.code}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="font-semibold text-foreground">
                            {formatCurrency(rate.rate)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">
                          {formatDate(rate.effectiveFrom)}
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">
                          {rate.effectiveTo
                            ? formatDate(rate.effectiveTo)
                            : "Tidak terbatas"}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {rate.isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <PermissionGate permission="tailor-rate.manage">
                              <button
                                type="button"
                                onClick={() => openEditModal(rate)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted-foreground transition hover:border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:bg-rose-950/20 hover:text-rose-700 dark:text-rose-300"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              {rate.isActive && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeactivate(rate)
                                  }
                                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 px-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 transition hover:bg-rose-50 dark:bg-rose-950/20"
                                >
                                  <ToggleLeft className="h-3.5 w-3.5" />
                                  Nonaktifkan
                                </button>
                              )}
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && filteredRates.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                  <p>
                    Menampilkan <span className="font-semibold text-foreground">{startItem}-{endItem}</span> dari{" "}
                    <span className="font-semibold text-foreground">{filteredRates.length}</span> tarif
                  </p>
                  <label className="flex items-center gap-2">
                    Baris per halaman
                    <select
                      value={pageSize}
                      onChange={(event) => setPageSize(Number(event.target.value))}
                      className="rounded-lg border border-border bg-muted px-2 py-1.5 text-foreground outline-none focus:border-rose-500"
                    >
                      {[10, 25, 50].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">Awal</button>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button>
                  <span className="px-2 text-xs text-muted-foreground">{currentPage} / {totalPages}</span>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button>
                  <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">Akhir</button>
                </div>
              </div>
            )}
          </div>
        </div>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
              <div className="flex items-start justify-between border-b border-border bg-muted p-5 md:p-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {editingRate
                      ? "Edit Tarif Penjahit"
                      : "Tambah Tarif Penjahit"}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {editingRate
                      ? "Perbarui tarif atau periode berlakunya."
                      : "Tentukan tarif berdasarkan penjahit dan produk."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-muted-foreground disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5 md:p-6">
                  {error && (
                    <div className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">
                      Penjahit
                    </label>
                    <div className="relative">
                      <select
                        value={form.tailorId}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            tailorId: event.target.value,
                          }))
                        }
                        disabled={
                          !!editingRate ||
                          loadingFormData ||
                          saving
                        }
                        className="h-11 w-full appearance-none rounded-xl border border-border bg-card px-3 pr-10 text-sm text-foreground outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900/40 disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground"
                      >
                        <option value="">
                          {loadingFormData
                            ? "Memuat penjahit..."
                            : "Pilih penjahit"}
                        </option>
                        {tailors
                          .filter((tailor) => tailor.isActive)
                          .map((tailor) => (
                            <option
                              key={tailor.id}
                              value={tailor.id}
                            >
                              {tailor.name}
                            </option>
                          ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    {editingRate && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Penjahit tidak dapat diubah untuk menjaga histori
                        tarif.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">
                      Produk
                    </label>
                    <div className="relative">
                      <select
                        value={form.productId}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            productId: event.target.value,
                          }))
                        }
                        disabled={
                          !!editingRate ||
                          loadingFormData ||
                          saving
                        }
                        className="h-11 w-full appearance-none rounded-xl border border-border bg-card px-3 pr-10 text-sm text-foreground outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900/40 disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground"
                      >
                        <option value="">
                          {loadingFormData
                            ? "Memuat produk..."
                            : "Pilih produk"}
                        </option>
                        {products
                          .filter((product) => product.isActive)
                          .map((product) => (
                            <option
                              key={product.id}
                              value={product.id}
                            >
                              {product.code} - {product.name}
                            </option>
                          ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    {editingRate && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Produk tidak dapat diubah untuk menjaga histori
                        tarif.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">
                      Tarif per pcs
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                        Rp
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={form.rate}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            rate: event.target.value,
                          }))
                        }
                        disabled={saving}
                        placeholder="Contoh: 5000"
                        className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900/40 disabled:bg-background"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">
                        Berlaku Mulai
                      </label>
                      <input
                        type="date"
                        value={form.effectiveFrom}
                        disabled
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-muted-foreground outline-none"
                      />
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Tanggal mulai tidak dapat diubah.
                      </p>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">
                        Berlaku Sampai
                      </label>
                      <input
                        type="date"
                        value={form.effectiveTo}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            effectiveTo: event.target.value,
                          }))
                        }
                        disabled={saving}
                        className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900/40 disabled:bg-background"
                      />
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Kosongkan jika tarif tidak memiliki batas akhir.
                      </p>
                    </div>
                  </div>
                  {editingRate && (
                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-background p-4">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          Status Tarif
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Aktifkan atau nonaktifkan tarif ini.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            isActive: event.target.checked,
                          }))
                        }
                        disabled={saving}
                        className="h-5 w-5 rounded border-slate-300 text-rose-700 dark:text-rose-300 focus:ring-rose-500"
                      />
                    </label>
                  )}
                </div>
                <div className="flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving || loadingFormData}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    )}
                    {saving
                      ? "Menyimpan..."
                      : editingRate
                        ? "Simpan Perubahan"
                        : "Tambah Tarif"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
function SummaryCard({
  label,
  value,
  icon,
  iconClass,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {value.toLocaleString("id-ID")}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
function TableLoading() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index}>
          {Array.from({ length: 7 }).map((_, cellIndex) => (
            <td key={cellIndex} className="px-5 py-5">
              <div className="h-4 animate-pulse rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
