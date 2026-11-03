"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  Check,
  Code2,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Zap,
} from "lucide-react";

type NotificationEvent = {
  id: number;
  code: string;
  name: string;
  module: string;
  description: string | null;
  payloadSchema: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { configs: number };
};

type AuthUser = {
  role?: { name: string } | null;
};

type EventForm = {
  code: string;
  name: string;
  module: string;
  description: string;
  payloadSchema: string;
  isActive: boolean;
};

const initialForm: EventForm = {
  code: "",
  name: "",
  module: "PRODUCTION",
  description: "",
  payloadSchema: "{}",
  isActive: true,
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10";
const labelClass = "text-xs font-semibold text-muted-foreground";

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan. Silakan coba lagi.";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatSchema(value: unknown) {
  if (value === null || value === undefined) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export default function NotificationEventsPage() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filterModule, setFilterModule] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<NotificationEvent | null>(null);
  const [form, setForm] = useState<EventForm>(initialForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const authResponse = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const authResult = await authResponse.json().catch(() => null);

      if (!authResponse.ok || !authResult?.authenticated || !authResult?.user) {
        throw new Error("Sesi login tidak valid. Silakan login kembali.");
      }

      const user = authResult.user as AuthUser;
      const superAdmin = user.role?.name === "Superadmin";
      setIsSuperAdmin(superAdmin);

      const eventResponse = await fetch(
        `/api/notification-events${superAdmin ? "?includeInactive=true" : ""}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );
      const eventResult = await eventResponse.json().catch(() => null);

      if (!eventResponse.ok || eventResult?.success === false) {
        throw new Error(
          eventResult?.error || "Gagal mengambil katalog event notifikasi.",
        );
      }

      setEvents(Array.isArray(eventResult?.data) ? eventResult.data : []);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const modules = useMemo(
    () => Array.from(new Set(events.map((event) => event.module))).sort(),
    [events],
  );

  const filteredEvents = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch =
        !keyword ||
        event.code.toLowerCase().includes(keyword) ||
        event.name.toLowerCase().includes(keyword) ||
        event.module.toLowerCase().includes(keyword) ||
        (event.description || "").toLowerCase().includes(keyword);

      const matchesModule =
        filterModule === "ALL" || event.module === filterModule;

      const matchesStatus =
        filterStatus === "ALL" ||
        (filterStatus === "ACTIVE" ? event.isActive : !event.isActive);

      return matchesSearch && matchesModule && matchesStatus;
    });
  }, [events, search, filterModule, filterStatus]);

  const stats = useMemo(
    () => ({
      total: events.length,
      active: events.filter((event) => event.isActive).length,
      inactive: events.filter((event) => !event.isActive).length,
      used: events.filter((event) => (event._count?.configs ?? 0) > 0).length,
    }),
    [events],
  );

  function updateForm<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingEvent(null);
    setForm(initialForm);
    setPageError("");
    setModalOpen(true);
  }

  function openEdit(event: NotificationEvent) {
    setEditingEvent(event);
    setForm({
      code: event.code,
      name: event.name,
      module: event.module,
      description: event.description || "",
      payloadSchema: formatSchema(event.payloadSchema),
      isActive: event.isActive,
    });
    setPageError("");
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError("");
    setNotice("");

    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    const module = form.module.trim().toUpperCase();

    if (!editingEvent && !/^[A-Z][A-Z0-9_]{2,99}$/.test(code)) {
      setPageError("Kode event tidak valid. Contoh: SPK_CREATED.");
      return;
    }

    if (!name) {
      setPageError("Nama event wajib diisi.");
      return;
    }

    if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(module)) {
      setPageError("Module tidak valid. Contoh: PRODUCTION.");
      return;
    }

    let payloadSchema: unknown;
    try {
      payloadSchema = JSON.parse(form.payloadSchema || "{}");
      if (
        payloadSchema === null ||
        typeof payloadSchema !== "object" ||
        Array.isArray(payloadSchema)
      ) {
        throw new Error("Payload schema harus berupa object JSON.");
      }
    } catch (error) {
      setPageError(
        error instanceof Error && error.message.includes("Payload schema")
          ? error.message
          : "Format Payload Schema bukan JSON yang valid.",
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...(editingEvent ? {} : { code }),
        name,
        module,
        description: form.description.trim() || null,
        payloadSchema,
        isActive: form.isActive,
      };

      const response = await fetch(
        editingEvent
          ? `/api/notification-events/${editingEvent.id}`
          : "/api/notification-events",
        {
          method: editingEvent ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success === false) {
        throw new Error(
          result?.error || "Gagal menyimpan event notifikasi.",
        );
      }

      setModalOpen(false);
      setNotice(
        editingEvent
          ? "Event berhasil diperbarui."
          : "Event berhasil dibuat.",
      );
      await loadData();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(event: NotificationEvent) {
    setPageError("");
    setNotice("");

    try {
      const response = await fetch(`/api/notification-events/${event.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !event.isActive }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || "Gagal mengubah status event.");
      }

      setNotice(
        `Event "${event.name}" ${
          event.isActive ? "dinonaktifkan" : "diaktifkan"
        }.`,
      );
      await loadData();
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  async function deleteEvent(event: NotificationEvent) {
    const usedCount = event._count?.configs ?? 0;
    const message =
      usedCount > 0
        ? `Event "${event.name}" masih digunakan oleh ${usedCount} konfigurasi dan tidak dapat dihapus. Nonaktifkan event jika tidak ingin digunakan lagi.`
        : `Hapus event "${event.name}"? Tindakan ini tidak dapat dibatalkan.`;

    if (usedCount > 0) {
      window.alert(message);
      return;
    }

    if (!window.confirm(message)) return;

    setPageError("");
    setNotice("");

    try {
      const response = await fetch(`/api/notification-events/${event.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || "Gagal menghapus event.");
      }

      setNotice("Event berhasil dihapus.");
      await loadData();
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-600 dark:text-rose-300">
              <Zap className="h-4 w-4" />
              Automation Center
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Notification Events
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Kelola katalog event yang dapat digunakan sebagai pemicu notifikasi otomatis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 to-red-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-950/20 transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" />
                Buat Event
              </button>
            )}
          </div>
        </div>

        {notice && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
            <button onClick={() => setNotice("")} className="ml-auto" aria-label="Tutup pesan">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {pageError && !modalOpen && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{pageError}</span>
            <button onClick={() => setPageError("")} className="ml-auto" aria-label="Tutup pesan">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Event" value={stats.total} detail="Semua event terdaftar" icon={<Zap className="h-5 w-5" />} />
          <StatCard title="Aktif" value={stats.active} detail="Dapat digunakan" icon={<Check className="h-5 w-5" />} />
          <StatCard title="Nonaktif" value={stats.inactive} detail="Tidak ditampilkan di dropdown" icon={<Activity className="h-5 w-5" />} />
          <StatCard title="Sudah Digunakan" value={stats.used} detail="Memiliki konfigurasi notifikasi" icon={<Code2 className="h-5 w-5" />} />
        </div>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Daftar Event</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {filteredEvents.length} dari {events.length} event ditampilkan
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari event..."
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-rose-500 sm:w-56"
                  />
                </div>
                <select
                  value={filterModule}
                  onChange={(event) => setFilterModule(event.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-rose-500"
                >
                  <option value="ALL">Semua module</option>
                  {modules.map((module) => (
                    <option key={module} value={module}>{module}</option>
                  ))}
                </select>
                {isSuperAdmin && (
                  <select
                    value={filterStatus}
                    onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)}
                    className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-rose-500"
                  >
                    <option value="ALL">Semua status</option>
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Memuat katalog event...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold">Event tidak ditemukan</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {events.length === 0
                  ? "Belum ada event pada katalog."
                  : "Coba ubah kata kunci atau filter pencarian."}
              </p>
              {isSuperAdmin && events.length === 0 && (
                <button
                  onClick={openCreate}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  <Plus className="h-4 w-4" />
                  Buat Event Pertama
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-4 p-4 transition hover:bg-muted/30 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{event.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          event.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}>
                          {event.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {event.module}
                        </span>
                      </div>
                      <p className="mt-1 break-all font-mono text-xs text-rose-700 dark:text-rose-300">
                        {event.code}
                      </p>
                      {event.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{event._count?.configs ?? 0} konfigurasi menggunakan event</span>
                        <span>Diperbarui: {formatDate(event.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => void toggleActive(event)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          event.isActive
                            ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                        }`}
                      >
                        {event.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(event)}
                        className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteEvent(event)}
                        disabled={(event._count?.configs ?? 0) > 0}
                        title={(event._count?.configs ?? 0) > 0 ? "Event masih digunakan oleh konfigurasi" : "Hapus event"}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Code2 className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
            <div>
              <h3 className="text-sm font-semibold">Catatan integrasi event</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Membuat event hanya menambahkan event ke katalog. Agar notifikasi berjalan, proses bisnis terkait tetap harus memanggil Notification Dispatcher menggunakan event code yang sesuai.
              </p>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold">
                  {editingEvent ? "Edit Event" : "Buat Event Baru"}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Definisikan event yang tersedia untuk trigger notifikasi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              {pageError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {pageError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Event Code *</span>
                  <input
                    value={form.code}
                    onChange={(event) => updateForm("code", event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                    disabled={Boolean(editingEvent)}
                    placeholder="CONTOH: SPK_CREATED"
                    className={`${inputClass} font-mono disabled:cursor-not-allowed disabled:opacity-60`}
                    maxLength={100}
                    required={!editingEvent}
                  />
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {editingEvent ? "Kode event tidak dapat diubah." : "Gunakan huruf kapital dan underscore."}
                  </span>
                </label>

                <label className="block">
                  <span className={labelClass}>Nama Event *</span>
                  <input
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="SPK Baru Dibuat"
                    className={inputClass}
                    maxLength={150}
                    required
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className={labelClass}>Module *</span>
                  <input
                    value={form.module}
                    onChange={(event) => updateForm("module", event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                    placeholder="PRODUCTION"
                    className={inputClass}
                    maxLength={50}
                    required
                  />
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    Contoh: PRODUCTION, FINANCE, INVENTORY.
                  </span>
                </label>

                <label className="block sm:col-span-2">
                  <span className={labelClass}>Deskripsi</span>
                  <textarea
                    value={form.description}
                    onChange={(event) => updateForm("description", event.target.value)}
                    placeholder="Jelaskan kapan event ini dipicu..."
                    rows={2}
                    maxLength={1000}
                    className={inputClass}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className={labelClass}>Payload Schema (JSON)</span>
                  <textarea
                    value={form.payloadSchema}
                    onChange={(event) => updateForm("payloadSchema", event.target.value)}
                    spellCheck={false}
                    rows={8}
                    className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
                  />
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    Definisi struktur data yang akan dikirim oleh dispatcher. Gunakan object JSON.
                  </span>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => updateForm("isActive", event.target.checked)}
                    className="h-4 w-4 rounded border-border accent-rose-700"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Event aktif</span>
                    <span className="block text-xs text-muted-foreground">
                      Event aktif dapat dipilih pada konfigurasi notifikasi.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 to-red-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? "Menyimpan..." : editingEvent ? "Simpan Perubahan" : "Buat Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
          {icon}
        </div>
      </div>
    </div>
  );
}
