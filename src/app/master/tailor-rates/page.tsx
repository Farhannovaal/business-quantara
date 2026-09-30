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
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1600px] space-y-6 p-6">
          {/* HEADER */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <CircleDollarSign className="h-6 w-6 text-indigo-600" />
                <h1 className="text-2xl font-bold text-slate-800">
                  Tailor Rates
                </h1>
              </div>

              <p className="text-sm text-slate-500">
                Kelola tarif jasa penjahit berdasarkan produk dan periode
                berlaku.
              </p>
            </div>

            <PermissionGate permission="tailor-rate.manage">
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700"
              >
                <Plus className="h-4 w-4" />
                Tambah Tarif
              </button>
            </PermissionGate>
          </div>

          {/* ALERT */}
          {error && !modalOpen && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">{error}</div>

              <button
                type="button"
                onClick={() => setError("")}
                className="rounded-lg p-1 hover:bg-rose-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* SUMMARY */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard
              label="Total Tarif"
              value={totalRates}
              icon={<CircleDollarSign className="h-5 w-5" />}
              iconClass="bg-indigo-50 text-indigo-600"
            />

            <SummaryCard
              label="Tarif Aktif"
              value={activeRates}
              icon={<ToggleRight className="h-5 w-5" />}
              iconClass="bg-emerald-50 text-emerald-600"
            />

            <SummaryCard
              label="Tarif Nonaktif"
              value={inactiveRates}
              icon={<ToggleLeft className="h-5 w-5" />}
              iconClass="bg-slate-100 text-slate-500"
            />
          </div>

          {/* CONTENT */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* TOOLBAR */}
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari penjahit, produk, atau kode produk..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
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
                    className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>

                <button
                  type="button"
                  onClick={fetchRates}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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

            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Penjahit
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Produk
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Tarif / pcs
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Berlaku Mulai
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Berlaku Sampai
                    </th>

                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <TableLoading />
                  ) : filteredRates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                            <CircleDollarSign className="h-6 w-6 text-slate-400" />
                          </div>

                          <p className="font-semibold text-slate-700">
                            Tidak ada tarif ditemukan
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {search
                              ? "Coba gunakan kata kunci pencarian lain."
                              : "Belum ada tarif penjahit yang tersedia."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRates.map((rate) => (
                      <tr
                        key={rate.id}
                        className="transition hover:bg-slate-50/80"
                      >
                        {/* TAILOR */}
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-800">
                            {rate.tailor.name}
                          </div>

                          <div className="mt-0.5 text-xs text-slate-400">
                            ID #{rate.tailor.id}
                          </div>
                        </td>

                        {/* PRODUCT */}
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-800">
                            {rate.product.name}
                          </div>

                          <div className="mt-0.5 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                            {rate.product.code}
                          </div>
                        </td>

                        {/* RATE */}
                        <td className="px-5 py-4 text-right">
                          <span className="font-semibold text-slate-800">
                            {formatCurrency(rate.rate)}
                          </span>
                        </td>

                        {/* FROM */}
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDate(rate.effectiveFrom)}
                        </td>

                        {/* TO */}
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {rate.effectiveTo
                            ? formatDate(rate.effectiveTo)
                            : "Tidak terbatas"}
                        </td>

                        {/* STATUS */}
                        <td className="px-5 py-4 text-center">
                          {rate.isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              Nonaktif
                            </span>
                          )}
                        </td>

                        {/* ACTION */}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <PermissionGate permission="tailor-rate.manage">
                              <button
                                type="button"
                                onClick={() => openEditModal(rate)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
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
                                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
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

            {/* FOOTER */}
            {!loading && filteredRates.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
                <p className="text-xs text-slate-500">
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-700">
                    {filteredRates.length}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-700">
                    {rates.length}
                  </span>{" "}
                  tarif
                </p>
              </div>
            )}
          </div>
        </div>

        {/* MODAL */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* MODAL HEADER */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {editingRate
                      ? "Edit Tarif Penjahit"
                      : "Tambah Tarif Penjahit"}
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {editingRate
                      ? "Perbarui tarif atau periode berlakunya."
                      : "Tentukan tarif berdasarkan penjahit dan produk."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* MODAL BODY */}
              <form onSubmit={handleSubmit}>
                <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
                  {error && (
                    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* TAILOR */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
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
                        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
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

                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>

                    {editingRate && (
                      <p className="mt-1.5 text-xs text-slate-400">
                        Penjahit tidak dapat diubah untuk menjaga histori
                        tarif.
                      </p>
                    )}
                  </div>

                  {/* PRODUCT */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
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
                        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
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

                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>

                    {editingRate && (
                      <p className="mt-1.5 text-xs text-slate-400">
                        Produk tidak dapat diubah untuk menjaga histori
                        tarif.
                      </p>
                    )}
                  </div>

                  {/* RATE */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Tarif per pcs
                    </label>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
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
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                      />
                    </div>
                  </div>

                  {/* DATE */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Berlaku Mulai
                      </label>

                      <input
                        type="date"
                        value={form.effectiveFrom}
                        disabled
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none"
                      />

                      <p className="mt-1.5 text-xs text-slate-400">
                        Tanggal mulai tidak dapat diubah.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
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
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                      />

                      <p className="mt-1.5 text-xs text-slate-400">
                        Kosongkan jika tarif tidak memiliki batas akhir.
                      </p>
                    </div>
                  </div>

                  {/* ACTIVE */}
                  {editingRate && (
                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-700">
                          Status Tarif
                        </div>

                        <div className="mt-0.5 text-xs text-slate-500">
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
                        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  )}
                </div>

                {/* MODAL FOOTER */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={saving || loadingFormData}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
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
          {Array.from({ length: 7 }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-5 py-5">
              <div className="h-4 animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}