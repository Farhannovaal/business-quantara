"use client";

import { FormEvent, useEffect, useState } from "react";

import {

  Edit3,

  MoreHorizontal,

  Plus,

  Search,

  Trash2,

  UserRound,

  X,

  Loader2,

  RefreshCw,

} from "lucide-react";

import PermissionGate from "@/components/auth/permission-gate";

import MasterDataImportExport from "@/components/master-data/master-data-import-export";

type Employee = {

  id: number;

  name: string;

  isActive: boolean;

  createdAt: string;

  updatedAt: string;

};

type EmployeeForm = {

  name: string;

  isActive: boolean;

};

const emptyForm: EmployeeForm = {

  name: "",

  isActive: true,

};

export default function EmployeesPage() {

  const [employees, setEmployees] = useState<Employee[]>([]);

  const [search, setSearch] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);

  const [editingEmployee, setEditingEmployee] =

    useState<Employee | null>(null);

  const [form, setForm] =

    useState<EmployeeForm>(emptyForm);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const loadEmployees = async () => {

    try {

      setLoading(true);

      setError("");

      const response = await fetch("/api/employees", {

        cache: "no-store",

      });

      const result = await response.json();

      if (!response.ok || !result.success) {

        throw new Error(

          result.error || "Failed to load employees"

        );

      }

      setEmployees(result.data);

    } catch (error) {

      console.error(error);

      setError(

        error instanceof Error

          ? error.message

          : "Gagal mengambil data employees."

      );

    } finally {

      setLoading(false);

    }

  };

  useEffect(() => {

    loadEmployees();

  }, []);

  function openCreateForm() {

    setEditingEmployee(null);

    setForm(emptyForm);

    setError("");

    setShowForm(true);

  }

  function openEditForm(employee: Employee) {

    setEditingEmployee(employee);

    setForm({

      name: employee.name,

      isActive: employee.isActive,

    });

    setError("");

    setShowForm(true);

  }

  function closeForm() {

    if (saving) return;

    setShowForm(false);

    setEditingEmployee(null);

    setForm(emptyForm);

    setError("");

  }

  const handleSubmit = async (

    event: FormEvent<HTMLFormElement>

  ) => {

    event.preventDefault();

    if (!form.name.trim()) {

      setError("Nama employee wajib diisi.");

      return;

    }

    try {

      setSaving(true);

      setError("");

      const url = editingEmployee

        ? `/api/employees/${editingEmployee.id}`

        : "/api/employees";

      const method = editingEmployee

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

          result.error || "Failed to save employee"

        );

      }

      closeForm();

      await loadEmployees();

    } catch (error) {

      console.error(error);

      setError(

        error instanceof Error

          ? error.message

          : "Gagal menyimpan employee."

      );

    } finally {

      setSaving(false);

    }

  };

  const handleDelete = async (employee: Employee) => {

    const confirmed = window.confirm(

      `Hapus employee "${employee.name}"?\n\nData employee akan dihapus dari master data.`

    );

    if (!confirmed) return;

    try {

      setError("");

      const response = await fetch(

        `/api/employees/${employee.id}`,

        {

          method: "DELETE",

        }

      );

      const result = await response.json();

      if (!response.ok || !result.success) {

        throw new Error(

          result.error || "Failed to delete employee"

        );

      }

      await loadEmployees();

    } catch (error) {

      console.error(error);

      setError(

        error instanceof Error

          ? error.message

          : "Gagal menghapus employee."

      );

    }

  };

  const toggleStatus = async (employee: Employee) => {

    try {

      setError("");

      const response = await fetch(

        `/api/employees/${employee.id}`,

        {

          method: "PATCH",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            isActive: !employee.isActive,

          }),

        }

      );

      const result = await response.json();

      if (!response.ok || !result.success) {

        throw new Error(

          result.error || "Failed to update status"

        );

      }

      await loadEmployees();

    } catch (error) {

      console.error(error);

      setError(

        error instanceof Error

          ? error.message

          : "Gagal mengubah status employee."

      );

    }

  };

  const filteredEmployees = employees.filter(

    (employee) =>

      employee.name

        .toLowerCase()

        .includes(search.toLowerCase().trim())

  );

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));

  const paginatedEmployees = filteredEmployees.slice(

    (currentPage - 1) * pageSize,

    currentPage * pageSize

  );

  const startItem = filteredEmployees.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;

  const endItem = Math.min(currentPage * pageSize, filteredEmployees.length);

  useEffect(() => {

    setCurrentPage(1);

  }, [search, pageSize]);

  useEffect(() => {

    if (currentPage > totalPages) setCurrentPage(totalPages);

  }, [currentPage, totalPages]);

  const activeCount = employees.filter(

    (employee) => employee.isActive

  ).length;

  const inactiveCount =

    employees.length - activeCount;

  return (

    <div className="relative min-h-full space-y-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#090909] via-[#111111] to-[#18090b] p-4 md:p-6">

      <header className="border-b border-white/10 bg-transparent">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <div className="flex items-center gap-2">

              <div className="rounded-2xl bg-gradient-to-br from-rose-700 to-rose-950 p-3 text-white shadow-lg shadow-red-950/40">

                <UserRound size={18} />

              </div>

              <div>

                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300">

                  Master Data

                </p>

                <h1 className="text-xl font-bold text-gray-100">

                  Employees

                </h1>

              </div>

            </div>

            <p className="mt-2 text-sm text-gray-500">

              Kelola data employee yang terlibat dalam

              proses operasional.

            </p>

          </div>

          <div className="flex items-center gap-2">

            <button

              type="button"

              onClick={loadEmployees}

              disabled={loading}

              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#111111] px-3.5 text-sm font-semibold text-gray-400 transition hover:border-rose-800 hover:bg-rose-950/30 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"

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

            <PermissionGate permission="employee.manage">

              <button

                type="button"

                onClick={openCreateForm}

                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:from-rose-600 hover:to-rose-700"

              >

                <Plus size={17} />

                Add Employee

              </button>

            </PermissionGate>

          </div>

        </div>

      </header>

      <main className="p-0">

        <div className="mx-auto max-w-[1600px] space-y-6">

           <section className="relative min-w-0 rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-lg shadow-black/20">

                                <div className="mb-3">

                                  <h2 className="text-sm font-bold text-gray-100">

                                    Import & Export Employees

                                  </h2>

                                  <p className="mt-1 text-xs leading-5 text-gray-500">

                                    Download template Excel, import data employees, atau export

                                    data yang tersedia.

                                  </p>

                                </div>

                                <div className="min-w-0">

                                  <MasterDataImportExport

                                    resource="employees"

                                    viewPermission="employee.view"

                                    managePermission="employee.manage"

                                    onImported={loadEmployees}

                                  />

                                </div>

                              </section>

          {error && !showForm && (

            <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-rose-900/50 bg-rose-950/20 px-4 py-3.5 text-sm text-rose-300">

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

                className="rounded-lg p-1 text-rose-300 transition hover:bg-rose-950/40 hover:text-rose-300"

              >

                <X size={16} />

              </button>

            </div>

          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

            <div className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-lg shadow-black/20">

              <div className="flex items-center gap-3">

                <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3 text-rose-300">

                  <UserRound size={20} />

                </div>

                <div>

                  <p className="text-xs font-medium text-gray-500">

                    Total Employees

                  </p>

                  <p className="mt-1 text-2xl font-bold text-gray-100">

                    {employees.length}

                  </p>

                </div>

              </div>

            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-lg shadow-black/20">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-950/30 text-emerald-300">

                  <UserRound size={20} />

                </div>

                <div>

                  <p className="text-xs font-medium text-gray-500">

                    Active Employees

                  </p>

                  <p className="mt-1 text-2xl font-bold text-gray-100">

                    {activeCount}

                  </p>

                </div>

              </div>

            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-lg shadow-black/20">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#191919] text-gray-500">

                  <UserRound size={20} />

                </div>

                <div>

                  <p className="text-xs font-medium text-gray-500">

                    Inactive Employees

                  </p>

                  <p className="mt-1 text-2xl font-bold text-gray-100">

                    {inactiveCount}

                  </p>

                </div>

              </div>

            </div>

          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111111] shadow-xl shadow-black/40">

            <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <div className="rounded-2xl bg-gradient-to-br from-rose-700 to-rose-950 p-3 text-white shadow-lg shadow-red-950/40">

                    <UserRound size={17} />

                  </div>

                  <div>

                    <h2 className="text-sm font-bold text-gray-100">

                      Employee List

                    </h2>

                    <p className="mt-0.5 text-xs text-gray-500">

                      {filteredEmployees.length} employee

                      ditemukan

                    </p>

                  </div>

                </div>

              </div>

              <div className="relative w-full sm:w-72">

                <Search

                  size={16}

                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"

                />

                <input

                  value={search}

                  onChange={(event) =>

                    setSearch(event.target.value)

                  }

                  placeholder="Search employee..."

                  className="h-10 w-full rounded-xl border border-white/10 bg-[#111111] pl-9 pr-4 text-sm text-gray-200 outline-none transition placeholder:text-gray-500 focus:border-rose-700 focus:ring-2 focus:ring-rose-950/40"

                />

              </div>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full min-w-[700px]">

                <thead>

                  <tr className="border-b border-white/10 bg-[#171717]">

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-gray-500">

                      Employee Name

                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-gray-500">

                      Status

                    </th>

                    <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-gray-500">

                      Actions

                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-white/[0.06]">

                  {loading ? (

                    <tr>

                      <td

                        colSpan={3}

                        className="px-5 py-16"

                      >

                        <div className="flex flex-col items-center justify-center text-center">

                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-950/30 text-rose-300">

                            <Loader2

                              size={21}

                              className="animate-spin"

                            />

                          </div>

                          <p className="mt-3 text-sm font-semibold text-gray-200">

                            Loading employees...

                          </p>

                          <p className="mt-1 text-xs text-gray-500">

                            Sedang mengambil data employee.

                          </p>

                        </div>

                      </td>

                    </tr>

                  ) : filteredEmployees.length === 0 ? (

                    <tr>

                      <td

                        colSpan={3}

                        className="px-5 py-16"

                      >

                        <div className="flex flex-col items-center justify-center text-center">

                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-950/30 text-rose-300">

                            <UserRound size={22} />

                          </div>

                          <p className="mt-4 text-sm font-bold text-gray-100">

                            No employees found

                          </p>

                          <p className="mt-1 max-w-sm text-xs text-gray-500">

                            Belum ada employee yang sesuai

                            dengan pencarian kamu.

                          </p>

                          {!search && (

                            <PermissionGate permission="employee.manage">

                              <button

                                type="button"

                                onClick={openCreateForm}

                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-950/30 px-4 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-950/40"

                              >

                                <Plus size={16} />

                                Add Employee

                              </button>

                            </PermissionGate>

                          )}

                        </div>

                      </td>

                    </tr>

                  ) : (

                    paginatedEmployees.map((employee) => (

                      <tr

                        key={employee.id}

                        className="transition hover:bg-[#191919]/60"

                      >

                        <td className="px-5 py-4">

                          <div>

                            <p className="text-sm font-semibold text-gray-100">

                              {employee.name}

                            </p>

                            <p className="mt-0.5 text-[11px] text-gray-500">

                              Employee ID #{employee.id}

                            </p>

                          </div>

                        </td>

                        <td className="px-5 py-4">

                          <PermissionGate

                            permission="employee.manage"

                            fallback={

                              <span

                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${

                                  employee.isActive

                                    ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-300"

                                    : "border-white/10 bg-[#191919] text-gray-500"

                                }`}

                              >

                                <span

                                  className={`h-1.5 w-1.5 rounded-full ${

                                    employee.isActive

                                      ? "bg-emerald-400"

                                      : "bg-slate-400"

                                  }`}

                                />

                                {employee.isActive

                                  ? "Active"

                                  : "Inactive"}

                              </span>

                            }

                          >

                            <button

                              type="button"

                              onClick={() =>

                                toggleStatus(employee)

                              }

                              title="Toggle employee status"

                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${

                                employee.isActive

                                  ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-400/20"

                                  : "border-white/10 bg-[#191919] text-gray-500 hover:bg-slate-200"

                              }`}

                            >

                              <span

                                className={`h-1.5 w-1.5 rounded-full ${

                                  employee.isActive

                                    ? "bg-emerald-400"

                                    : "bg-slate-400"

                                }`}

                              />

                              {employee.isActive

                                ? "Active"

                                : "Inactive"}

                            </button>

                          </PermissionGate>

                        </td>

                        <td className="px-5 py-4">

                          <div className="flex justify-end gap-1">

                            <PermissionGate permission="employee.manage">

                              <button

                                type="button"

                                onClick={() =>

                                  openEditForm(employee)

                                }

                                className="rounded-xl p-2 text-gray-500 transition hover:bg-rose-950/30 hover:text-rose-300"

                                title="Edit Employee"

                              >

                                <Edit3 size={16} />

                              </button>

                            </PermissionGate>

                            <PermissionGate permission="employee.manage">

                              <button

                                type="button"

                                onClick={() =>

                                  handleDelete(employee)

                                }

                                className="rounded-xl p-2 text-gray-500 transition hover:bg-rose-950/20 hover:text-rose-300"

                                title="Delete Employee"

                              >

                                <Trash2 size={16} />

                              </button>

                            </PermissionGate>

                            <button

                              type="button"

                              className="rounded-xl p-2 text-gray-400 transition hover:bg-[#191919] hover:text-gray-500"

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

            {!loading && filteredEmployees.length > 0 && (

              <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">

                  <span>

                    Menampilkan <span className="font-semibold text-gray-200">{startItem}–{endItem}</span> dari{" "}

                    <span className="font-semibold text-gray-200">{filteredEmployees.length}</span> employee

                  </span>

                  <label className="flex items-center gap-2">

                    <span>Baris</span>

                    <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-white/10 bg-[#191919] px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-rose-700">

                      <option value={10}>10</option>

                      <option value={25}>25</option>

                      <option value={50}>50</option>

                    </select>

                    <span>per halaman</span>

                  </label>

                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 sm:justify-end">

                  <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-[#191919] disabled:cursor-not-allowed disabled:opacity-40">Pertama</button>

                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-[#191919] disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button>

                  <span className="min-w-[88px] text-center text-xs text-gray-400">Halaman <span className="font-semibold text-gray-200">{currentPage}</span> / {totalPages}</span>

                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-[#191919] disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button>

                  <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-[#191919] disabled:cursor-not-allowed disabled:opacity-40">Terakhir</button>

                </div>

              </div>

            )}

          </div>

        </div>

      </main>

      {showForm && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]">

          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#111111] shadow-2xl shadow-black/60">

            <div className="flex items-start justify-between border-b border-white/10 bg-gradient-to-r from-rose-950/50 to-[#111111] p-5 md:p-6">

              <div>

                <div className="flex items-center gap-2.5">

                  <div className="rounded-2xl bg-gradient-to-br from-rose-700 to-rose-950 p-3 text-white shadow-lg shadow-red-950/40">

                    <UserRound size={17} />

                  </div>

                  <div>

                    <h2 className="text-base font-bold text-gray-100">

                      {editingEmployee

                        ? "Edit Employee"

                        : "Add Employee"}

                    </h2>

                    <p className="mt-0.5 text-xs text-gray-500">

                      {editingEmployee

                        ? "Update employee information."

                        : "Add a new employee to master data."}

                    </p>

                  </div>

                </div>

              </div>

              <button

                type="button"

                onClick={closeForm}

                disabled={saving}

                className="rounded-xl p-2 text-gray-500 transition hover:bg-[#191919] hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"

              >

                <X size={18} />

              </button>

            </div>

            {error && (

              <div className="mx-6 mt-5 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">

                <p className="font-semibold">

                  Unable to save employee

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

                <label className="mb-2 block text-xs font-bold text-gray-400">

                  Employee Name

                </label>

                <input

                  value={form.name}

                  onChange={(event) =>

                    setForm({

                      ...form,

                      name: event.target.value,

                    })

                  }

                  placeholder="Contoh: Andi"

                  disabled={saving}

                  className="h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3.5 text-sm text-gray-200 outline-none transition placeholder:text-gray-500 focus:border-rose-700 focus:ring-2 focus:ring-rose-950/40 disabled:bg-[#191919]"

                />

              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#090909] px-4 py-3 transition hover:border-rose-800 hover:bg-rose-950/40">

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

                  className="h-4 w-4 rounded border-slate-300 text-rose-300 focus:ring-rose-950/400"

                />

                <div>

                  <p className="text-sm font-semibold text-gray-200">

                    Active employee

                  </p>

                  <p className="mt-0.5 text-xs text-gray-500">

                    Employee dapat digunakan dalam proses

                    operasional.

                  </p>

                </div>

              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">

                <button

                  type="button"

                  onClick={closeForm}

                  disabled={saving}

                  className="rounded-xl border border-white/10 bg-[#111111] px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"

                >

                  Cancel

                </button>

                <button

                  type="submit"

                  disabled={saving}

                  className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-rose-600 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-60"

                >

                  {saving && (

                    <Loader2

                      size={15}

                      className="animate-spin"

                    />

                  )}

                  {saving

                    ? "Saving..."

                    : editingEmployee

                      ? "Save Changes"

                      : "Save Employee"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>

  );

}