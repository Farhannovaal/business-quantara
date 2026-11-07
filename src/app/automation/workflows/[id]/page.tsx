
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit3,
  Plus,
  Save,
  Trash2,
  Workflow as WorkflowIcon,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Circle,
} from "lucide-react";
import PermissionGate from "@/components/auth/permission-gate";

type Workflow = {
  id: number;
  companyId: number;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
};

type TransactionType = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sequence: number;
  isActive: boolean;
};

type WorkflowStep = {
  id: number;
  workflowId: number;
  transactionTypeId: number;
  sequence: number;
  isRequired: boolean;
  isActive: boolean;
  transactionType: TransactionType;
};

type StepForm = {
  transactionTypeId: string;
  sequence: string;
  isRequired: boolean;
  isActive: boolean;
};

type ApiResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const emptyStepForm: StepForm = {
  transactionTypeId: "",
  sequence: "1",
  isRequired: true,
  isActive: true,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getApiUrl(path: string, companyId: string | null) {
  if (!companyId) return path;

  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const workflowId = Number(params.id);
  const initialCompanyId = searchParams.get("companyId");

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<
    TransactionType[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showStepForm, setShowStepForm] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [stepForm, setStepForm] = useState<StepForm>(emptyStepForm);

  const [companyId, setCompanyId] = useState<string | null>(
    initialCompanyId,
  );
  const [companyReady, setCompanyReady] = useState(false);

  const requestIdRef = useRef(0);

  const workflowListUrl = companyId
    ? `/automation/workflows?companyId=${encodeURIComponent(companyId)}`
    : "/automation/workflows";

  // Sinkronisasi companyId dari query URL.
  useEffect(() => {
    setCompanyId(initialCompanyId);
    setCompanyReady(true);
  }, [initialCompanyId]);

  // Load workflow, steps, dan transaction types.
  // companyId diteruskan sebagai parameter agar callback tetap stabil.
  const loadData = useCallback(
    async (selectedCompanyId: string | null) => {
      const requestId = ++requestIdRef.current;

      try {
        setLoading(true);
        setError("");

        if (!Number.isSafeInteger(workflowId) || workflowId < 1) {
          throw new Error("Workflow ID tidak valid.");
        }

        const workflowUrl = getApiUrl(
          `/api/workflows/${workflowId}`,
          selectedCompanyId,
        );

        const workflowResponse = await fetch(workflowUrl, {
          cache: "no-store",
        });

        const workflowResult =
          (await workflowResponse.json()) as ApiResult<Workflow>;

        if (requestId !== requestIdRef.current) return;

        if (!workflowResponse.ok || !workflowResult.success || !workflowResult.data) {
          throw new Error(
            workflowResult.error || "Failed to load workflow.",
          );
        }

        const workflowData = workflowResult.data;
        const effectiveCompanyId =
          selectedCompanyId || String(workflowData.companyId);

        if (
          !effectiveCompanyId ||
          effectiveCompanyId === "undefined"
        ) {
          throw new Error("Company ID workflow tidak ditemukan.");
        }

        const params = new URLSearchParams({
          companyId: effectiveCompanyId,
        });

        const [stepsResponse, transactionTypesResponse] =
          await Promise.all([
            fetch(
              `/api/workflows/${workflowId}/steps?${params.toString()}`,
              { cache: "no-store" },
            ),
            fetch(
              `/api/transaction-types?${params.toString()}`,
              { cache: "no-store" },
            ),
          ]);

        const [stepsResult, transactionTypesResult] = await Promise.all([
          stepsResponse.json() as Promise<ApiResult<WorkflowStep[]>>,
          transactionTypesResponse.json() as Promise<
            ApiResult<TransactionType[]>
          >,
        ]);

        if (requestId !== requestIdRef.current) return;

        if (!stepsResponse.ok || !stepsResult.success) {
          throw new Error(
            stepsResult.error || "Failed to load workflow steps.",
          );
        }

        if (
          !transactionTypesResponse.ok ||
          !transactionTypesResult.success
        ) {
          throw new Error(
            transactionTypesResult.error ||
              "Failed to load transaction types.",
          );
        }

        setWorkflow(workflowData);
        setSteps(
          Array.isArray(stepsResult.data) ? stepsResult.data : [],
        );
        setTransactionTypes(
          (Array.isArray(transactionTypesResult.data)
            ? transactionTypesResult.data
            : []
          ).filter((item) => item.isActive),
        );

        // Simpan companyId terverifikasi untuk request berikutnya.
        setCompanyId((current) => current || effectiveCompanyId);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;

        console.error("loadData:", err);

        setWorkflow(null);
        setSteps([]);
        setTransactionTypes([]);
        setError(
          getErrorMessage(err, "Gagal mengambil data workflow."),
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [workflowId],
  );

  useEffect(() => {
    if (!companyReady) return;

    void loadData(initialCompanyId);

    return () => {
      requestIdRef.current += 1;
    };
  }, [companyReady, initialCompanyId, loadData]);

  const refreshData = () => {
    void loadData(companyId);
  };

  const openCreateStep = () => {
    setEditingStep(null);

    const nextSequence =
      steps.length > 0
        ? Math.max(...steps.map((step) => step.sequence)) + 1
        : 1;

    setStepForm({
      ...emptyStepForm,
      sequence: String(nextSequence),
    });

    setError("");
    setShowStepForm(true);
  };

  const openEditStep = (step: WorkflowStep) => {
    setEditingStep(step);

    setStepForm({
      transactionTypeId: String(step.transactionTypeId),
      sequence: String(step.sequence),
      isRequired: step.isRequired,
      isActive: step.isActive,
    });

    setError("");
    setShowStepForm(true);
  };

  const closeStepForm = () => {
    if (saving) return;

    setShowStepForm(false);
    setEditingStep(null);
    setStepForm(emptyStepForm);
    setError("");
  };

  const handleStepSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!workflow) return;

    const transactionTypeId = Number(stepForm.transactionTypeId);
    const sequence = Number(stepForm.sequence);

    if (
      !Number.isInteger(transactionTypeId) ||
      transactionTypeId < 1
    ) {
      setError("Transaction type wajib dipilih.");
      return;
    }

    if (!Number.isInteger(sequence) || sequence < 1) {
      setError("Sequence harus berupa angka minimal 1.");
      return;
    }

    // Pastikan TransactionType tersedia dalam daftar perusahaan ini.
    const selectedType = transactionTypes.find(
      (item) => item.id === transactionTypeId,
    );

    if (!selectedType) {
      setError("Transaction type tidak valid untuk perusahaan ini.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const path = editingStep
        ? `/api/workflows/${workflowId}/steps/${editingStep.id}`
        : `/api/workflows/${workflowId}/steps`;

      const response = await fetch(getApiUrl(path, companyId), {
        method: editingStep ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionTypeId,
          sequence,
          isRequired: stepForm.isRequired,
          isActive: stepForm.isActive,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to save workflow step.",
        );
      }

      setShowStepForm(false);
      setEditingStep(null);
      setStepForm(emptyStepForm);

      await loadData(companyId);
    } catch (err) {
      console.error("handleStepSubmit:", err);
      setError(
        getErrorMessage(err, "Gagal menyimpan workflow step."),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStep = async (step: WorkflowStep) => {
    const confirmed = window.confirm(
      `Hapus step "${step.transactionType.name}"?`,
    );

    if (!confirmed) return;

    try {
      setError("");

      const response = await fetch(
        getApiUrl(
          `/api/workflows/${workflowId}/steps/${step.id}`,
          companyId,
        ),
        { method: "DELETE" },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to delete workflow step.",
        );
      }

      await loadData(companyId);
    } catch (err) {
      console.error("handleDeleteStep:", err);
      setError(
        getErrorMessage(err, "Gagal menghapus workflow step."),
      );
    }
  };

  const toggleStepStatus = async (step: WorkflowStep) => {
    try {
      setError("");

      const response = await fetch(
        getApiUrl(
          `/api/workflows/${workflowId}/steps/${step.id}`,
          companyId,
        ),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !step.isActive,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to update workflow step.",
        );
      }

      await loadData(companyId);
    } catch (err) {
      console.error("toggleStepStatus:", err);
      setError(
        getErrorMessage(err, "Gagal mengubah status workflow step."),
      );
    }
  };

  const sortedSteps = useMemo(
    () => [...steps].sort((a, b) => a.sequence - b.sequence),
    [steps],
  );

  const usedTransactionTypeIds = useMemo(
    () => new Set(
      steps
        .filter((step) => step.id !== editingStep?.id)
        .map((step) => step.transactionTypeId),
    ),
    [steps, editingStep],
  );

  if (!companyReady || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Loading workflow...
          </p>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="min-h-screen bg-background px-6 py-10 text-foreground">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle size={22} />
          </div>

          <h1 className="mt-5 text-lg font-bold">
            Workflow tidak ditemukan
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {error ||
              "Workflow tidak ditemukan atau tidak dapat diakses."}
          </p>

          <Link
            href={workflowListUrl}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            <ArrowLeft size={16} />
            Kembali ke Workflows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="flex min-h-16 flex-col justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href={workflowListUrl}
              className="shrink-0 rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                Automation / Workflows
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-bold">
                  {workflow.name}
                </h1>

                <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                  {workflow.code}
                </span>

                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    workflow.isActive
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {workflow.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <Link
              href={workflowListUrl}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Workflow List
            </Link>
          </div>
        </div>
      </header>

      <main className="p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {error && (
            <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
              <div className="flex items-start gap-2">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                className="rounded-lg p-1 transition hover:bg-rose-100 dark:hover:bg-rose-900/30"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <WorkflowIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h2 className="text-sm font-bold">
                  Workflow Information
                </h2>

                <p className="mt-1 text-xs text-muted-foreground">
                  {workflow.description ||
                    "No description provided for this workflow."}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    Workflow ID: {workflow.id}
                  </span>
                  <span className="rounded-lg border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    Company ID: {workflow.companyId}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-bold">
                  Workflow Steps
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Define the transaction sequence for this workflow.
                </p>
              </div>

              <PermissionGate permission="workflow.manage">
                <button
                  type="button"
                  onClick={openCreateStep}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  <Plus size={16} />
                  Add Step
                </button>
              </PermissionGate>
            </div>

            <div className="p-6">
              {sortedSteps.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
                  <WorkflowIcon className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
                  <p className="text-sm font-semibold">
                    No workflow steps
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add the first transaction step to this workflow.
                  </p>
                  <PermissionGate permission="workflow.manage">
                    <button
                      type="button"
                      onClick={openCreateStep}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
                    >
                      <Plus size={15} />
                      Add First Step
                    </button>
                  </PermissionGate>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex flex-col gap-4 rounded-xl border border-border p-4 transition hover:bg-muted/40 sm:flex-row sm:items-center"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                        {step.sequence}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {step.transactionType.name}
                          </p>

                          <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {step.transactionType.code}
                          </span>
                        </div>

                        {step.transactionType.description && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {step.transactionType.description}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              step.isRequired
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {step.isRequired ? "Required" : "Optional"}
                          </span>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              step.isActive
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {step.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>

                      <PermissionGate permission="workflow.manage">
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void toggleStepStatus(step)}
                            title={
                              step.isActive
                                ? "Deactivate step"
                                : "Activate step"
                            }
                            className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            {step.isActive ? (
                              <CheckCircle2 size={17} />
                            ) : (
                              <Circle size={17} />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditStep(step)}
                            className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            title="Edit"
                          >
                            <Edit3 size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteStep(step)}
                            className="rounded-xl p-2 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </PermissionGate>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border bg-muted/30 px-6 py-3">
              <p className="text-xs text-muted-foreground">
                {sortedSteps.length} step(s) configured
              </p>
            </div>
          </section>
        </div>
      </main>

      {showStepForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <h2 className="text-base font-bold">
                  {editingStep ? "Edit Workflow Step" : "Add Workflow Step"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Configure the transaction step.
                </p>
              </div>

              <button
                type="button"
                onClick={closeStepForm}
                disabled={saving}
                className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted"
              >
                <X size={17} />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
                {error}
              </div>
            )}

            <form
              onSubmit={handleStepSubmit}
              className="space-y-5 p-6"
            >
              <div>
                <label className="mb-2 block text-xs font-semibold text-muted-foreground">
                  Transaction Type
                </label>

                <select
                  value={stepForm.transactionTypeId}
                  onChange={(event) =>
                    setStepForm({
                      ...stepForm,
                      transactionTypeId: event.target.value,
                    })
                  }
                  disabled={saving}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50"
                >
                  <option value="">
                    Select transaction type
                  </option>

                  {transactionTypes.map((type) => {
                    const alreadyUsed =
                      usedTransactionTypeIds.has(type.id);

                    return (
                      <option
                        key={type.id}
                        value={type.id}
                        disabled={alreadyUsed}
                      >
                        {type.sequence}. {type.name}
                        {alreadyUsed ? " — Already added" : ""}
                      </option>
                    );
                  })}
                </select>

                {transactionTypes.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Belum ada Transaction Type aktif untuk perusahaan ini.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-muted-foreground">
                  Sequence
                </label>

                <input
                  type="number"
                  min={1}
                  value={stepForm.sequence}
                  onChange={(event) =>
                    setStepForm({
                      ...stepForm,
                      sequence: event.target.value,
                    })
                  }
                  disabled={saving}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={stepForm.isRequired}
                    onChange={(event) =>
                      setStepForm({
                        ...stepForm,
                        isRequired: event.target.checked,
                      })
                    }
                    disabled={saving}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">
                    Required step
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={stepForm.isActive}
                    onChange={(event) =>
                      setStepForm({
                        ...stepForm,
                        isActive: event.target.checked,
                      })
                    }
                    disabled={saving}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">
                    Active step
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-5">
                <button
                  type="button"
                  onClick={closeStepForm}
                  disabled={saving}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || transactionTypes.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}

                  {saving
                    ? "Saving..."
                    : editingStep
                      ? "Save Changes"
                      : "Add Step"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
