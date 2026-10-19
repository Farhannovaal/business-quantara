"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Edit3,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Trash2,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import PermissionGate from "@/components/auth/permission-gate";
import MasterDataImportExport from "@/components/master-data/master-data-import-export";
type Product = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type ProductForm = {
  code: string;
  name: string;
  isActive: boolean;
};
type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};
const emptyForm: ProductForm = {
  code: "",
  name: "",
  isActive: true,
};
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/products", {
        cache: "no-store",
      });
      const result: ApiResponse<Product[]> = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal mengambil data product.");
      }
      setProducts(result.data ?? []);
    } catch (err) {
      console.error("Gagal mengambil data product:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data products."
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);
function openCreateForm() {
    setEditingProduct(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }
function openEditForm(product: Product) {
    setEditingProduct(product);
    setForm({
      code: product.code,
      name: product.name,
      isActive: product.isActive,
    });
    setError("");
    setShowForm(true);
  }
function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setError("");
  }
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setError("Product code dan product name wajib diisi.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : "/api/products";
      const method = editingProduct ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          isActive: form.isActive,
        }),
      });
      const result: ApiResponse = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal menyimpan product.");
      }
      setShowForm(false);
      setEditingProduct(null);
      setForm(emptyForm);
      await loadProducts();
    } catch (err) {
      console.error("Gagal menyimpan product:", err);
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan product."
      );
    } finally {
      setSaving(false);
    }
  }
async function handleDelete(product: Product) {
    const confirmed = window.confirm(
      `Hapus product "${product.name}"?\n\nData product akan dihapus dari master data.`
    );
    if (!confirmed) return;
    try {
      setError("");
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });
      const result: ApiResponse = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal menghapus product.");
      }
      await loadProducts();
    } catch (err) {
      console.error("Gagal menghapus product:", err);
      setError(
        err instanceof Error ? err.message : "Gagal menghapus product."
      );
    }
  }
async function toggleStatus(product: Product) {
    try {
      setError("");
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: !product.isActive,
        }),
      });
      const result: ApiResponse = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal mengubah status product.");
      }
      await loadProducts();
    } catch (err) {
      console.error("Gagal mengubah status product:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengubah status product."
      );
    }
  }
const keyword = search.toLowerCase().trim();
  const filteredProducts = products.filter((product) => {
    return (
      product.code.toLowerCase().includes(keyword) ||
      product.name.toLowerCase().includes(keyword)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const startItem = filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, filteredProducts.length);
  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);
  const activeCount = products.filter((product) => product.isActive).length;
  const inactiveCount = products.length - activeCount;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Package size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Master Data
                </p>
                <h1 className="text-xl font-bold text-foreground">
                  Products
                </h1>
              </div>
            </div>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Kelola product yang digunakan oleh proses operasional.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              onClick={() => void loadProducts()}
              disabled={loading}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-muted-foreground transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
            <PermissionGate permission="product.manage">
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:from-rose-500 hover:to-rose-400"
              >
                <Plus size={17} />
                Add Product
              </button>
            </PermissionGate>
          </div>
        </div>
      </header>
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-7xl min-w-0">
          <section className="mb-6 min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-foreground">
                Import & Export Products
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Download template Excel, import data product, atau export
                data yang tersedia.
              </p>
            </div>
            <div className="min-w-0">
              <MasterDataImportExport
                resource="products"
                viewPermission="product.view"
                managePermission="product.manage"
                onImported={loadProducts}
              />
            </div>
          </section>
          {error && !showForm && (
            <div
              role="alert"
              className="mb-5 flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300"
            >
              <div className="min-w-0">
                <p className="font-semibold">Terjadi kesalahan</p>
                <p className="mt-1 break-words [overflow-wrap:anywhere]">
                  {error}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setError("")}
                className="shrink-0 rounded-lg p-1 text-rose-600 dark:text-rose-400 transition hover:bg-rose-500/15 hover:text-rose-700 dark:text-rose-300"
                aria-label="Tutup pesan error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <Package size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Total Products
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {products.length}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-700 dark:text-emerald-400">
                  <Package size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Active Products
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {activeCount}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:col-span-2 xl:col-span-1">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Package size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Inactive Products
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {inactiveCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex min-w-0 flex-col gap-4 border-b border-border px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <Package size={17} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-foreground">
                      Product List
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {filteredProducts.length} product ditemukan
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative w-full min-w-0 lg:max-w-xs">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search product..."
                  aria-label="Cari product"
                  className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/10"
                />
              </div>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b border-border bg-background/80 backdrop-blur-xl">
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      Code
                    </th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      Product Name
                    </th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      Status
                    </th>
                    <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-16">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            <Loader2 size={21} className="animate-spin" />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-foreground">
                            Loading products...
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sedang mengambil data product.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-16">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            <Search size={22} />
                          </div>
                          <p className="mt-4 text-sm font-bold text-foreground">
                            No products found
                          </p>
                          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                            Belum ada product yang sesuai dengan pencarian
                            kamu.
                          </p>
                          {!search && (
                            <PermissionGate permission="product.manage">
                              <button
                                type="button"
                                onClick={openCreateForm}
                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-700 dark:text-rose-300 transition hover:bg-rose-500/15"
                              >
                                <Plus size={16} />
                                Add Product
                              </button>
                            </PermissionGate>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="transition hover:bg-background/80"
                      >
                        <td className="px-5 py-4">
                          <span className="rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs font-semibold text-foreground">
                            {product.code}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {product.name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Product ID #{product.id}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <PermissionGate
                            permission="product.manage"
                            fallback={
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                  product.isActive
                                    ? "border-emerald-500/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-border bg-muted text-muted-foreground"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    product.isActive
                                      ? "bg-emerald-400"
                                      : "bg-slate-400"
                                  }`}
                                />
                                {product.isActive ? "Active" : "Inactive"}
                              </span>
                            }
                          >
                            <button
                              type="button"
                              onClick={() => void toggleStatus(product)}
                              title="Toggle product status"
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                product.isActive
                                  ? "border-emerald-500/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
                                  : "border-border bg-muted text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  product.isActive
                                    ? "bg-emerald-400"
                                    : "bg-slate-400"
                                }`}
                              />
                              {product.isActive ? "Active" : "Inactive"}
                            </button>
                          </PermissionGate>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <PermissionGate permission="product.manage">
                              <button
                                type="button"
                                onClick={() => openEditForm(product)}
                                className="rounded-xl p-2 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400"
                                title="Edit Product"
                                aria-label={`Edit ${product.name}`}
                              >
                                <Edit3 size={16} />
                              </button>
                            </PermissionGate>
                            <PermissionGate permission="product.manage">
                              <button
                                type="button"
                                onClick={() => void handleDelete(product)}
                                className="rounded-xl p-2 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300"
                                title="Delete Product"
                                aria-label={`Delete ${product.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </PermissionGate>
                            <button
                              type="button"
                              className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-muted-foreground"
                              title="More"
                              aria-label={`More actions for ${product.name}`}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && filteredProducts.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Menampilkan <span className="font-semibold text-foreground">{startItem}–{endItem}</span> dari <span className="font-semibold text-foreground">{filteredProducts.length}</span> product</span>
                  <label className="flex items-center gap-2">
                    <span>Baris:</span>
                    <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:border-rose-500/60" aria-label="Jumlah product per halaman">
                      <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" aria-label="Halaman pertama">«</button>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" aria-label="Halaman sebelumnya">Sebelumnya</button>
                  <span className="px-2 text-xs text-muted-foreground">Halaman <span className="font-semibold text-foreground">{currentPage}</span> / {totalPages}</span>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" aria-label="Halaman berikutnya">Berikutnya</button>
                  <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} className="rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" aria-label="Halaman terakhir">»</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-[2px]">
          <div className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/15 dark:shadow-black/30">
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <Package size={17} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      {editingProduct ? "Edit Product" : "Add Product"}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {editingProduct
                        ? "Update product information."
                        : "Add a new product to master data."}
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="shrink-0 rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Tutup form"
              >
                <X size={18} />
              </button>
            </div>
            {error && (
              <div
                role="alert"
                className="mx-6 mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
              >
                <p className="font-semibold">Unable to save product</p>
                <p className="mt-1 break-words text-xs text-rose-700 dark:text-rose-300 [overflow-wrap:anywhere]">
                  {error}
                </p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label
                  htmlFor="product-code"
                  className="mb-2 block text-xs font-bold text-muted-foreground"
                >
                  Product Code
                </label>
                <input
                  id="product-code"
                  type="text"
                  value={form.code}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      code: event.target.value,
                    })
                  }
                  placeholder="PRD-001"
                  disabled={saving}
                  required
                  className="h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/10 disabled:bg-background"
                />
              </div>
              <div>
                <label
                  htmlFor="product-name"
                  className="mb-2 block text-xs font-bold text-muted-foreground"
                >
                  Product Name
                </label>
                <input
                  id="product-name"
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="Dress Linen"
                  disabled={saving}
                  required
                  className="h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/10 disabled:bg-background"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 transition hover:border-rose-500/40 hover:bg-rose-500/10">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      isActive: event.target.checked,
                    })
                  }
                  disabled={saving}
                  className="h-4 w-4 shrink-0 rounded border-border text-rose-600 dark:text-rose-400 focus:ring-rose-500"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Active product
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Product dapat digunakan dalam proses operasional.
                  </p>
                </div>
              </label>
              <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-rose-500 hover:to-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <Loader2 size={15} className="animate-spin" />
                  )}
                  {saving
                    ? "Saving..."
                    : editingProduct
                      ? "Save Changes"
                      : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}