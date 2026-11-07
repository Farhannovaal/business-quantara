
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

type Company = {
  id: number;
  name: string;
  code: string;
  status?: string;
};

type Workflow = {
  id: number;
  companyId: number;
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

type WorkflowApiResponse = {
  success: boolean;
  error?: string;
  isSuperAdmin?: boolean;
  companies?: Company[];
  selectedCompanyId?: number;
  data?: Workflow[];
};

const emptyForm: FormData = {
  name: "",
  code: "",
  description: "",
  isActive: true,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function WorkflowsContent() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWorkflow, setEditingWorkflow] =
    useState<Workflow | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Mencegah response request lama menimpa state terbaru.
  const requestIdRef = useRef(0);

  // Membuat query berdasarkan company yang dipilih.
  const buildQuery = useCallback(
    (companyId = selectedCompanyId) => {
      const params = new URLSearchParams();

      if (companyId) {
        params.set("companyId", companyId);
      }

      const query = params.toString();

      return query ? `?${query}` : "";
    },
    [selectedCompanyId],
  );

  // Memuat daftar Workflow dan informasi perusahaan.
  const loadWorkflows = useCallback(
    async (companyId = selectedCompanyId) => {
      const requestId = ++requestIdRef.current;

      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/workflows${buildQuery(companyId)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as WorkflowApiResponse;

        // Abaikan response dari request yang sudah tidak relevan.
        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Gagal mengambil workflows.",
          );
        }

        const superAdmin = result.isSuperAdmin === true;

        setIsSuperAdmin(superAdmin);
        setCompanies(
          Array.isArray(result.companies)
            ? result.companies
            : [],
        );

        if (superAdmin && !companyId) {
          setWorkflows([]);
          return;
        }

        setWorkflows(
          Array.isArray(result.data) ? result.data : [],
        );
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.error("loadWorkflows:", err);
        setWorkflows([]);
        setError(
          getErrorMessage(
            err,
            "Gagal mengambil workflows.",
          ),
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [buildQuery, selectedCompanyId],
  );

  // Initial load hanya saat halaman dibuka.
  useEffect(() => {
    void loadWorkflows("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memilih perusahaan.
  const handleCompanyChange = (
    companyId: string,
  ) => {
    setSelectedCompanyId(companyId);
    setWorkflows([]);
    setSearch("");
    setError("");

    if (!companyId) {
      requestIdRef.current += 1;
      setLoading(false);
      return;
    }

    void loadWorkflows(companyId);
  };

  const openCreate = () => {
    if (isSuperAdmin && !selectedCompanyId) {
      setError("Pilih perusahaan terlebih dahulu.");
      return;
    }

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
    event: FormEvent<HTMLFormElement>,
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

    if (isSuperAdmin && !selectedCompanyId) {
      setError("Silakan pilih perusahaan terlebih dahulu.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const url = editingWorkflow
        ? `/api/workflows/${editingWorkflow.id}${buildQuery()}`
        : "/api/workflows";

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim() || null,
        isActive: form.isActive,
      };

      if (!editingWorkflow && isSuperAdmin) {
        payload.companyId = Number(selectedCompanyId);
      }

      const response = await fetch(url, {
        method: editingWorkflow ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Gagal menyimpan workflow.",
        );
      }

      setShowForm(false);
      setEditingWorkflow(null);
      setForm(emptyForm);

      await loadWorkflows();
    } catch (err) {
      console.error("handleSubmit:", err);

      setError(
        getErrorMessage(
          err,
          "Gagal menyimpan workflow.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (workflow: Workflow) => {
    try {
      setError("");

      const response = await fetch(
        `/api/workflows/${workflow.id}${buildQuery()}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !workflow.isActive,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Gagal mengubah status workflow.",
        );
      }

      await loadWorkflows();
    } catch (err) {
      console.error("toggleStatus:", err);

      setError(
        getErrorMessage(
          err,
          "Gagal mengubah status workflow.",
        ),
      );
    }
  };

  const handleDelete = async (workflow: Workflow) => {
    const confirmed = window.confirm(
      `Hapus workflow "${workflow.name}"?\n\nWorkflow dan konfigurasi terkait mungkin tidak dapat digunakan lagi.`,
    );

    if (!confirmed) return;

    try {
      setError("");

      const response = await fetch(
        `/api/workflows/${workflow.id}${buildQuery()}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Gagal menghapus workflow.",
        );
      }

      await loadWorkflows();
    } catch (err) {
      console.error("handleDelete:", err);

      setError(
        getErrorMessage(
          err,
          "Gagal menghapus workflow.",
        ),
      );
    }
  };

  const filteredWorkflows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return workflows;

    return workflows.filter((workflow) =>
      [
        workflow.name,
        workflow.code,
        workflow.description ?? "",
      ].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [workflows, search]);

  const activeCount = workflows.filter(
    (item) => item.isActive,
  ).length;

  const inactiveCount = workflows.length - activeCount;

  const totalSteps = workflows.reduce(
    (total, workflow) =>
      total + workflow._count.steps,
    0,
  );

  const totalRules = workflows.reduce(
    (total, workflow) =>
      total + workflow._count.rules,
    0,
  );

  const selectedCompany = companies.find(
    (company) =>
      String(company.id) === selectedCompanyId,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="flex min-h-20 flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                <GitBranch size={19} />
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-300">
                  Automation
                </p>

                <h1 className="text-xl font-bold text-foreground">
                  Workflows
                </h1>
              </div>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Define how operational processes move from one
              transaction step to another.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && (
              <select
                value={selectedCompanyId}
                onChange={(event) =>
                  handleCompanyChange(event.target.value)
                }
                className="h-10 min-w-56 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-rose-400"
              >
                <option value="">Pilih perusahaan</option>

                {companies.map((company) => (
                  <option
                    key={company.id}
                    value={company.id}
                  >
                    {company.name} ({company.code})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => void loadWorkflows()}
              disabled={
                loading ||
                (isSuperAdmin && !selectedCompanyId)
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">
                Refresh
              </span>
            </button>

            <PermissionGate permission="workflow.manage">
              <button
                type="button"
                onClick={openCreate}
                disabled={
                  isSuperAdmin && !selectedCompanyId
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:from-rose-700 hover:to-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={17} />
                Create Workflow
              </button>
            </PermissionGate>
          </div>
        </div>
      </header>

      <main className="p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {error && !showForm && (
            <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
              <div>
                <p className="font-semibold">
                  Terjadi kesalahan
                </p>
                <p className="mt-0.5">{error}</p>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                className="rounded-lg p-1"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {isSuperAdmin && !selectedCompanyId ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
              <WorkflowIcon className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
              <h2 className="text-sm font-semibold">
                Pilih perusahaan
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pilih perusahaan untuk melihat dan mengelola
                Workflow.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex items-start gap-4 bg-gradient-to-r from-rose-50/70 via-card to-rose-50/40 p-6 dark:from-rose-950/20 dark:to-rose-950/20">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                    <GitBranch size={21} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold">
                      Workflow Automation
                    </h2>

                    <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                      Define how operational processes move
                      from one transaction step to another.
                      Each workflow can contain transaction
                      steps and business rules.
                    </p>

                    {isSuperAdmin && selectedCompany && (
                      <p className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                        Perusahaan: {selectedCompany.name} (
                        {selectedCompany.code})
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Total Workflows",
                    value: workflows.length,
                    icon: <WorkflowIcon size={20} />,
                    color:
                      "text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-300",
                  },
                  {
                    label: "Active Workflows",
                    value: activeCount,
                    icon: <GitBranch size={20} />,
                    color:
                      "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300",
                  },
                  {
                    label: "Total Steps",
                    value: totalSteps,
                    icon: <Settings2 size={20} />,
                    color:
                      "text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300",
                  },
                  {
                    label: "Total Rules",
                    value: totalRules,
                    icon: <GitBranch size={20} />,
                    color:
                      "text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.color}`}
                      >
                        {item.icon}
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    Workflow List
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {filteredWorkflows.length} workflow
                    ditemukan
                  </p>
                  <p className="sr-only">
                    {inactiveCount} inactive workflows
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search workflow..."
                    className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-rose-400"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/70">
                        <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Workflow
                        </th>
                        <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Code
                        </th>
                        <th className="px-5 py-3.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Steps
                        </th>
                        <th className="px-5 py-3.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Rules
                        </th>
                        <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                        <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                      {loading ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-16 text-center"
                          >
                            <Loader2 className="mx-auto h-7 w-7 animate-spin text-rose-600" />
                            <p className="mt-3 text-sm font-semibold">
                              Loading workflows...
                            </p>
                          </td>
                        </tr>
                      ) : filteredWorkflows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-16 text-center"
                          >
                            <WorkflowIcon className="mx-auto h-9 w-9 text-muted-foreground" />
                            <p className="mt-4 text-sm font-bold">
                              No workflows found
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Belum ada workflow yang sesuai
                              dengan pencarian.
                            </p>

                            {!search && (
                              <PermissionGate permission="workflow.manage">
                                <button
                                  type="button"
                                  onClick={openCreate}
                                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                                >
                                  <Plus size={16} />
                                  Create Workflow
                                </button>
                              </PermissionGate>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredWorkflows.map((workflow) => (
                          <tr
                            key={workflow.id}
                            className="transition hover:bg-muted/50"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                                  <WorkflowIcon size={17} />
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">
                                    {workflow.name}
                                  </p>

                                  {workflow.description && (
                                    <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                                      {workflow.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span className="inline-flex rounded-lg border border-border bg-muted px-2.5 py-1 font-mono text-[11px] font-medium text-muted-foreground">
                                {workflow.code}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-center">
                              <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                                {workflow._count.steps}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-center">
                              <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                                {workflow._count.rules}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <PermissionGate
                                permission="workflow.manage"
                                fallback={
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                      workflow.isActive
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                        : "border-border bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {workflow.isActive
                                      ? "Active"
                                      : "Inactive"}
                                  </span>
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    void toggleStatus(workflow)
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                    workflow.isActive
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                      : "border-border bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {workflow.isActive
                                    ? "Active"
                                    : "Inactive"}
                                </button>
                              </PermissionGate>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-1">
                                <Link
                                  href={
                                    isSuperAdmin
                                      ? `/automation/workflows/${workflow.id}?companyId=${selectedCompanyId}`
                                      : `/automation/workflows/${workflow.id}`
                                  }
                                  className="rounded-xl p-2 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                                  title="Configure Workflow"
                                >
                                  <Settings2 size={16} />
                                </Link>

                                <PermissionGate permission="workflow.manage">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEdit(workflow)
                                    }
                                    className="rounded-xl p-2 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                                    title="Edit Workflow"
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                </PermissionGate>

                                <PermissionGate permission="workflow.manage">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDelete(workflow)
                                    }
                                    className="rounded-xl p-2 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600"
                                    title="Delete Workflow"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </PermissionGate>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  <WorkflowIcon size={17} />
                </div>

                <div>
                  <h2 className="text-base font-bold">
                    {editingWorkflow
                      ? "Edit Workflow"
                      : "Create Workflow"}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {editingWorkflow
                      ? "Update workflow information."
                      : "Configure the basic workflow information."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p className="font-semibold">
                  Unable to save workflow
                </p>
                <p className="mt-0.5 text-xs">{error}</p>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div>
                <label className="mb-2 block text-xs font-bold text-muted-foreground">
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
                  className="h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm outline-none focus:border-rose-400 disabled:bg-muted"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-muted-foreground">
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
                  className="h-11 w-full rounded-xl border border-border bg-card px-3.5 font-mono text-sm outline-none focus:border-rose-400 disabled:bg-muted"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Use uppercase letters and underscores for
                  the workflow code.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-muted-foreground">
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
                  placeholder="Describe this workflow..."
                  disabled={saving}
                  className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-3 text-sm outline-none focus:border-rose-400 disabled:bg-muted"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted px-4 py-3">
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
                  className="h-4 w-4 rounded"
                />

                <div>
                  <p className="text-sm font-semibold">
                    Active workflow
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Workflow dapat digunakan dalam proses
                    automation.
                  </p>
                </div>
              </label>

              <div className="flex justify-end gap-3 border-t border-border pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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
  return <WorkflowsContent />;
}
