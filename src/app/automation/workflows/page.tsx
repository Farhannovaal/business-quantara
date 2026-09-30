"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Edit3,
  GitBranch,
  Plus,
  Search,
  Settings2,
  Trash2,
  Workflow as WorkflowIcon,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";

import PermissionGate from "@/components/auth/permission-gate";

type Workflow = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  _count: {
    steps: number;
    rules: number;
  };
};

type FormData = {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
};

const emptyForm: FormData = {
  name: "",
  code: "",
  description: "",
  isActive: true,
};

function WorkflowsContent() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingWorkflow, setEditingWorkflow] =
    useState<Workflow | null>(null);

  const [form, setForm] =
    useState<FormData>(emptyForm);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/workflows", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to load workflows"
        );
      }

      setWorkflows(result.data);
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Gagal mengambil workflows."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const openCreate = () => {
    setEditingWorkflow(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow);

    setForm({
      name: workflow.name,
      code: workflow.code,
      description: workflow.description ?? "",
      isActive: workflow.isActive,
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingWorkflow(null);
    setForm(emptyForm);
    setError("");
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Workflow name wajib diisi.");
      return;
    }

    if (!form.code.trim()) {
      setError("Workflow code wajib diisi.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const url = editingWorkflow
        ? `/api/workflows/${editingWorkflow.id}`
        : "/api/workflows";

      const method = editingWorkflow
        ? "PATCH"
        : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim(),
          description:
            form.description.trim() || null,
          isActive: form.isActive,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to save workflow"
        );
      }

      closeForm();
      await loadWorkflows();
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan workflow."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (
    workflow: Workflow
  ) => {
    try {
      setError("");

      const response = await fetch(
        `/api/workflows/${workflow.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !workflow.isActive,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to update workflow"
        );
      }

      await loadWorkflows();
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Gagal mengubah status workflow."
      );
    }
  };

  const handleDelete = async (
    workflow: Workflow
  ) => {
    const confirmed = window.confirm(
      `Hapus workflow "${workflow.name}"?\n\nWorkflow dan konfigurasi terkait mungkin tidak dapat digunakan lagi.`
    );

    if (!confirmed) return;

    try {
      setError("");

      const response = await fetch(
        `/api/workflows/${workflow.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to delete workflow"
        );
      }

      await loadWorkflows();
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Gagal menghapus workflow."
      );
    }
  };

  const filteredWorkflows = workflows.filter(
    (workflow) => {
      const keyword = search
        .toLowerCase()
        .trim();

      return (
        workflow.name
          .toLowerCase()
          .includes(keyword) ||
        workflow.code
          .toLowerCase()
          .includes(keyword) ||
        (workflow.description ?? "")
          .toLowerCase()
          .includes(keyword)
      );
    }
  );

  const activeCount = workflows.filter(
    (workflow) => workflow.isActive
  ).length;

  const inactiveCount =
    workflows.length - activeCount;

  const totalSteps = workflows.reduce(
    (total, workflow) =>
      total + workflow._count.steps,
    0
  );

  const totalRules = workflows.reduce(
    (total, workflow) =>
      total + workflow._count.rules,
    0
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex min-h-20 flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <GitBranch size={19} />
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">
                  Automation
                </p>

                <h1 className="text-xl font-bold text-slate-800">
                  Workflows
                </h1>
              </div>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Define how operational processes move
              from one transaction step to another.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* REFRESH */}
            <button
              type="button"
              onClick={loadWorkflows}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />

              <span className="hidden sm:inline">
                Refresh
              </span>
            </button>

            {/* CREATE */}
            <PermissionGate permission="workflow.manage">
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700"
              >
                <Plus size={17} />
                Create Workflow
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

          {/* INTRO */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <div className="flex items-start gap-4 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/50 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <GitBranch size={21} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Workflow Automation
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  Define how operational processes move
                  from one transaction step to another.
                  Each workflow can contain transaction
                  steps and business rules.
                </p>
              </div>
            </div>
          </div>

          {/* SUMMARY */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* TOTAL */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <WorkflowIcon size={20} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Total Workflows
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {workflows.length}
                  </p>
                </div>
              </div>
            </div>

            {/* ACTIVE */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <GitBranch size={20} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Active Workflows
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {activeCount}
                  </p>
                </div>
              </div>
            </div>

            {/* STEPS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Settings2 size={20} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Total Steps
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {totalSteps}
                  </p>
                </div>
              </div>
            </div>

            {/* RULES */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <GitBranch size={20} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Total Rules
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {totalRules}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SEARCH */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">
                Workflow List
              </p>

              <p className="mt-0.5 text-xs text-slate-400">
                {filteredWorkflows.length} workflow
                ditemukan
              </p>
            </div>

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
                placeholder="Search workflow..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50"
              />
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-indigo-50 bg-gradient-to-r from-indigo-50/60 to-violet-50/40">
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Workflow
                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Code
                    </th>

                    <th className="px-5 py-3.5 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Steps
                    </th>

                    <th className="px-5 py-3.5 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Rules
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
                        colSpan={6}
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
                            Loading workflows...
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Sedang mengambil data
                            workflow.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredWorkflows.length ===
                    0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-16"
                      >
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-400">
                            <WorkflowIcon size={23} />
                          </div>

                          <p className="mt-4 text-sm font-bold text-slate-800">
                            No workflows found
                          </p>

                          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                            Belum ada workflow yang sesuai
                            dengan pencarian kamu.
                          </p>

                          {!search && (
                            <PermissionGate permission="workflow.manage">
                              <button
                                type="button"
                                onClick={openCreate}
                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                              >
                                <Plus size={16} />
                                Create Workflow
                              </button>
                            </PermissionGate>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredWorkflows.map(
                      (workflow) => (
                        <tr
                          key={workflow.id}
                          className="transition hover:bg-slate-50/80"
                        >
                          {/* WORKFLOW */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                                <WorkflowIcon
                                  size={17}
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {workflow.name}
                                </p>

                                {workflow.description && (
                                  <p className="mt-0.5 max-w-md truncate text-xs text-slate-400">
                                    {
                                      workflow.description
                                    }
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* CODE */}
                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-600">
                              {workflow.code}
                            </span>
                          </td>

                          {/* STEPS */}
                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">
                              {workflow._count.steps}
                            </span>
                          </td>

                          {/* RULES */}
                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">
                              {workflow._count.rules}
                            </span>
                          </td>

                          {/* STATUS */}
                          <td className="px-5 py-4">
                            <PermissionGate
                              permission="workflow.manage"
                              fallback={
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                    workflow.isActive
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      workflow.isActive
                                        ? "bg-emerald-500"
                                        : "bg-slate-400"
                                    }`}
                                  />

                                  {workflow.isActive
                                    ? "Active"
                                    : "Inactive"}
                                </span>
                              }
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  toggleStatus(
                                    workflow
                                  )
                                }
                                title="Toggle workflow status"
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                  workflow.isActive
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    workflow.isActive
                                      ? "bg-emerald-500"
                                      : "bg-slate-400"
                                  }`}
                                />

                                {workflow.isActive
                                  ? "Active"
                                  : "Inactive"}
                              </button>
                            </PermissionGate>
                          </td>

                          {/* ACTIONS */}
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              {/* CONFIGURE */}
                              <Link
                                href={`/automation/workflows/${workflow.id}`}
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                                title="Configure Workflow"
                              >
                                <Settings2
                                  size={16}
                                />
                              </Link>

                              {/* EDIT */}
                              <PermissionGate permission="workflow.manage">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEdit(
                                      workflow
                                    )
                                  }
                                  className="rounded-xl p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                                  title="Edit Workflow"
                                >
                                  <Edit3 size={16} />
                                </button>
                              </PermissionGate>

                              {/* DELETE */}
                              <PermissionGate permission="workflow.manage">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDelete(
                                      workflow
                                    )
                                  }
                                  className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                  title="Delete Workflow"
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
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* CREATE / EDIT MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-900/20">
            {/* MODAL HEADER */}
            <div className="flex items-start justify-between border-b border-indigo-50 px-6 py-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <WorkflowIcon
                      size={17}
                    />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      {editingWorkflow
                        ? "Edit Workflow"
                        : "Create Workflow"}
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {editingWorkflow
                        ? "Update workflow information."
                        : "Configure the basic workflow information."}
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
                  Unable to save workflow
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
              {/* NAME */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-600">
                  Workflow Name
                </label>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="Production Workflow"
                  disabled={saving}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 disabled:bg-slate-50"
                />
              </div>

              {/* CODE */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-600">
                  Workflow Code
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
                  placeholder="PRODUCTION_WORKFLOW"
                  disabled={saving}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 disabled:bg-slate-50"
                />

                <p className="mt-1.5 text-[11px] text-slate-400">
                  Use uppercase letters and underscores
                  for the workflow code.
                </p>
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-600">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description:
                        event.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Describe this workflow..."
                  disabled={saving}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 disabled:bg-slate-50"
                />
              </div>

              {/* ACTIVE */}
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
                    Active workflow
                  </p>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Workflow dapat digunakan dalam
                    proses automation.
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
                  className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : editingWorkflow
                      ? "Save Changes"
                      : "Save Workflow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  return (
    <PermissionGate permission="workflow.view">
      <WorkflowsContent />
    </PermissionGate>
  );
}