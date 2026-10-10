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
import ProductImportExport from "@/components/products/product-import-export";
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
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Mengambil data product.
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

  // Membuka form untuk menambahkan product.
  function openCreateForm() {
    setEditingProduct(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  // Membuka form untuk mengedit product.
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

  // Menutup modal form.
  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setError("");
  }

  // Menyimpan product baru atau perubahan product.
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

  // Menghapus product.
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

  // Mengubah status Active/Inactive.
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

  // Pencarian berdasarkan kode atau nama product.
  const keyword = search.toLowerCase().trim();

  const filteredProducts = products.filter((product) => {
    return (
      product.code.toLowerCase().includes(keyword) ||
      product.name.toLowerCase().includes(keyword)
    );
  });

  const activeCount = products.filter((product) => product.isActive).length;
  const inactiveCount = products.length - activeCount;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header halaman */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Package size={18} />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">
                  Master Data
                </p>

                <h1 className="text-xl font-bold text-slate-800">
                  Products
                </h1>
              </div>
            </div>

            <p className="mt-2 max-w-md text-sm text-slate-500">
              Kelola product yang digunakan oleh proses operasional.
            </p>
          </div>

          {/* Aksi utama header */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              onClick={() => void loadProducts()}
              disabled={loading}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700"
              >
                <Plus size={17} />
                Add Product
              </button>
            </PermissionGate>
          </div>
        </div>
      </header>

      {/* Konten halaman */}
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-7xl min-w-0">
          {/* Import, Export, Template, dan notifikasi */}
          <section className="mb-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-slate-800">
                Import & Export Products
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500">
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

          {/* Error umum halaman */}
          {error && !showForm && (
            <div
              role="alert"
              className="mb-5 flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
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
                className="shrink-0 rounded-lg p-1 text-rose-400 transition hover:bg-rose-100 hover:text-rose-600"
                aria-label="Tutup pesan error"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Summary */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {/* Total products */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Package size={20} />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-400">
                    Total Products
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {products.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Active products */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Package size={20} />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-400">
                    Active Products
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {activeCount}
                  </p>
                </div>
              </div>
            </div>

            {/* Inactive products */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Package size={20} />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-400">
                    Inactive Products
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {inactiveCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Product table */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Table header */}
            <div className="flex min-w-0 flex-col gap-4 border-b border-indigo-50 px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Package size={17} />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-800">
                      Product List
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {filteredProducts.length} product ditemukan
                    </p>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="relative w-full min-w-0 lg:max-w-xs">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search product..."
                  aria-label="Cari product"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50"
                />
              </div>
            </div>

            {/* Table: scroll horizontal pada layar kecil */}
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b border-indigo-50 bg-gradient-to-r from-indigo-50/60 to-violet-50/40">
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Code
                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Product Name
                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-16">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                            <Loader2 size={21} className="animate-spin" />
                          </div>

                          <p className="mt-3 text-sm font-semibold text-slate-700">
                            Loading products...
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Sedang mengambil data product.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-16">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-400">
                            <Search size={22} />
                          </div>

                          <p className="mt-4 text-sm font-bold text-slate-800">
                            No products found
                          </p>

                          <p className="mt-1 max-w-sm text-xs text-slate-400">
                            Belum ada product yang sesuai dengan pencarian
                            kamu.
                          </p>

                          {!search && (
                            <PermissionGate permission="product.manage">
                              <button
                                type="button"
                                onClick={openCreateForm}
                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
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
                    filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="transition hover:bg-slate-50/80"
                      >
                        {/* Code */}
                        <td className="px-5 py-4">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-700">
                            {product.code}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {product.name}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-400">
                              Product ID #{product.id}
                            </p>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <PermissionGate
                            permission="product.manage"
                            fallback={
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                  product.isActive
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-slate-100 text-slate-500"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    product.isActive
                                      ? "bg-emerald-500"
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
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  product.isActive
                                    ? "bg-emerald-500"
                                    : "bg-slate-400"
                                }`}
                              />

                              {product.isActive ? "Active" : "Inactive"}
                            </button>
                          </PermissionGate>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <PermissionGate permission="product.manage">
                              <button
                                type="button"
                                onClick={() => openEditForm(product)}
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
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
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                title="Delete Product"
                                aria-label={`Delete ${product.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </PermissionGate>

                            <button
                              type="button"
                              className="rounded-xl p-2 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
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
          </section>
        </div>
      </main>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-900/20">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-indigo-50 px-6 py-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Package size={17} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      {editingProduct ? "Edit Product" : "Add Product"}
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
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
                className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Tutup form"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Error */}
            {error && (
              <div
                role="alert"
                className="mx-6 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                <p className="font-semibold">Unable to save product</p>

                <p className="mt-1 break-words text-xs text-rose-600 [overflow-wrap:anywhere]">
                  {error}
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {/* Product Code */}
              <div>
                <label
                  htmlFor="product-code"
                  className="mb-2 block text-xs font-bold text-slate-600"
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
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 disabled:bg-slate-50"
                />
              </div>

              {/* Product Name */}
              <div>
                <label
                  htmlFor="product-name"
                  className="mb-2 block text-xs font-bold text-slate-600"
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
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 disabled:bg-slate-50"
                />
              </div>

              {/* Active */}
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-indigo-100 hover:bg-indigo-50/40">
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
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />

                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Active product
                  </p>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Product dapat digunakan dalam proses operasional.
                  </p>
                </div>
              </label>

              {/* Actions */}
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
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