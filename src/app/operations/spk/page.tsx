"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  Plus,
  ClipboardList,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react";

import PermissionGate from "@/components/auth/permission-gate";

type Product = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

type Tailor = {
  id: number;
  name: string;
  isActive: boolean;
};

type SPK = {
  id: number;
  spkNumber: string;
  productId: number;
  tailorId: number;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  product: Product;
  tailor: Tailor;
  _count?: {
    transactions: number;
  };
};

type FormData = {
  spkNumber: string;
  productId: string;
  tailorId: string;
};

const emptyForm: FormData = {
  spkNumber: "",
  productId: "",
  tailorId: "",
};

export default function SPKPage() {
  const [spks, setSpks] = useState<SPK[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tailors, setTailors] = useState<Tailor[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSpk, setEditingSpk] = useState<SPK | null>(null);

  const [form, setForm] =
    useState<FormData>(emptyForm);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        spkRes,
        productRes,
        tailorRes,
      ] = await Promise.all([
        fetch("/api/spks"),
        fetch("/api/products"),
        fetch("/api/tailors"),
      ]);

      const spkJson = await spkRes.json();
      const productJson =
        await productRes.json();
      const tailorJson =
        await tailorRes.json();

      if (
        !spkRes.ok ||
        !spkJson.success
      ) {
        throw new Error(
          spkJson.error ||
            "Gagal mengambil data SPK"
        );
      }

      if (
        !productRes.ok ||
        !productJson.success
      ) {
        throw new Error(
          productJson.error ||
            "Gagal mengambil data product"
        );
      }

      if (
        !tailorRes.ok ||
        !tailorJson.success
      ) {
        throw new Error(
          tailorJson.error ||
            "Gagal mengambil data penjahit"
        );
      }

      setSpks(spkJson.data || []);
      setProducts(productJson.data || []);
      setTailors(tailorJson.data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredSpks = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return spks.filter((spk) => {
      const matchesSearch =
        !keyword ||
        spk.spkNumber
          .toLowerCase()
          .includes(keyword) ||
        spk.product?.code
          ?.toLowerCase()
          .includes(keyword) ||
        spk.product?.name
          ?.toLowerCase()
          .includes(keyword) ||
        spk.tailor?.name
          ?.toLowerCase()
          .includes(keyword);

      const matchesStatus =
        status === "ALL" ||
        spk.status === status;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [spks, search, status]);

  function openCreateModal() {
    setEditingSpk(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(spk: SPK) {
    setEditingSpk(spk);

    setForm({
      spkNumber: spk.spkNumber,
      productId: String(
        spk.productId
      ),
      tailorId: String(
        spk.tailorId
      ),
    });

    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingSpk(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!form.spkNumber.trim()) {
      setError(
        "Nomor SPK wajib diisi."
      );
      return;
    }

    if (!form.productId) {
      setError(
        "Product wajib dipilih."
      );
      return;
    }

    if (!form.tailorId) {
      setError(
        "Penjahit wajib dipilih."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        spkNumber:
          form.spkNumber.trim(),
        productId:
          Number(form.productId),
        tailorId:
          Number(form.tailorId),
      };

      const response = await fetch(
        editingSpk
          ? `/api/spks/${editingSpk.id}`
          : "/api/spks",
        {
          method: editingSpk
            ? "PATCH"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            payload
          ),
        }
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "Gagal menyimpan SPK"
        );
      }

      closeModal();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan SPK"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(
    spk: SPK
  ) {
    const confirmed =
      window.confirm(
        `Hapus SPK "${spk.spkNumber}"?\n\nSPK hanya dapat dihapus jika belum memiliki transaksi.`
      );

    if (!confirmed) return;

    try {
      setError("");

      const response =
        await fetch(
          `/api/spks/${spk.id}`,
          {
            method: "DELETE",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "Gagal menghapus SPK"
        );
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menghapus SPK"
      );
    }
  }

  function getStatusStyle(
    value: SPK["status"]
  ) {
    switch (value) {
      case "ACTIVE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";

      case "COMPLETED":
        return "bg-blue-50 text-blue-700 border-blue-200";

      case "CANCELLED":
        return "bg-red-50 text-red-700 border-red-200";

      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/20 to-violet-50/15 p-4 md:p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-indigo-300/15 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-violet-300/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Production Management
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200">
                <ClipboardList size={22} />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                  SPK
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Kelola Surat Perintah Kerja dan production tracking.
                </p>
              </div>
            </div>
          </div>

          {/* CREATE SPK */}
          <PermissionGate permission="spk.create">
            <button
              onClick={
                openCreateModal
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700"
            >
              <Plus size={17} />
              Create SPK
            </button>
          </PermissionGate>
        </div>

        {/* ERROR */}
        {error && !modalOpen && (
          <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-red-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            <div className="font-semibold">
              Terjadi kesalahan
            </div>

            <div className="mt-1">
              {error}
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div className="rounded-3xl border border-white/80 bg-white p-4 shadow-xl shadow-slate-200/50">
          <div className="flex flex-col gap-3 lg:flex-row">

            <div className="relative flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Cari SPK, product, atau penjahit..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value
                )
              }
              className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            >
              <option value="ALL">
                All Status
              </option>

              <option value="ACTIVE">
                Active
              </option>

              <option value="COMPLETED">
                Completed
              </option>

              <option value="CANCELLED">
                Cancelled
              </option>
            </select>

            {/* REFRESH — TIDAK DIGATE */}
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-xl shadow-slate-200/50">

          <div className="flex flex-col gap-3 border-b border-indigo-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <ClipboardList size={17} />
                </div>

                <h2 className="font-bold text-slate-800">
                  SPK List
                </h2>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {filteredSpks.length} SPK ditemukan
              </p>
            </div>

            <div className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600">
              {filteredSpks.length} Orders
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-60 items-center justify-center">
              <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-600">
                <Loader2
                  size={18}
                  className="animate-spin"
                />
                Loading SPK...
              </div>
            </div>
          ) : filteredSpks.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-400">
                <Search size={22} />
              </div>

              <p className="mt-4 font-bold text-slate-800">
                Tidak ada SPK
              </p>

              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Belum ada SPK yang sesuai dengan filter pencarian kamu.
              </p>

              {/* CREATE SPK EMPTY STATE */}
              <PermissionGate permission="spk.create">
                <button
                  onClick={
                    openCreateModal
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <Plus size={16} />
                  Create SPK
                </button>
              </PermissionGate>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">

                <thead>
                  <tr className="border-b border-indigo-50 bg-gradient-to-r from-indigo-50/70 to-violet-50/50">

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      SPK
                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Product
                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Penjahit
                    </th>

                    <th className="px-5 py-3.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Transactions
                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Status
                    </th>

                    <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {filteredSpks.map(
                    (spk) => (
                      <tr
                        key={spk.id}
                        className="group transition hover:bg-indigo-50/30"
                      >

                        <td className="px-5 py-4">
                          <Link
                            href={`/operations/spk/${spk.id}`}
                            className="font-bold text-indigo-600 transition hover:text-indigo-800"
                          >
                            {spk.spkNumber}
                          </Link>

                          <div className="mt-1 text-[11px] text-slate-400">
                            Production order
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-semibold text-slate-800">
                            {spk.product?.name ||
                              "-"}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {spk.product?.code ||
                              "-"}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-slate-600">
                          {spk.tailor?.name ||
                            "-"}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                            {spk._count
                              ?.transactions ??
                              0}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusStyle(
                              spk.status
                            )}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />

                            {spk.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">

                            {/* VIEW DETAIL — TIDAK DIGATE */}
                            <Link
                              href={`/operations/spk/${spk.id}`}
                              title="View detail"
                              className="rounded-xl p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                            >
                              <ChevronRight
                                size={17}
                              />
                            </Link>

                            {/* EDIT */}
                            <PermissionGate permission="spk.update">
                              <button
                                onClick={() =>
                                  openEditModal(
                                    spk
                                  )
                                }
                                title="Edit"
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                              >
                                <Pencil
                                  size={16}
                                />
                              </button>
                            </PermissionGate>

                            {/* DELETE */}
                            <PermissionGate permission="spk.delete">
                              <button
                                onClick={() =>
                                  handleDelete(
                                    spk
                                  )
                                }
                                title="Delete"
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2
                                  size={16}
                                />
                              </button>
                            </PermissionGate>

                          </div>
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

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">

          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl shadow-slate-950/20">

            <div className="flex items-center justify-between border-b border-indigo-50 bg-gradient-to-r from-indigo-50/70 to-violet-50/40 px-5 py-5">

              <div>
                <div className="flex items-center gap-2">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <ClipboardList size={17} />
                  </div>

                  <h2 className="font-bold text-slate-800">
                    {editingSpk
                      ? "Edit SPK"
                      : "Create SPK"}
                  </h2>

                </div>

                <p className="mt-2 text-xs text-slate-500">
                  {editingSpk
                    ? "Perbarui informasi SPK."
                    : "Buat SPK baru untuk production process."}
                </p>
              </div>

              {/* CLOSE — TIDAK DIGATE */}
              <button
                onClick={
                  closeModal
                }
                disabled={saving}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>

            </div>

            <form
              onSubmit={
                handleSubmit
              }
            >
              <div className="space-y-5 px-5 py-6">

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
                    <div className="font-semibold">
                      Periksa input
                    </div>

                    <div className="mt-1">
                      {error}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    SPK Number
                  </label>

                  <input
                    type="text"
                    value={
                      form.spkNumber
                    }
                    onChange={(e) =>
                      setForm(
                        (prev) => ({
                          ...prev,
                          spkNumber:
                            e.target
                              .value,
                        })
                      )
                    }
                    placeholder="Contoh: SPK-001"
                    disabled={saving}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Product
                  </label>

                  <select
                    value={
                      form.productId
                    }
                    onChange={(e) =>
                      setForm(
                        (prev) => ({
                          ...prev,
                          productId:
                            e.target
                              .value,
                        })
                      )
                    }
                    disabled={saving}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
                  >
                    <option value="">
                      Select product...
                    </option>

                    {products
                      .filter(
                        (product) =>
                          product.isActive
                      )
                      .map(
                        (product) => (
                          <option
                            key={
                              product.id
                            }
                            value={
                              product.id
                            }
                          >
                            {product.code}{" "}
                            —{" "}
                            {product.name}
                          </option>
                        )
                      )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Penjahit
                  </label>

                  <select
                    value={
                      form.tailorId
                    }
                    onChange={(e) =>
                      setForm(
                        (prev) => ({
                          ...prev,
                          tailorId:
                            e.target
                              .value,
                        })
                      )
                    }
                    disabled={saving}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
                  >
                    <option value="">
                      Select penjahit...
                    </option>

                    {tailors
                      .filter(
                        (tailor) =>
                          tailor.isActive
                      )
                      .map(
                        (tailor) => (
                          <option
                            key={
                              tailor.id
                            }
                            value={
                              tailor.id
                            }
                          >
                            {
                              tailor.name
                            }
                          </option>
                        )
                      )}
                  </select>
                </div>

              </div>

              <div className="flex justify-end gap-3 border-t border-indigo-50 bg-slate-50/60 px-5 py-4">

                {/* CANCEL — TIDAK DIGATE */}
                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                {/* SUBMIT */}
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : editingSpk
                      ? "Save Changes"
                      : "Create SPK"}
                </button>

              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}