"use client";

import { FormEvent, useEffect, useState } from "react";

import {

  Edit3,

  MoreHorizontal,

  Plus,

  Search,

  Scissors,

  Trash2,

  X,

  Loader2,

  RefreshCw,

} from "lucide-react";

import PermissionGate from "@/components/auth/permission-gate";

import MasterDataImportExport from "@/components/master-data/master-data-import-export";

type Tailor = {

  id: number;

  name: string;

  isActive: boolean;

  createdAt: string;

  updatedAt: string;

};

type TailorForm = {

  name: string;

  isActive: boolean;

};

const emptyForm: TailorForm = {

  name: "",

  isActive: true,

};

export default function TailorsPage() {

  const [tailors, setTailors] = useState<Tailor[]>([]);

  const [search, setSearch] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);

  const [editingTailor, setEditingTailor] =

    useState<Tailor | null>(null);

  const [form, setForm] =

    useState<TailorForm>(emptyForm);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const loadTailors = async () => {

    try {

      setLoading(true);

      setError("");

      const response = await fetch("/api/tailors", {

        cache: "no-store",

      });

      const result = await response.json();

      if (!response.ok || !result.success) {

        throw new Error(

          result.error || "Failed to load tailors"

        );

      }

      setTailors(result.data);

    } catch (error) {

      console.error(error);

      setError(

        error instanceof Error

          ? error.message

          : "Gagal mengambil data tailors."

      );

    } finally {

      setLoading(false);

    }

  };

  useEffect(() => {

    loadTailors();

  }, []);

  function openCreateForm() {

    setEditingTailor(null);

    setForm(emptyForm);

    setError("");

    setShowForm(true);

  }

  function openEditForm(tailor: Tailor) {

    setEditingTailor(tailor);

    setForm({

      name: tailor.name,

      isActive: tailor.isActive,

    });

    setError("");

    setShowForm(true);

  }

  function closeForm() {

    if (saving) return;

    setShowForm(false);

    setEditingTailor(null);

    setForm(emptyForm);

    setError("");

  }

  const handleSubmit = async (

    event: FormEvent<HTMLFormElement>

  ) => {

    event.preventDefault();

    if (!form.name.trim()) {

      setError("Nama penjahit wajib diisi.");

      return;

    }

    try {

      setSaving(true);

      setError("");

      const url = editingTailor

        ? `/api/tailors/${editingTailor.id}`

        : "/api/tailors";

      const method = editingTailor

        ? "PATCH"

        : "POST";

      const response = await fetch(url, {

        method,

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          name: form.name.trim(),

          isActive: form.isActive,

        }),

      });

      const result = await response.json();

      if (!response.ok || !result.success) {

        throw new Error(

          result.error || "Failed to save tailor"

        );

      }

      closeForm();

      await loadTailors();

    } catch (error) {

      console.error(error);

      setError(

        error instanceof Error

          ? error.message

          : "Gagal menyimpan tailor."

      );

    } finally {

      setSaving(false);

    }

  };

  const handleDelete = async (tailor: Tailor) => {

    const confirmed = window.confirm(

      `Hapus tailor "${tailor.name}"?nnData tailor akan dihapus dari master data.`

    );

    if (!confirmed) return;

    try {

      setError("");

      const response = await fetch(

        `/api/tailors/${tailor.id}`,

        {

          method: "DELETE",

        }

      );

      const result = await response.json();

      if (!response.ok || !result.success) {

        throw new Error(

          result.error || "Failed to delete tailor"

        );

      }

      await loadTailors();

    } catch (error) {

      console.error(error);

      setError(

        error instanceof Error

          ? error.message

          : "Gagal menghapus tailor."

      );

    }

  };

  const toggleStatus = async (tailor: Tailor) => {

    try {

      setError("");

      const response = await fetch(

        `/api/tailors/${tailor.id}`,

        {

          method: "PATCH",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            isActive: !tailor.isActive,

          }),

        }

      );

      const result = await response.json();

      if (!response.ok || !result.success) {

        throw new Error(

          result.error || "Failed to update status"

        );

      }

      await loadTailors();

    } catch (error) {

      console.error(error);

      setError(

        error instanceof Error

          ? error.message

          : "Gagal mengubah status tailor."

      );

    }

  };

  const filteredTailors = tailors.filter(

    (tailor) =>

      tailor.name

        .toLowerCase()

        .includes(search.toLowerCase().trim())

  );

  const totalPages = Math.max(1, Math.ceil(filteredTailors.length / pageSize));

  const startIndex = (currentPage - 1)  * pageSize;

  const paginatedTailors = filteredTailors.slice(startIndex, startIndex + pageSize);

  useEffect(() => {

    setCurrentPage(1);

  }, [search, pageSize]);

  useEffect(() => {

    if (currentPage > totalPages) setCurrentPage(totalPages);

  }, [currentPage, totalPages]);

  const activeCount = tailors.filter(

    (tailor) => tailor.isActive

  ).length;

  const inactiveCount =

    tailors.length - activeCount;

  return (

    <div className="min-h-screen bg-gradient-to-br from-[#090909] via-[#111111] to-[#18090b]">

      <header className="border-b border-white/10 bg-[#111111]">

        <div className="flex min-h-20 flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">

          <div>

            <div className="flex items-center gap-2">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">

                <Scissors size={18} />

              </div>

              <div>

                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">

                  Master Data

                </p>

                <h1 className="text-xl font-bold text-white">

                  Tailors

                </h1>

              </div>

            </div>

            <p className="mt-2 text-sm text-white/50">

              Kelola data penjahit yang digunakan dalam

              proses produksi.

            </p>

          </div>

          <div className="flex items-center gap-2">

            <button

              type="button"

              onClick={loadTailors}

              disabled={loading}

              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#111111] px-3.5 text-sm font-semibold text-white/50 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50"

            >

              <RefreshCw

                size={16}

                className={

                  loading ? "animate-spin" : ""

                }

              />

              <span className="hidden sm:inline">

                Refresh

              </span>

            </button>

            <PermissionGate permission="tailor.manage">

              <button

                type="button"

                onClick={openCreateForm}

                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:from-rose-500 hover:to-pink-500"

              >

                <Plus size={17} />

                Add Tailor

              </button>

            </PermissionGate>

          </div>

        </div>

      </header>

      <main className="p-6 lg:p-8">

        <div className="mx-auto max-w-7xl">

          <section className="mb-6 min-w-0 rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-sm sm:p-5">

                      <div className="mb-3">

                        <h2 className="text-sm font-bold text-white">

                          Import & Export Tailors

                        </h2>

                        <p className="mt-1 text-xs leading-5 text-white/50">

                          Download template Excel, import data tailors, atau export

                          data yang tersedia.

                        </p>

                      </div>

                      <div className="min-w-0">

                        <MasterDataImportExport

                          resource="tailors"

                          viewPermission="tailor.view"

                          managePermission="tailor.manage"

                          onImported={loadTailors}

                        />

                      </div>

                    </section>

          {error && !showForm && (

            <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3.5 text-sm text-rose-300">

              <div>

                <p className="font-semibold">

                  Terjadi kesalahan

                </p>

                <p className="mt-0.5 text-rose-300">

                  {error}

                </p>

              </div>

              <button

                type="button"

                onClick={() => setError("")}

                className="rounded-lg p-1 text-rose-400 transition hover:bg-rose-500/20 hover:text-rose-300"

              >

                <X size={16} />

              </button>

            </div>

          )}

          <div className="mb-6 grid gap-4 sm:grid-cols-3">

            <div className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-sm">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">

                  <Scissors size={20} />

                </div>

                <div>

                  <p className="text-xs font-medium text-white/50">

                    Total Tailors

                  </p>

                  <p className="mt-1 text-2xl font-bold text-white">

                    {tailors.length}

                  </p>

                </div>

              </div>

            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-sm">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">

                  <Scissors size={20} />

                </div>

                <div>

                  <p className="text-xs font-medium text-white/50">

                    Active Tailors

                  </p>

                  <p className="mt-1 text-2xl font-bold text-white">

                    {activeCount}

                  </p>

                </div>

              </div>

            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-sm">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-white/50">

                  <Scissors size={20} />

                </div>

                <div>

                  <p className="text-xs font-medium text-white/50">

                    Inactive Tailors

                  </p>

                  <p className="mt-1 text-2xl font-bold text-white">

                    {inactiveCount}

                  </p>

                </div>

              </div>

            </div>

          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-sm">

            <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">

                    <Scissors size={17} />

                  </div>

                  <div>

                    <h2 className="text-sm font-bold text-white">

                      Tailor List

                    </h2>

                    <p className="mt-0.5 text-xs text-white/50">

                      {filteredTailors.length} tailor

                      ditemukan

                    </p>

                  </div>

                </div>

              </div>

              <div className="relative w-full sm:w-72">

                <Search

                  size={16}

                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"

                />

                <input

                  value={search}

                  onChange={(event) =>

                    setSearch(event.target.value)

                  }

                  placeholder="Search tailor..."

                  className="h-10 w-full rounded-xl border border-white/10 bg-[#111111] pl-9 pr-4 text-sm text-white/90 outline-none transition placeholder:text-white/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"

                />

              </div>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full min-w-[700px]">

                <thead>

                  <tr className="border-b border-white/10 bg-[#090909]">

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-white/50">

                      Tailor Name

                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-white/50">

                      Status

                    </th>

                    <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-white/50">

                      Actions

                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-white/10">

                  {loading ? (

                    <tr>

                      <td

                        colSpan={3}

                        className="px-5 py-16"

                      >

                        <div className="flex flex-col items-center justify-center text-center">

                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">

                            <Loader2

                              size={21}

                              className="animate-spin"

                            />

                          </div>

                          <p className="mt-3 text-sm font-semibold text-white/90">

                            Loading tailors...

                          </p>

                          <p className="mt-1 text-xs text-white/50">

                            Sedang mengambil data tailor.

                          </p>

                        </div>

                      </td>

                    </tr>

                  ) : filteredTailors.length === 0 ? (

                    <tr>

                      <td

                        colSpan={3}

                        className="px-5 py-16"

                      >

                        <div className="flex flex-col items-center justify-center text-center">

                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">

                            <Scissors size={22} />

                          </div>

                          <p className="mt-4 text-sm font-bold text-white">

                            No tailors found

                          </p>

                          <p className="mt-1 max-w-sm text-xs text-white/50">

                            Belum ada tailor yang sesuai

                            dengan pencarian kamu.

                          </p>

                          {!search && (

                            <PermissionGate permission="tailor.manage">

                              <button

                                type="button"

                                onClick={openCreateForm}

                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20"

                              >

                                <Plus size={16} />

                                Add Tailor

                              </button>

                            </PermissionGate>

                          )}

                        </div>

                      </td>

                    </tr>

                  ) : (

                    paginatedTailors.map((tailor) => (

                      <tr

                        key={tailor.id}

                        className="transition hover:bg-white/[0.04]"

                      >

                        <td className="px-5 py-4">

                          <div>

                            <p className="text-sm font-semibold text-white">

                              {tailor.name}

                            </p>

                            <p className="mt-0.5 text-[11px] text-white/50">

                              Tailor ID #{tailor.id}

                            </p>

                          </div>

                        </td>

                        <td className="px-5 py-4">

                          <PermissionGate

                            permission="tailor.manage"

                            fallback={

                              <span

                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${

                                  tailor.isActive

                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"

                                    : "border-white/10 bg-white/[0.06] text-white/50"

                                }`}

                              >

                                <span

                                  className={`h-1.5 w-1.5 rounded-full ${

                                    tailor.isActive

                                      ? "bg-emerald-500/100"

                                      : "bg-slate-400"

                                  }`}

                                />

                                {tailor.isActive

                                  ? "Active"

                                  : "Inactive"}

                              </span>

                            }

                          >

                            <button

                              type="button"

                              onClick={() =>

                                toggleStatus(tailor)

                              }

                              title="Toggle tailor status"

                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${

                                tailor.isActive

                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-100"

                                  : "border-white/10 bg-white/[0.06] text-white/50 hover:bg-white/10"

                              }`}

                            >

                              <span

                                className={`h-1.5 w-1.5 rounded-full ${

                                  tailor.isActive

                                    ? "bg-emerald-500/100"

                                    : "bg-slate-400"

                                }`}

                              />

                              {tailor.isActive

                                ? "Active"

                                : "Inactive"}

                            </button>

                          </PermissionGate>

                        </td>

                        <td className="px-5 py-4">

                          <div className="flex justify-end gap-1">

                            <PermissionGate permission="tailor.manage">

                              <button

                                type="button"

                                onClick={() =>

                                  openEditForm(tailor)

                                }

                                className="rounded-xl p-2 text-white/50 transition hover:bg-rose-500/10 hover:text-rose-400"

                                title="Edit Tailor"

                              >

                                <Edit3 size={16} />

                              </button>

                            </PermissionGate>

                            <PermissionGate permission="tailor.manage">

                              <button

                                type="button"

                                onClick={() =>

                                  handleDelete(tailor)

                                }

                                className="rounded-xl p-2 text-white/50 transition hover:bg-rose-500/10 hover:text-rose-300"

                                title="Delete Tailor"

                              >

                                <Trash2 size={16} />

                              </button>

                            </PermissionGate>

                            <button

                              type="button"

                              className="rounded-xl p-2 text-white/50 transition hover:bg-white/[0.06] hover:text-white/50"

                              title="More"

                            >

                              <MoreHorizontal

                                size={16}

                              />

                            </button>

                          </div>

                        </td>

                      </tr>

                    ))

                  )}

                </tbody>

                            </table>

            </div>

            {!loading && filteredTailors.length > 0 && (

              <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">

                <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">

                  <span>

                    Menampilkan {startIndex + 1}–{Math.min(startIndex + pageSize, filteredTailors.length)} dari {filteredTailors.length} tailor

                  </span>

                  <label className="flex items-center gap-2">

                    Baris:

                    <select

                      value={pageSize}

                      onChange={(event) => setPageSize(Number(event.target.value))}

                      className="rounded-lg border border-white/10 bg-[#111111] px-2 py-1.5 text-xs text-white/90 outline-none focus:border-rose-500"

                      aria-label="Jumlah data per halaman"

                    >

                      <option value={10}>10</option>

                      <option value={25}>25</option>

                      <option value={50}>50</option>

                    </select>

                  </label>

                </div>

                <div className="flex items-center gap-1">

                  <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40">Pertama</button>

                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button>

                  <span className="px-2 text-xs text-white/60">Halaman {currentPage} dari {totalPages}</span>

                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button>

                  <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40">Terakhir</button>

                </div>

              </div>

            )}

          </div>

        </div>

      </main>

      {showForm && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">

          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-2xl shadow-black/30">

            <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">

              <div>

                <div className="flex items-center gap-2.5">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">

                    <Scissors size={17} />

                  </div>

                  <div>

                    <h2 className="text-base font-bold text-white">

                      {editingTailor

                        ? "Edit Tailor"

                        : "Add Tailor"}

                    </h2>

                    <p className="mt-0.5 text-xs text-white/50">

                      {editingTailor

                        ? "Update tailor information."

                        : "Add a new tailor to master data."}

                    </p>

                  </div>

                </div>

              </div>

              <button

                type="button"

                onClick={closeForm}

                disabled={saving}

                className="rounded-xl p-2 text-white/50 transition hover:bg-white/[0.06] hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-50"

              >

                <X size={18} />

              </button>

            </div>

            {error && (

              <div className="mx-6 mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">

                <p className="font-semibold">

                  Unable to save tailor

                </p>

                <p className="mt-0.5 text-xs text-rose-300">

                  {error}

                </p>

              </div>

            )}

            <form

              onSubmit={handleSubmit}

              className="space-y-5 p-6"

            >

              <div>

                <label className="mb-2 block text-xs font-bold text-white/50">

                  Tailor Name

                </label>

                <input

                  value={form.name}

                  onChange={(event) =>

                    setForm({

                      ...form,

                      name: event.target.value,

                    })

                  }

                  placeholder="Contoh: Penjahit A"

                  disabled={saving}

                  className="h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3.5 text-sm text-white/90 outline-none transition placeholder:text-white/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 disabled:bg-[#090909]"

                />

              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#090909] px-4 py-3 transition hover:border-rose-500/40 hover:bg-rose-500/10/40">

                <input

                  type="checkbox"

                  checked={form.isActive}

                  onChange={(event) =>

                    setForm({

                      ...form,

                      isActive:

                        event.target.checked,

                    })

                  }

                  disabled={saving}

                  className="h-4 w-4 rounded border-white/20 text-rose-400 focus:ring-rose-500/20"

                />

                <div>

                  <p className="text-sm font-semibold text-white/90">

                    Active tailor

                  </p>

                  <p className="mt-0.5 text-xs text-white/50">

                    Tailor dapat digunakan dalam proses

                    produksi.

                  </p>

                </div>

              </label>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-5">

                <button

                  type="button"

                  onClick={closeForm}

                  disabled={saving}

                  className="rounded-xl border border-white/10 bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white/50 transition hover:bg-[#090909] disabled:cursor-not-allowed disabled:opacity-50"

                >

                  Cancel

                </button>

                <button

                  type="submit"

                  disabled={saving}

                  className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-rose-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-60"

                >

                  {saving && (

                    <Loader2

                      size={15}

                      className="animate-spin"

                    />

                  )}

                  {saving

                    ? "Saving..."

                    : editingTailor

                      ? "Save Changes"

                      : "Save Tailor"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>

  );

}
