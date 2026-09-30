"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  Edit3,
  Plus,
  Save,
  Trash2,
  Workflow as WorkflowIcon,
  X,
} from "lucide-react";
import Link from "next/link";

type Workflow = {
  id: number;
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

const emptyStepForm: StepForm = {
  transactionTypeId: "",
  sequence: "1",
  isRequired: true,
  isActive: true,
};

export default function WorkflowDetailPage() {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<
    TransactionType[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showStepForm, setShowStepForm] = useState(false);
  const [editingStep, setEditingStep] =
    useState<WorkflowStep | null>(null);

  const [stepForm, setStepForm] =
    useState<StepForm>(emptyStepForm);

  const workflowId = Number(
    typeof window !== "undefined"
      ? window.location.pathname.split("/").pop()
      : 0
  );

  const loadData = async () => {
    try {
      setLoading(true);

      const [
        workflowResponse,
        stepsResponse,
        transactionTypesResponse,
      ] = await Promise.all([
        fetch(`/api/workflows/${workflowId}`),
        fetch(`/api/workflows/${workflowId}/steps`),
        fetch("/api/transaction-types"),
      ]);

      const workflowResult = await workflowResponse.json();
      const stepsResult = await stepsResponse.json();
      const transactionTypesResult =
        await transactionTypesResponse.json();

      if (!workflowResponse.ok || !workflowResult.success) {
        throw new Error(
          workflowResult.error || "Failed to load workflow"
        );
      }

      if (!stepsResponse.ok || !stepsResult.success) {
        throw new Error(
          stepsResult.error || "Failed to load workflow steps"
        );
      }

      if (
        !transactionTypesResponse.ok ||
        !transactionTypesResult.success
      ) {
        throw new Error(
          transactionTypesResult.error ||
            "Failed to load transaction types"
        );
      }

      setWorkflow(workflowResult.data);
      setSteps(stepsResult.data);
      setTransactionTypes(
        transactionTypesResult.data.filter(
          (item: TransactionType) => item.isActive
        )
      );
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data workflow."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isInteger(workflowId)) return;

    loadData();
  }, [workflowId]);

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

    setShowStepForm(true);
  };

  const closeStepForm = () => {
    if (saving) return;

    setShowStepForm(false);
    setEditingStep(null);
    setStepForm(emptyStepForm);
  };

  const handleStepSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const transactionTypeId = Number(
      stepForm.transactionTypeId
    );

    const sequence = Number(stepForm.sequence);

    if (!Number.isInteger(transactionTypeId)) {
      alert("Transaction type wajib dipilih.");
      return;
    }

    if (!Number.isInteger(sequence) || sequence < 1) {
      alert("Sequence harus berupa angka minimal 1.");
      return;
    }

    try {
      setSaving(true);

      const url = editingStep
        ? `/api/workflows/${workflowId}/steps/${editingStep.id}`
        : `/api/workflows/${workflowId}/steps`;

      const method = editingStep ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
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
          result.error || "Failed to save workflow step"
        );
      }

      closeStepForm();
      await loadData();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan workflow step."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStep = async (step: WorkflowStep) => {
    const confirmed = window.confirm(
      `Hapus step "${step.transactionType.name}"?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/workflows/${workflowId}/steps/${step.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to delete workflow step"
        );
      }

      await loadData();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menghapus workflow step."
      );
    }
  };

  const toggleStepStatus = async (step: WorkflowStep) => {
    try {
      const response = await fetch(
        `/api/workflows/${workflowId}/steps/${step.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !step.isActive,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to update workflow step"
        );
      }

      await loadData();
    } catch (error) {
      console.error(error);

      alert("Gagal mengubah status workflow step.");
    }
  };

  const sortedSteps = [...steps].sort(
    (a, b) => a.sequence - b.sequence
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="p-8 text-sm text-slate-400">
          Loading workflow...
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="p-8">
          <p className="text-sm text-slate-500">
            Workflow tidak ditemukan.
          </p>

          <Link
            href="/automation/workflows"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Workflows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex min-h-16 items-center justify-between gap-4 px-8 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/automation/workflows"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <p className="text-xs text-slate-400">
                Automation / Workflows
              </p>

              <div className="mt-0.5 flex items-center gap-3">
                <h1 className="text-lg font-semibold text-slate-900">
                  {workflow.name}
                </h1>

                <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">
                  {workflow.code}
                </span>

                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    workflow.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {workflow.isActive
                    ? "Active"
                    : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/automation/workflows"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Workflow List
          </Link>
        </div>
      </header>

      <main className="p-8">
        {/* WORKFLOW INFORMATION */}
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <WorkflowIcon className="h-5 w-5 text-slate-700" />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">
                Workflow Information
              </h2>

              {workflow.description && (
                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                  {workflow.description}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* STEPS */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Workflow Steps
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Define the transaction sequence for this
                workflow.
              </p>
            </div>

            <button
              onClick={openCreateStep}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add Step
            </button>
          </div>

          <div className="p-6">
            {sortedSteps.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-6 py-12 text-center">
                <WorkflowIcon className="mx-auto mb-3 h-8 w-8 text-slate-300" />

                <p className="text-sm font-medium text-slate-700">
                  No workflow steps
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Add the first transaction step to this
                  workflow.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedSteps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 hover:bg-slate-50"
                  >
                    {/* SEQUENCE */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
                      {step.sequence}
                    </div>

                    {/* INFO */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {step.transactionType.name}
                        </p>

                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500">
                          {step.transactionType.code}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            step.isRequired
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {step.isRequired
                            ? "Required"
                            : "Optional"}
                        </span>

                        <button
                          onClick={() =>
                            toggleStepStatus(step)
                          }
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            step.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {step.isActive
                            ? "Active"
                            : "Inactive"}
                        </button>
                      </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() =>
                          openEditStep(step)
                        }
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() =>
                          handleDeleteStep(step)
                        }
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* STEP FORM MODAL */}
      {showStepForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingStep
                    ? "Edit Workflow Step"
                    : "Add Workflow Step"}
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Configure the transaction step.
                </p>
              </div>

              <button
                onClick={closeStepForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleStepSubmit}
              className="space-y-5 p-6"
            >
              {/* TRANSACTION TYPE */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">
                  Transaction Type
                </label>

                <select
                  value={stepForm.transactionTypeId}
                  onChange={(event) =>
                    setStepForm({
                      ...stepForm,
                      transactionTypeId:
                        event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">
                    Select transaction type
                  </option>

                  {transactionTypes.map((type) => {
                    const alreadyUsed = steps.some(
                      (step) =>
                        step.transactionTypeId ===
                          type.id &&
                        step.id !== editingStep?.id
                    );

                    return (
                      <option
                        key={type.id}
                        value={type.id}
                        disabled={alreadyUsed}
                      >
                        {type.sequence}. {type.name}
                        {alreadyUsed
                          ? " — Already added"
                          : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* SEQUENCE */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">
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
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              {/* OPTIONS */}
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={stepForm.isRequired}
                    onChange={(event) =>
                      setStepForm({
                        ...stepForm,
                        isRequired:
                          event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />

                  <span className="text-sm text-slate-700">
                    Required step
                  </span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={stepForm.isActive}
                    onChange={(event) =>
                      setStepForm({
                        ...stepForm,
                        isActive:
                          event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />

                  <span className="text-sm text-slate-700">
                    Active step
                  </span>
                </label>
              </div>

              {/* ACTIONS */}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeStepForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
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
