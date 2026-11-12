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
  Trash2,
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
  tailor: { id: number; name: string };
  product: { id: number; code: string; name: string };
};

type Tailor = { id: number; name: string; isActive: boolean };
type Product = { id: number; code: string; name: string; isActive: boolean };
type FormData = {
  tailorId: string;
  productId: string;
  rate: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
};
type BulkRateItem = { productId: number; rate: string };

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const initialForm: FormData = {
  tailorId: "",
  productId: "",
  rate: "",
  effectiveFrom: today(),
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
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TailorRate | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [bulkItems, setBulkItems] = useState<BulkRateItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [bulkDefaultRate, setBulkDefaultRate] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchRates() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/tailor-rates", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal mengambil data tarif penjahit.");
      }
      setRates(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil data tarif penjahit.");
    } finally {
      setLoading(false);
    }
  }

    async function fetchAllProducts(): Promise<Product[]> {
    const limit = 100;

    const firstResponse = await fetch(
      `/api/products?page=1&limit=${limit}`,
      { cache: "no-store" }
    );

    const firstResult = await firstResponse.json();

    if (!firstResponse.ok || !firstResult.success) {
      throw new Error(
        firstResult.error || "Gagal mengambil data produk."
      );
    }

    const allProducts: Product[] = [
      ...(Array.isArray(firstResult.data) ? firstResult.data : []),
    ];

    const totalPages = Math.max(
      1,
      Number(firstResult.pagination?.totalPages) || 1
    );

    for (let page = 2; page <= totalPages; page++) {
      const response = await fetch(
        `/api/products?page=${page}&limit=${limit}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || `Gagal mengambil produk halaman ${page}.`
        );
      }

      if (Array.isArray(result.data)) {
        allProducts.push(...result.data);
      }
    }

    return Array.from(
      new Map(
        allProducts.map((product) => [product.id, product])
      ).values()
    );
  }

  async function fetchFormData() {
    try {
      setLoadingFormData(true);
      setError("");

      const [tailorResponse, allProducts] = await Promise.all([
        fetch("/api/tailors", { cache: "no-store" }),
        fetchAllProducts(),
      ]);

      const tailorResult = await tailorResponse.json();

      if (!tailorResponse.ok || !tailorResult.success) {
        throw new Error(
          tailorResult.error || "Gagal mengambil data penjahit."
        );
      }

      setTailors(tailorResult.data || []);
      setProducts(allProducts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data form."
      );
    } finally {
      setLoadingFormData(false);
    }
  }

  useEffect(() => {
    void fetchRates();
    void fetchFormData();
  }, []);

  function resetModal() {
    setModalOpen(false);
    setEditingRate(null);
    setForm({ ...initialForm, effectiveFrom: today() });
    setBulkItems([]);
    setProductSearch("");
    setBulkDefaultRate("");
    setError("");
  }

  function openCreateModal() {
    setEditingRate(null);
    setForm({ ...initialForm, effectiveFrom: today() });
    setBulkItems([]);
    setProductSearch("");
    setBulkDefaultRate("");
    setError("");
    setModalOpen(true);
  }

  function formatDateInput(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function openEditModal(rate: TailorRate) {
    setEditingRate(rate);
    setForm({
      tailorId: String(rate.tailorId),
      productId: String(rate.productId),
      rate: String(rate.rate),
      effectiveFrom: formatDateInput(rate.effectiveFrom),
      effectiveTo: rate.effectiveTo ? formatDateInput(rate.effectiveTo) : "",
      isActive: rate.isActive,
    });
    setError("");
    setModalOpen(true);
  }

  function toggleBulkProduct(productId: number) {
    setBulkItems((current) => {
      if (current.some((item) => item.productId === productId)) {
        return current.filter((item) => item.productId !== productId);
      }
      return [...current, { productId, rate: bulkDefaultRate }];
    });
  }

  function updateBulkRate(productId: number, rate: string) {
    setBulkItems((current) =>
      current.map((item) => item.productId === productId ? { ...item, rate } : item),
    );
  }

  function applyBulkDefaultRate() {
    const value = Number(bulkDefaultRate);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Masukkan tarif massal yang lebih besar dari 0.");
      return;
    }
    setBulkItems((current) => current.map((item) => ({ ...item, rate: bulkDefaultRate })));
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.tailorId) return setError("Pilih penjahit terlebih dahulu.");
    if (!editingRate && bulkItems.length === 0) return setError("Pilih minimal satu produk.");
    if (editingRate && (!Number.isFinite(Number(form.rate)) || Number(form.rate) <= 0)) {
      return setError("Tarif harus lebih besar dari 0.");
    }
    if (!editingRate && bulkItems.some((item) => !Number.isFinite(Number(item.rate)) || Number(item.rate) <= 0)) {
      return setError("Pastikan tarif semua produk diisi dan lebih besar dari 0.");
    }
    if (!form.effectiveFrom) return setError("Tanggal mulai tarif wajib diisi.");
    if (form.effectiveTo && new Date(form.effectiveTo) < new Date(form.effectiveFrom)) {
      return setError("Tanggal akhir tidak boleh sebelum tanggal mulai.");
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = editingRate
        ? await fetch(`/api/tailor-rates/${editingRate.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rate: Number(form.rate),
              effectiveTo: form.effectiveTo || null,
              isActive: form.isActive,
            }),
          })
        : await fetch("/api/tailor-rates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tailorId: Number(form.tailorId),
              effectiveFrom: form.effectiveFrom,
              effectiveTo: form.effectiveTo || null,
              items: bulkItems.map((item) => ({
                productId: item.productId,
                rate: Number(item.rate),
              })),
            }),
          });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || (editingRate ? "Gagal memperbarui tarif." : "Gagal menambahkan tarif."));
      }

      setSuccess(editingRate ? "Tarif berhasil diperbarui." : result.message || `${bulkItems.length} tarif berhasil ditambahkan.`);
      resetModal();
      await fetchRates();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan tarif.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(rate: TailorRate) {
    if (!window.confirm(`Nonaktifkan tarif ${rate.tailor.name} - ${rate.product.name}?`)) return;
    try {
      setError("");
      setSuccess("");
      const response = await fetch(`/api/tailor-rates/${rate.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Gagal menonaktifkan tarif.");
      setSuccess("Tarif berhasil dinonaktifkan.");
      await fetchRates();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menonaktifkan tarif.");
    }
  }

  async function handlePermanentDelete(rate: TailorRate) {
    const confirmed = window.confirm(
      `Hapus tarif secara permanen?\n\nPenjahit: ${rate.tailor.name}\nProduk: ${rate.product.name}\nTarif: ${formatCurrency(rate.rate)}\n\nTindakan ini tidak dapat dibatalkan.`,
    );
    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");
      const response = await fetch(
        `/api/tailor-rates/${rate.id}?action=permanent`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal menghapus tarif.");
      }
      setSuccess(result.message || "Tarif berhasil dihapus secara permanen.");
      await fetchRates();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus tarif.");
    }
  }

  const filteredRates = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rates.filter((rate) => {
      const matchesSearch = !keyword ||
        rate.tailor.name.toLowerCase().includes(keyword) ||
        rate.product.name.toLowerCase().includes(keyword) ||
        rate.product.code.toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && rate.isActive) ||
        (statusFilter === "INACTIVE" && !rate.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [rates, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRates.length / pageSize));
  const startItem = filteredRates.length ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, filteredRates.length);
  const paginatedRates = useMemo(
    () => filteredRates.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRates, currentPage, pageSize],
  );

  useEffect(() => setCurrentPage(1), [search, statusFilter, pageSize]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const totalRates = rates.length;
  const activeRates = rates.filter((rate) => rate.isActive).length;
  const inactiveRates = totalRates - activeRates;
  const activeProducts = products.filter((product) => product.isActive);
  const visibleProducts = activeProducts.filter((product) =>
    `${product.code} ${product.name}`.toLowerCase().includes(productSearch.toLowerCase()),
  );

  function formatCurrency(value: number | string) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  function formatDate(value: string | null) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
    }).format(new Date(value));
  }

  return (
    <PermissionGate permission="tailor-rate.view">
      <div className="relative min-h-full space-y-6 overflow-hidden rounded-3xl bg-background p-4 text-foreground md:p-6">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <CircleDollarSign className="h-6 w-6 text-rose-700 dark:text-rose-300" />
                <h1 className="text-2xl font-bold">Tailor Rates</h1>
              </div>
              <p className="text-sm text-muted-foreground">Kelola tarif jasa penjahit berdasarkan produk dan periode berlaku.</p>
            </div>
            <PermissionGate permission="tailor-rate.manage">
              <button type="button" onClick={openCreateModal} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-800">
                <Plus className="h-4 w-4" /> Tambah Tarif
              </button>
            </PermissionGate>
          </div>

          {error && !modalOpen && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">{error}</div>
              <button type="button" onClick={() => setError("")}><X className="h-4 w-4" /></button>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" /> <span>{success}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard label="Total Tarif" value={totalRates} icon={<CircleDollarSign className="h-5 w-5" />} iconClass="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300" />
            <SummaryCard label="Tarif Aktif" value={activeRates} icon={<ToggleRight className="h-5 w-5" />} iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20" />
            <SummaryCard label="Tarif Nonaktif" value={inactiveRates} icon={<ToggleLeft className="h-5 w-5" />} iconClass="border border-border bg-muted text-muted-foreground" />
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari penjahit, produk, atau kode produk..." className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm outline-none focus:border-rose-400" />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-9 text-sm font-medium">
                    <option value="ALL">Semua Status</option>
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <button type="button" onClick={fetchRates} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-background disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px]">
                <thead><tr className="border-b border-border bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Penjahit</th><th className="px-5 py-3">Produk</th><th className="px-5 py-3 text-right">Tarif / pcs</th><th className="px-5 py-3">Berlaku Mulai</th><th className="px-5 py-3">Berlaku Sampai</th><th className="px-5 py-3 text-center">Status</th><th className="px-5 py-3 text-right">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {loading ? <TableLoading /> : filteredRates.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-16 text-center text-sm text-muted-foreground">Tidak ada tarif ditemukan.</td></tr>
                  ) : paginatedRates.map((rate) => (
                    <tr key={rate.id} className="transition hover:bg-muted/70">
                      <td className="px-5 py-4"><div className="font-medium">{rate.tailor.name}</div><div className="mt-0.5 text-xs text-muted-foreground">ID #{rate.tailor.id}</div></td>
                      <td className="px-5 py-4"><div className="font-medium">{rate.product.name}</div><div className="mt-0.5 inline-flex rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{rate.product.code}</div></td>
                      <td className="px-5 py-4 text-right font-semibold">{formatCurrency(rate.rate)}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(rate.effectiveFrom)}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{rate.effectiveTo ? formatDate(rate.effectiveTo) : "Tidak terbatas"}</td>
                      <td className="px-5 py-4 text-center">{rate.isActive ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">Aktif</span> : <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Nonaktif</span>}</td>
                      <td className="px-5 py-4"><div className="flex items-center justify-end gap-2"><PermissionGate permission="tailor-rate.manage"><button type="button" onClick={() => openEditModal(rate)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"><Edit3 className="h-3.5 w-3.5" /> Edit</button>{rate.isActive && <button type="button" onClick={() => handleDeactivate(rate)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"><ToggleLeft className="h-3.5 w-3.5" /> Nonaktifkan</button>}<button type="button" onClick={() => handlePermanentDelete(rate)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50" title="Hapus tarif permanen"><Trash2 className="h-3.5 w-3.5" /> Hapus</button></PermissionGate></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!loading && filteredRates.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                  <p>Menampilkan <span className="font-semibold text-foreground">{startItem}-{endItem}</span> dari <span className="font-semibold text-foreground">{filteredRates.length}</span> tarif</p>
                  <label className="flex items-center gap-2">Baris per halaman<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-border bg-muted px-2 py-1.5">{[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40">Awal</button>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40">Sebelumnya</button>
                  <span className="px-2 text-xs text-muted-foreground">{currentPage} / {totalPages}</span>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40">Berikutnya</button>
                  <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40">Akhir</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
              <div className="flex items-start justify-between border-b border-border bg-muted p-5 md:p-6">
                <div><h2 className="text-lg font-bold">{editingRate ? "Edit Tarif Penjahit" : "Tambah Tarif Penjahit"}</h2><p className="mt-0.5 text-xs text-muted-foreground">{editingRate ? "Perbarui tarif atau periode berlakunya." : "Pilih satu penjahit dan tambahkan tarif untuk beberapa produk sekaligus."}</p></div>
                <button type="button" onClick={resetModal} disabled={saving} className="rounded-lg p-2 text-muted-foreground hover:bg-background disabled:opacity-50"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5 md:p-6">
                  {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div>}

                  <div>
                    <label className="mb-2 block text-sm font-semibold">Penjahit</label>
                    <select value={form.tailorId} onChange={(event) => setForm((current) => ({ ...current, tailorId: event.target.value }))} disabled={!!editingRate || loadingFormData || saving} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm disabled:bg-background">
                      <option value="">{loadingFormData ? "Memuat penjahit..." : "Pilih penjahit"}</option>
                      {tailors.filter((tailor) => tailor.isActive).map((tailor) => <option key={tailor.id} value={tailor.id}>{tailor.name}</option>)}
                    </select>
                    {editingRate && <p className="mt-1 text-xs text-muted-foreground">Penjahit tidak dapat diubah untuk menjaga histori tarif.</p>}
                  </div>

                  {!editingRate ? (
                    <>
                      <div className="space-y-3">
                        <div><label className="mb-2 block text-sm font-semibold">Cari Produk</label><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari nama atau kode produk..." disabled={saving || loadingFormData} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm" /></div>
                        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{bulkItems.length} produk dipilih dari {activeProducts.length} produk aktif</p><div className="flex gap-3"><button type="button" disabled={saving || loadingFormData} onClick={() => { const selected = new Set(bulkItems.map((item) => item.productId)); setBulkItems((current) => [...current, ...visibleProducts.filter((product) => !selected.has(product.id)).map((product) => ({ productId: product.id, rate: bulkDefaultRate }))]); }} className="text-xs font-semibold text-rose-700 hover:underline">Pilih hasil pencarian</button><button type="button" disabled={saving || !bulkItems.length} onClick={() => setBulkItems([])} className="text-xs font-semibold text-muted-foreground hover:underline disabled:opacity-40">Hapus pilihan</button></div></div>
                        <div className="max-h-52 overflow-y-auto rounded-xl border border-border">{visibleProducts.length ? visibleProducts.map((product) => <label key={product.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-muted"><input type="checkbox" checked={bulkItems.some((item) => item.productId === product.id)} onChange={() => toggleBulkProduct(product.id)} disabled={saving} className="h-4 w-4 rounded text-rose-700" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{product.name}</span><span className="text-xs text-muted-foreground">{product.code}</span></span></label>) : <p className="p-4 text-center text-sm text-muted-foreground">Produk tidak ditemukan.</p>}</div>
                      </div>

                      <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/10">
                        <div><p className="text-sm font-semibold">Isi Tarif Massal</p><p className="mt-1 text-xs text-muted-foreground">Terapkan satu nominal ke semua produk terpilih. Tarif masih bisa diedit satu per satu.</p></div>
                        <div className="flex gap-2"><div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span><input type="number" min="1" step="1" value={bulkDefaultRate} onChange={(event) => setBulkDefaultRate(event.target.value)} placeholder="Contoh: 15000" disabled={saving} className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm" /></div><button type="button" onClick={applyBulkDefaultRate} disabled={saving || !bulkItems.length} className="rounded-lg bg-rose-700 px-4 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50">Terapkan</button></div>
                      </div>

                      {bulkItems.length > 0 && <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-sm font-semibold">Tarif per Produk</label><span className="text-xs text-muted-foreground">{bulkItems.length} produk</span></div>{bulkItems.map((item) => { const product = products.find((entry) => entry.id === item.productId); if (!product) return null; return <div key={item.productId} className="flex items-center gap-3 rounded-xl border border-border p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.code}</p></div><div className="relative w-36 shrink-0"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span><input type="number" min="1" step="1" value={item.rate} onChange={(event) => updateBulkRate(item.productId, event.target.value)} disabled={saving} placeholder="Tarif" className="h-9 w-full rounded-lg border border-border bg-card pl-7 pr-2 text-sm" /></div><button type="button" onClick={() => toggleBulkProduct(item.productId)} disabled={saving} title="Hapus produk dari pilihan" className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"><X className="h-4 w-4" /></button></div>; })}</div>}
                    </>
                  ) : (
                    <>
                      <div><label className="mb-2 block text-sm font-semibold">Produk</label><input value={`${editingRate.product.code} - ${editingRate.product.name}`} disabled className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-muted-foreground" /></div>
                      <div><label className="mb-2 block text-sm font-semibold">Tarif per pcs</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span><input type="number" min="1" step="1" value={form.rate} onChange={(event) => setForm((current) => ({ ...current, rate: event.target.value }))} disabled={saving} placeholder="Contoh: 15000" className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm" /></div></div>
                    </>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div><label className="mb-2 block text-sm font-semibold">Berlaku Mulai</label><input type="date" value={form.effectiveFrom} onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))} disabled={!!editingRate || saving} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:text-muted-foreground" />{editingRate && <p className="mt-1 text-xs text-muted-foreground">Tanggal mulai tidak dapat diubah.</p>}</div>
                    <div><label className="mb-2 block text-sm font-semibold">Berlaku Sampai</label><input type="date" value={form.effectiveTo} onChange={(event) => setForm((current) => ({ ...current, effectiveTo: event.target.value }))} disabled={saving} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm" /><p className="mt-1 text-xs text-muted-foreground">Kosongkan jika tarif tidak memiliki batas akhir.</p></div>
                  </div>

                  {editingRate && <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-background p-4"><div><div className="text-sm font-semibold">Status Tarif</div><div className="mt-0.5 text-xs text-muted-foreground">Aktifkan atau nonaktifkan tarif ini.</div></div><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} disabled={saving} className="h-5 w-5 rounded text-rose-700" /></label>}
                </div>
                <div className="flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-4"><button type="button" onClick={resetModal} disabled={saving} className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50">Batal</button><button type="submit" disabled={saving || loadingFormData} className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60">{saving && <RefreshCw className="h-4 w-4 animate-spin" />}{saving ? "Menyimpan..." : editingRate ? "Simpan Perubahan" : `Simpan ${bulkItems.length} Tarif`}</button></div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  );
}

function SummaryCard({ label, value, icon, iconClass }: { label: string; value: number; icon: React.ReactNode; iconClass: string }) {
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value.toLocaleString("id-ID")}</p></div><div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div></div></div>;
}

function TableLoading() {
  return <>{Array.from({ length: 5 }).map((_, index) => <tr key={index}>{Array.from({ length: 7 }).map((__, cellIndex) => <td key={cellIndex} className="px-5 py-5"><div className="h-4 animate-pulse rounded bg-muted" /></td>)}</tr>)}</>;
}
