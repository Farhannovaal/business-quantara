
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";

type UserStatus = "ACTIVE" | "INACTIVE";

type Role = {
  id: number;
  name: string;
  description?: string | null;
};

type UserItem = {
  id: number;
  name: string;
  email: string;
  status: UserStatus;
  roleId: number | null;
  role: {
    id: number;
    name: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  roleId: string;
  status: UserStatus;
};

const INITIAL_FORM: UserForm = {
  name: "",
  email: "",
  password: "",
  roleId: "",
  status: "ACTIVE",
};

const PAGE_SIZE = 10;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserForm>(INITIAL_FORM);

  const [permissionError, setPermissionError] = useState(false);

  const loadUsers = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");
      setPermissionError(false);

      const response = await fetch("/api/users", {
        cache: "no-store",
      });

      const json = await response.json();

      if (response.status === 401 || response.status === 403) {
        setPermissionError(true);
        throw new Error(
          response.status === 401
            ? "Sesi login tidak valid atau telah berakhir."
            : "Kamu tidak memiliki permission user.view."
        );
      }

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Gagal mengambil data pengguna.");
      }

      setUsers(Array.isArray(json.data) ? json.data : []);
      setRoles(Array.isArray(json.roles) ? json.roles : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return users;

    return users.filter((user) =>
      [
        user.name,
        user.email,
        user.role?.name ?? "",
        user.status,
      ].some((value) => value.toLowerCase().includes(keyword))
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  const activeCount = users.filter(
    (user) => user.status === "ACTIVE"
  ).length;

  const inactiveCount = users.length - activeCount;

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function openCreateModal() {
    setEditingUser(null);
    setForm({
      ...INITIAL_FORM,
      roleId: roles[0] ? String(roles[0].id) : "",
    });
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEditModal(user: UserItem) {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      roleId: user.roleId ? String(user.roleId) : "",
      status: user.status,
    });
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingUser(null);
    setForm(INITIAL_FORM);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setNotice("");

    if (!form.name.trim() || !form.email.trim()) {
      setError("Nama dan email wajib diisi.");
      return;
    }

    if (!form.roleId) {
      setError("Silakan pilih role untuk pengguna.");
      return;
    }

    if (!editingUser && form.password.length < 8) {
      setError("Password akun baru minimal 8 karakter.");
      return;
    }

    if (form.password && form.password.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }

    const payload: Record<string, string | number> = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      roleId: Number(form.roleId),
      status: form.status,
    };

    if (form.password) {
      payload.password = form.password;
    }

    try {
      setSaving(true);

      const response = await fetch(
        editingUser ? `/api/users/${editingUser.id}` : "/api/users",
        {
          method: editingUser ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Gagal menyimpan data pengguna.");
      }

      setNotice(
        editingUser
          ? "Data pengguna berhasil diperbarui."
          : "Akun pengguna berhasil dibuat."
      );

      setModalOpen(false);
      setEditingUser(null);
      setForm(INITIAL_FORM);

      await loadUsers(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan data."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user: UserItem) {
    const nextStatus: UserStatus =
      user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    const confirmed = window.confirm(
      nextStatus === "INACTIVE"
        ? `Nonaktifkan akun ${user.name}?`
        : `Aktifkan kembali akun ${user.name}?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Gagal mengubah status akun.");
      }

      setNotice(
        nextStatus === "ACTIVE"
          ? "Akun berhasil diaktifkan."
          : "Akun berhasil dinonaktifkan."
      );

      await loadUsers(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengubah status akun."
      );
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-rose-900/50 bg-[#151515] px-5 py-4 text-sm font-medium text-rose-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          Memuat User Management...
        </div>
      </div>
    );
  }

  if (permissionError && !users.length) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="max-w-md rounded-3xl border border-rose-900/50 bg-[#111111] p-8 text-center">
          <LockKeyhole className="mx-auto h-10 w-10 text-rose-400" />
          <h1 className="mt-4 text-xl font-bold text-gray-100">
            Akses tidak tersedia
          </h1>
          <p className="mt-2 text-sm text-gray-400">{error}</p>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="mt-5 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full space-y-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#090909] via-[#111111] to-[#18090b] p-4 md:p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-rose-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-rose-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-rose-700 to-rose-950 p-3 text-white shadow-lg shadow-red-950/40">
            <Users className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-100">
              User Management
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Kelola akun pengguna, role, dan status akses aplikasi.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadUsers(false)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-900/50 bg-[#111111] px-4 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-950/40 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={roles.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-800 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-950/30 transition hover:from-rose-600 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Tambah Pengguna
          </button>
        </div>
      </div>

      {error && (
        <div className="relative flex items-start gap-3 rounded-2xl border border-rose-900/60 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Tutup pesan error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="relative flex items-center gap-3 rounded-2xl border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
          <Check className="h-5 w-5 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Tutup notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          label="Total Pengguna"
          value={users.length}
          description="Semua akun terdaftar"
          tone="rose"
        />
        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Akun Aktif"
          value={activeCount}
          description="Dapat menggunakan aplikasi"
          tone="emerald"
        />
        <SummaryCard
          icon={<UserCog className="h-5 w-5" />}
          label="Akun Nonaktif"
          value={inactiveCount}
          description="Akses login dinonaktifkan"
          tone="amber"
        />
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111111] shadow-xl shadow-black/40">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold text-gray-100">Daftar Pengguna</h2>
            <p className="mt-1 text-xs text-gray-400">
              Kelola informasi akun dan hak akses berdasarkan role.
            </p>
          </div>

          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, email, atau role..."
              className="w-full rounded-xl border border-white/10 bg-[#191919] py-2.5 pl-10 pr-4 text-sm text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-rose-700 focus:ring-4 focus:ring-rose-950/40"
            />
          </div>
        </div>

        {roles.length === 0 && (
          <div className="border-b border-amber-900/40 bg-amber-950/20 px-5 py-3 text-sm text-amber-300">
            Belum ada role yang tersedia. Buat role terlebih dahulu sebelum
            menambahkan pengguna.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#171717] text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Pengguna</th>
                <th className="px-5 py-4 font-semibold">Role</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Dibuat</th>
                <th className="px-5 py-4 text-right font-semibold">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.06]">
              {paginatedUsers.map((user) => (
                <tr
                  key={user.id}
                  className="transition hover:bg-white/[0.025]"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-900/40 bg-rose-950/40 text-xs font-bold text-rose-300">
                        {getInitials(user.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-gray-100">
                          {user.name}
                        </div>
                        <div className="mt-1 truncate text-xs text-gray-400">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    {user.role ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-900/40 bg-rose-950/30 px-2.5 py-1.5 text-xs font-semibold text-rose-300">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {user.role.name}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        Belum memiliki role
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={user.status} />
                  </td>

                  <td className="px-5 py-4 text-xs text-gray-400">
                    {formatDate(user.createdAt)}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(user)}
                        title="Edit pengguna"
                        aria-label={`Edit ${user.name}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#191919] px-3 py-2 text-xs font-semibold text-gray-300 transition hover:border-rose-800 hover:text-rose-300"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => void toggleStatus(user)}
                        title={
                          user.status === "ACTIVE"
                            ? "Nonaktifkan akun"
                            : "Aktifkan akun"
                        }
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          user.status === "ACTIVE"
                            ? "border-amber-900/40 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40"
                            : "border-emerald-900/40 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-950/40"
                        }`}
                      >
                        {user.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <Search className="mx-auto h-8 w-8 text-gray-600" />
                    <p className="mt-3 font-semibold text-gray-300">
                      Pengguna tidak ditemukan
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Coba gunakan kata kunci pencarian lain.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-400">
            Menampilkan{" "}
            {filteredUsers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filteredUsers.length)} dari{" "}
            {filteredUsers.length} pengguna
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-white/10 p-2 text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="min-w-16 text-center text-xs text-gray-300">
              {page} / {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="rounded-lg border border-white/10 p-2 text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="my-auto w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#111111] shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between border-b border-white/10 bg-gradient-to-r from-rose-950/50 to-[#111111] p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-rose-950/50 p-2.5 text-rose-300">
                  {editingUser ? (
                    <Pencil className="h-5 w-5" />
                  ) : (
                    <UserCog className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-bold text-gray-100">
                    {editingUser ? "Edit Pengguna" : "Tambah Pengguna"}
                  </h2>
                  <p className="mt-1 text-xs text-gray-400">
                    {editingUser
                      ? "Perbarui informasi dan akses akun."
                      : "Buat akun baru untuk pengguna aplikasi."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Tutup form"
                className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5 md:p-6">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-900/50 bg-rose-950/20 p-3 text-sm text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="user-name"
                  className="text-xs font-semibold text-gray-300"
                >
                  Nama lengkap <span className="text-rose-400">*</span>
                </label>
                <input
                  id="user-name"
                  required
                  maxLength={150}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Masukkan nama lengkap"
                  className="w-full rounded-xl border border-white/10 bg-[#191919] px-4 py-3 text-sm text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-rose-700 focus:ring-4 focus:ring-rose-950/40"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="user-email"
                  className="text-xs font-semibold text-gray-300"
                >
                  Email <span className="text-rose-400">*</span>
                </label>
                <input
                  id="user-email"
                  type="email"
                  required
                  maxLength={255}
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="nama@perusahaan.com"
                  className="w-full rounded-xl border border-white/10 bg-[#191919] px-4 py-3 text-sm text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-rose-700 focus:ring-4 focus:ring-rose-950/40"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="user-password"
                  className="text-xs font-semibold text-gray-300"
                >
                  Password{" "}
                  {!editingUser && <span className="text-rose-400">*</span>}
                </label>
                <input
                  id="user-password"
                  type="password"
                  required={!editingUser}
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder={
                    editingUser
                      ? "Kosongkan jika tidak ingin mengganti"
                      : "Minimal 8 karakter"
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#191919] px-4 py-3 text-sm text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-rose-700 focus:ring-4 focus:ring-rose-950/40"
                />
                {editingUser && (
                  <p className="text-[11px] text-gray-500">
                    Password lama tidak akan berubah jika kolom ini kosong.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="user-role"
                    className="text-xs font-semibold text-gray-300"
                  >
                    Role <span className="text-rose-400">*</span>
                  </label>
                  <select
                    id="user-role"
                    required
                    value={form.roleId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        roleId: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#191919] px-3 py-3 text-sm text-gray-100 outline-none focus:border-rose-700"
                  >
                    <option value="">Pilih role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="user-status"
                    className="text-xs font-semibold text-gray-300"
                  >
                    Status akun
                  </label>
                  <select
                    id="user-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as UserStatus,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#191919] px-3 py-3 text-sm text-gray-100 outline-none focus:border-rose-700"
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-amber-900/40 bg-amber-950/15 p-3 text-xs leading-relaxed text-amber-200/80">
                Role menentukan fitur dan tindakan yang dapat diakses pengguna.
                Pastikan role yang dipilih memiliki permission sesuai tugasnya.
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={saving || roles.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {editingUser ? "Simpan Perubahan" : "Buat Akun"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const active = status === "ACTIVE";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-300"
          : "border-gray-700 bg-gray-800/50 text-gray-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-400" : "bg-gray-500"
        }`}
      />
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
  tone: "rose" | "emerald" | "amber";
}) {
  const styles = {
    rose: {
      border: "border-rose-900/40",
      background: "bg-rose-950/20",
      text: "text-rose-300",
    },
    emerald: {
      border: "border-emerald-900/40",
      background: "bg-emerald-950/20",
      text: "text-emerald-300",
    },
    amber: {
      border: "border-amber-900/40",
      background: "bg-amber-950/20",
      text: "text-amber-300",
    },
  }[tone];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-lg shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-100">
            {value.toLocaleString("id-ID")}
          </p>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>

        <div
          className={`rounded-xl border p-3 ${styles.border} ${styles.background} ${styles.text}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
