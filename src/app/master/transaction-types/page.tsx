"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  Plus,
  Search,
  Trash2,
  Workflow,
  X,
} from "lucide-react";

type TransactionType = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sequence: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormData = {
  code: string;
  name: string;
  description: string;
  sequence: number;
  isActive: boolean;
};

const emptyForm: FormData = {
  code: "",
  name: "",
  description: "",
  sequence: 1,
  isActive: true,
};

export default function TransactionTypesPage() {
  const [items, setItems] = useState<TransactionType[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] =
    useState<TransactionType | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/transaction-types"
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to load transaction types"
        );
      }

      setItems(result.data);
    } catch (error) {
      console.error(error);
      alert("Gagal mengambil transaction types.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    const nextSequence =
      items.length > 0
        ? Math.max(...items.map((item) => item.sequence)) + 1
        : 1;

    setEditingItem(null);

    setForm({
      ...emptyForm,
      sequence: nextSequence,
    });

    setShowForm(true);
  };

  const openEdit = (item: TransactionType) => {
    setEditingItem(item);

    setForm({
      code: item.code,
      name: item.name,
      description: item.description ?? "",
      sequence: item.sequence,
      isActive: item.isActive,
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingItem(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!form.code.trim()) {
      alert("Code wajib diisi.");
      return;
    }

    if (!form.name.trim()) {
      alert("Nama transaction type wajib diisi.");
      return;
    }

    try {
      setSaving(true);

      const url = editingItem
        ? `/api/transaction-types/${editingItem.id}`
        : "/api/transaction-types";

      const method = editingItem ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          sequence: Number(form.sequence),
          isActive: form.isActive,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to save transaction type"
        );
      }

      closeForm();
      await loadData();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan transaction type."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (
    item: TransactionType
  ) => {
    try {
      const response = await fetch(
        `/api/transaction-types/${item.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !item.isActive,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to update status"
        );
      }

      await loadData();
    } catch (error) {
      console.error(error);
      alert("Gagal mengubah status.");
    }
  };

  const handleDelete = async (
    item: TransactionType
  ) => {
    const confirmed = window.confirm(
      `Hapus transaction type "${item.name}"?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/transaction-types/${item.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to delete transaction type"
        );
      }

      await loadData();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menghapus transaction type."
      );
    }
  };

  const moveSequence = async (
    item: TransactionType,
    direction: "up" | "down"
  ) => {
    const sorted = [...items].sort(
      (a, b) => a.sequence - b.sequence
    );

    const index = sorted.findIndex(
      (entry) => entry.id === item.id
    );

    const targetIndex =
      direction === "up" ? index - 1 : index + 1;

    if (
      index < 0 ||
      targetIndex < 0 ||
      targetIndex >= sorted.length
    ) {
      return;
    }

    const target = sorted[targetIndex];

    try {
      await Promise.all([
        fetch(`/api/transaction-types/${item.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sequence: target.sequence,
          }),
        }),
        fetch(`/api/transaction-types/${target.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sequence: item.sequence,
          }),
        }),
      ]);

      await loadData();
    } catch (error) {
      console.error(error);
      alert("Gagal mengubah urutan.");
    }
  };

  const filteredItems = items.filter((item) => {
    const keyword = search.toLowerCase();

    return (
      item.code.toLowerCase().includes(keyword) ||
      item.name.toLowerCase().includes(keyword) ||
      (item.description ?? "")
        .toLowerCase()
        .includes(keyword)
    );
  });

  const activeCount = items.filter(
    (item) => item.isActive
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-8">
          <div>
            <p className="text-xs text-slate-400">
              Master Data
            </p>

            <h1 className="text-lg font-semibold text-slate-900">
              Transaction Types
            </h1>
          </div>

          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Transaction Type
          </button>
        </div>
      </header>

      <main className="p-8">
        {/* SUMMARY */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-400">
              Total Transaction Types
            </p>

            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {items.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-400">
              Active Transaction Types
            </p>

            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {activeCount}
            </p>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Transaction Flow
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Define operational transaction types and
                their sequence.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search..."
                className="h-9 w-64 rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-24 px-6 py-3 text-left text-xs font-medium text-slate-500">
                    Sequence
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                    Code
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                    Transaction Type
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-sm text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center"
                    >
                      <Workflow className="mx-auto mb-3 h-8 w-8 text-slate-300" />

                      <p className="text-sm font-medium text-slate-700">
                        No transaction types found
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredItems
                    .sort(
                      (a, b) =>
                        a.sequence - b.sequence
                    )
                    .map((item, index, array) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
                              {item.sequence}
                            </span>

                            <div className="flex flex-col">
                              <button
                                disabled={index === 0}
                                onClick={() =>
                                  moveSequence(
                                    item,
                                    "up"
                                  )
                                }
                                className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>

                              <button
                                disabled={
                                  index ===
                                  array.length - 1
                                }
                                onClick={() =>
                                  moveSequence(
                                    item,
                                    "down"
                                  )
                                }
                                className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                            {item.code}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {item.name}
                            </p>

                            {item.description && (
                              <p className="mt-1 text-xs text-slate-400">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <button
                            onClick={() =>
                              toggleStatus(item)
                            }
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              item.isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {item.isActive
                              ? "Active"
                              : "Inactive"}
                          </button>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() =>
                                openEdit(item)
                              }
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Edit"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() =>
                                handleDelete(item)
                              }
                              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
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
      </main>

      {/* MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingItem
                    ? "Edit Transaction Type"
                    : "Add Transaction Type"}
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Configure a transaction step for the
                  operational workflow.
                </p>
              </div>

              <button
                onClick={closeForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600">
                    Code
                  </label>

                  <input
                    value={form.code}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        code: event.target.value
                          .toUpperCase()
                          .replace(/\s+/g, "_"),
                      })
                    }
                    placeholder="PENGIRIMAN_JAHIT"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600">
                    Sequence
                  </label>

                  <input
                    type="number"
                    min={0}
                    value={form.sequence}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        sequence: Number(
                          event.target.value
                        ),
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">
                  Name
                </label>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="Pengiriman Siap Jahit"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Deskripsi transaction type..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      isActive: event.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />

                <span className="text-sm text-slate-700">
                  Active transaction type
                </span>
              </label>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
