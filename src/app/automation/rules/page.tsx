"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Edit3,
  Plus,
  Search,
  Trash2,
  X,
  GitBranch,
} from "lucide-react";

type Workflow = {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
};

type WorkflowRule = {
  id: number;
  workflowId: number;
  name: string;
  description: string | null;
  condition: string;
  action: string;
  priority: number;
  isActive: boolean;
  workflow: Workflow;
};

type FormData = {
  workflowId: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  priority: string;
  isActive: boolean;
};

const emptyForm: FormData = {
  workflowId: "",
  name: "",
  description: "",
  condition: "",
  action: "",
  priority: "0",
  isActive: true,
};

export default function BusinessRulesPage() {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] =
    useState<WorkflowRule | null>(null);

  const [form, setForm] =
    useState<FormData>(emptyForm);

  const [saving, setSaving] = useState(false);

  const loadWorkflows = async () => {
    const response = await fetch(
      "/api/workflows"
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.error ||
          "Failed to load workflows."
      );
    }

    setWorkflows(result.data);
  };

  const loadRules = async (
    workflowList?: Workflow[]
  ) => {
    const list =
      workflowList ?? workflows;

    if (list.length === 0) {
      setRules([]);
      return;
    }

    const responses = await Promise.all(
      list.map(async (workflow) => {
        const response = await fetch(
          `/api/workflows/${workflow.id}/rules`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error ||
              `Failed to load rules for ${workflow.name}.`
          );
        }

        return result.data.map(
          (rule: Omit<
            WorkflowRule,
            "workflow"
          >) => ({
            ...rule,
            workflow,
          })
        );
      })
    );

    setRules(
      responses.flat().sort(
        (a, b) =>
          a.priority - b.priority ||
          a.id - b.id
      )
    );
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/workflows"
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to load workflows."
        );
      }

      const workflowList =
        result.data as Workflow[];

      setWorkflows(workflowList);

      await loadRules(workflowList);
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengambil business rules."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingRule(null);

    setForm({
      ...emptyForm,
      workflowId:
        workflows.length > 0
          ? String(workflows[0].id)
          : "",
    });

    setShowForm(true);
  };

  const openEdit = (rule: WorkflowRule) => {
    setEditingRule(rule);

    setForm({
      workflowId: String(
        rule.workflowId
      ),
      name: rule.name,
      description:
        rule.description ?? "",
      condition: rule.condition,
      action: rule.action,
      priority: String(rule.priority),
      isActive: rule.isActive,
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingRule(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!form.workflowId) {
      alert("Workflow wajib dipilih.");
      return;
    }

    if (!form.name.trim()) {
      alert("Rule name wajib diisi.");
      return;
    }

    if (!form.condition.trim()) {
      alert("Condition wajib diisi.");
      return;
    }

    if (!form.action.trim()) {
      alert("Action wajib diisi.");
      return;
    }

    try {
      setSaving(true);

      const workflowId =
        Number(form.workflowId);

      const url = editingRule
        ? `/api/workflows/${editingRule.workflowId}/rules/${editingRule.id}`
        : `/api/workflows/${workflowId}/rules`;

      const method = editingRule
        ? "PATCH"
        : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          description:
            form.description.trim() || null,
          condition:
            form.condition.trim(),
          action:
            form.action.trim(),
          priority:
            Number(form.priority) || 0,
          isActive: form.isActive,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to save rule."
        );
      }

      closeForm();
      await loadData();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan business rule."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (
    rule: WorkflowRule
  ) => {
    try {
      const response = await fetch(
        `/api/workflows/${rule.workflowId}/rules/${rule.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            isActive: !rule.isActive,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to update rule."
        );
      }

      await loadData();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengubah status rule."
      );
    }
  };

  const handleDelete = async (
    rule: WorkflowRule
  ) => {
    const confirmed =
      window.confirm(
        `Hapus business rule "${rule.name}"?`
      );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/workflows/${rule.workflowId}/rules/${rule.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to delete rule."
        );
      }

      await loadData();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menghapus rule."
      );
    }
  };

  const filteredRules =
    rules.filter((rule) => {
      const keyword =
        search.toLowerCase();

      return (
        rule.name
          .toLowerCase()
          .includes(keyword) ||
        rule.workflow.name
          .toLowerCase()
          .includes(keyword) ||
        rule.workflow.code
          .toLowerCase()
          .includes(keyword) ||
        rule.condition
          .toLowerCase()
          .includes(keyword) ||
        rule.action
          .toLowerCase()
          .includes(keyword)
      );
    });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-8">
          <div>
            <p className="text-xs text-slate-400">
              Automation
            </p>

            <h1 className="text-lg font-semibold text-slate-900">
              Business Rules
            </h1>
          </div>

          <button
            onClick={openCreate}
            disabled={workflows.length === 0}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Create Rule
          </button>
        </div>
      </header>

      <main className="p-8">
        {/* INTRO */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <GitBranch className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Business Rules
              </h2>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                Define conditions and actions that
                control how each workflow behaves.
              </p>
            </div>
          </div>
        </div>

        {/* SEARCH */}
        <div className="mb-4 flex justify-end">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search rules..."
              className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                    Rule
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                    Workflow
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                    Condition
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                    Action
                  </th>

                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500">
                    Priority
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
                      colSpan={7}
                      className="px-6 py-12 text-center text-sm text-slate-400"
                    >
                      Loading business rules...
                    </td>
                  </tr>
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center"
                    >
                      <p className="text-sm font-medium text-slate-700">
                        No business rules found
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Create your first rule to
                        control workflow behavior.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr
                      key={rule.id}
                      className="hover:bg-slate-50"
                    >
                      {/* RULE */}
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-900">
                          {rule.name}
                        </p>

                        {rule.description && (
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-400">
                            {rule.description}
                          </p>
                        )}
                      </td>

                      {/* WORKFLOW */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">
                          {rule.workflow.name}
                        </p>

                        <p className="mt-1 font-mono text-[11px] text-slate-400">
                          {rule.workflow.code}
                        </p>
                      </td>

                      {/* CONDITION */}
                      <td className="px-6 py-4">
                        <code className="block max-w-xs truncate rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {rule.condition}
                        </code>
                      </td>

                      {/* ACTION */}
                      <td className="px-6 py-4">
                        <code className="block max-w-xs truncate rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {rule.action}
                        </code>
                      </td>

                      {/* PRIORITY */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-slate-700">
                          {rule.priority}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() =>
                            toggleStatus(rule)
                          }
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                            rule.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {rule.isActive
                            ? "Active"
                            : "Inactive"}
                        </button>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() =>
                              openEdit(rule)
                            }
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(rule)
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
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingRule
                    ? "Edit Business Rule"
                    : "Create Business Rule"}
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Define the condition and action for
                  this rule.
                </p>
              </div>

              <button
                onClick={closeForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              {/* WORKFLOW */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">
                  Workflow
                </label>

                <select
                  value={form.workflowId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      workflowId:
                        event.target.value,
                    })
                  }
                  disabled={!!editingRule}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
                >
                  <option value="">
                    Select workflow
                  </option>

                  {workflows.map(
                    (workflow) => (
                      <option
                        key={workflow.id}
                        value={workflow.id}
                      >
                        {workflow.name} (
                        {workflow.code})
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* NAME */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">
                  Rule Name
                </label>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="Validate quantity before QC"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">
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
                  rows={2}
                  placeholder="Describe what this rule does..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>

              {/* CONDITION */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">
                  Condition
                </label>

                <textarea
                  value={form.condition}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      condition:
                        event.target.value,
                    })
                  }
                  rows={3}
                  placeholder="sisaJahit > 0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-slate-400"
                />

                <p className="mt-1 text-[11px] text-slate-400">
                  Temporary expression format. We will
                  convert this into a visual rule builder
                  later.
                </p>
              </div>

              {/* ACTION */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">
                  Action
                </label>

                <textarea
                  value={form.action}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      action:
                        event.target.value,
                    })
                  }
                  rows={3}
                  placeholder="ALLOW: Penerimaan dari penjahit"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-slate-400"
                />

                <p className="mt-1 text-[11px] text-slate-400">
                  Example: ALLOW, BLOCK, NOTIFY, or
                  NEXT_STEP.
                </p>
              </div>

              {/* PRIORITY */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">
                  Priority
                </label>

                <input
                  type="number"
                  min={0}
                  value={form.priority}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      priority:
                        event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />

                <p className="mt-1 text-[11px] text-slate-400">
                  Lower number is evaluated first.
                </p>
              </div>

              {/* ACTIVE */}
              <label className="flex items-center gap-3">
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
                  className="h-4 w-4 rounded border-slate-300"
                />

                <span className="text-sm text-slate-700">
                  Active rule
                </span>
              </label>

              {/* FOOTER */}
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
                  {saving
                    ? "Saving..."
                    : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
