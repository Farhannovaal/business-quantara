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
      `Hapus tailor "${tailor.name}"?\n\nData tailor akan dihapus dari master data.`
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

  const activeCount = tailors.filter(
    (tailor) => tailor.isActive
  ).length;

  const inactiveCount =
    tailors.length - activeCount;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex min-h-20 flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Scissors size={18} />
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">
                  Master Data
                </p>

                <h1 className="text-xl font-bold text-slate-800">
                  Tailors
                </h1>
              </div>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Kelola data penjahit yang digunakan dalam
              proses produksi.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadTailors}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700"
              >
                <Plus size={17} />
                Add Tailor
              </button>
            </PermissionGate>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {/* ERROR */}
          {error && !showForm && (
            <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-700">
              <div>
                <p className="font-semibold">
                  Terjadi kesalahan
                </p>

                <p className="mt-0.5 text-rose-600">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                className="rounded-lg p-1 text-rose-400 transition hover:bg-rose-100 hover:text-rose-600"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* SUMMARY */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {/* Total */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Scissors size={20} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Total Tailors
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {tailors.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Active */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Scissors size={20} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Active Tailors
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {activeCount}
                  </p>
                </div>
              </div>
            </div>

            {/* Inactive */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Scissors size={20} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Inactive Tailors
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {inactiveCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* TABLE HEADER */}
            <div className="flex flex-col gap-4 border-b border-indigo-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Scissors size={17} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-800">
                      Tailor List
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {filteredTailors.length} tailor
                      ditemukan
                    </p>
                  </div>
                </div>
              </div>

              {/* SEARCH */}
              <div className="relative w-full sm:w-72">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search tailor..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50"
                />
              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-indigo-50 bg-gradient-to-r from-indigo-50/60 to-violet-50/40">
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Tailor Name
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
                      <td
                        colSpan={3}
                        className="px-5 py-16"
                      >
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                            <Loader2
                              size={21}
                              className="animate-spin"
                            />
                          </div>

                          <p className="mt-3 text-sm font-semibold text-slate-700">
                            Loading tailors...
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
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
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-400">
                            <Scissors size={22} />
                          </div>

                          <p className="mt-4 text-sm font-bold text-slate-800">
                            No tailors found
                          </p>

                          <p className="mt-1 max-w-sm text-xs text-slate-400">
                            Belum ada tailor yang sesuai
                            dengan pencarian kamu.
                          </p>

                          {!search && (
                            <PermissionGate permission="tailor.manage">
                              <button
                                type="button"
                                onClick={openCreateForm}
                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
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
                    filteredTailors.map((tailor) => (
                      <tr
                        key={tailor.id}
                        className="transition hover:bg-slate-50/80"
                      >
                        {/* NAME */}
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {tailor.name}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-400">
                              Tailor ID #{tailor.id}
                            </p>
                          </div>
                        </td>

                        {/* STATUS */}
                        <td className="px-5 py-4">
                          <PermissionGate
                            permission="tailor.manage"
                            fallback={
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                  tailor.isActive
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-slate-100 text-slate-500"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    tailor.isActive
                                      ? "bg-emerald-500"
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
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  tailor.isActive
                                    ? "bg-emerald-500"
                                    : "bg-slate-400"
                                }`}
                              />

                              {tailor.isActive
                                ? "Active"
                                : "Inactive"}
                            </button>
                          </PermissionGate>
                        </td>

                        {/* ACTIONS */}
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <PermissionGate permission="tailor.manage">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditForm(tailor)
                                }
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
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
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                title="Delete Tailor"
                              >
                                <Trash2 size={16} />
                              </button>
                            </PermissionGate>

                            <button
                              type="button"
                              className="rounded-xl p-2 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
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
          </div>
        </div>
      </main>

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-900/20">
            {/* MODAL HEADER */}
            <div className="flex items-start justify-between border-b border-indigo-50 px-6 py-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Scissors size={17} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      {editingTailor
                        ? "Edit Tailor"
                        : "Add Tailor"}
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
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
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL ERROR */}
            {error && (
              <div className="mx-6 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p className="font-semibold">
                  Unable to save tailor
                </p>

                <p className="mt-0.5 text-xs text-rose-600">
                  {error}
                </p>
              </div>
            )}

            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-600">
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
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 disabled:bg-slate-50"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-indigo-100 hover:bg-indigo-50/40">
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
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />

                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Active tailor
                  </p>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Tailor dapat digunakan dalam proses
                    produksi.
                  </p>
                </div>
              </label>

              {/* ACTIONS */}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
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