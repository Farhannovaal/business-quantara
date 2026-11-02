"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Edit3,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
  Zap,
} from "lucide-react";

type Channel = "TELEGRAM" | "EMAIL";
type Trigger = "SCHEDULED" | "EVENT";
type ScheduleType = "INTERVAL" | "DAILY";
type IntervalUnit = "MINUTES" | "HOURS";

type NotificationConfig = {
  id: number;
  companyId: number;
  name: string;
  channel: Channel;
  trigger: Trigger;
  scheduleType: ScheduleType | null;
  intervalValue: number | null;
  intervalUnit: IntervalUnit | null;
  dailyTime: string | null;
  timezone: string;
  eventName: string | null;
  recipient: { chatIds?: string[]; emails?: string[] };
  template: string;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Company = {
  id: number;
  name: string;
  code: string;
};

type AuthUser = {
  id: number;
  role?: { name: string } | null;
  companyId?: number | null;
  company?: Company | null;
};

type FormState = {
  companyId: string;
  name: string;
  channel: Channel;
  trigger: Trigger;
  scheduleType: ScheduleType;
  intervalValue: string;
  intervalUnit: IntervalUnit;
  dailyTime: string;
  timezone: string;
  eventName: string;
  recipients: string;
  template: string;
  isActive: boolean;
};

const initialForm: FormState = {
  companyId: "",
  name: "",
  channel: "TELEGRAM",
  trigger: "SCHEDULED",
  scheduleType: "INTERVAL",
  intervalValue: "60",
  intervalUnit: "MINUTES",
  dailyTime: "08:00",
  timezone: "Asia/Jakarta",
  eventName: "",
  recipients: "",
  template: "Halo,\n\nIni adalah notifikasi otomatis dari sistem.",
  isActive: true,
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10";
const labelClass = "text-xs font-semibold text-muted-foreground";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function recipientSummary(config: NotificationConfig) {
  const values =
    config.channel === "TELEGRAM"
      ? config.recipient?.chatIds ?? []
      : config.recipient?.emails ?? [];
  if (!values.length) return "Belum ada penerima";
  return values.length > 2
    ? `${values.slice(0, 2).join(", ")} +${values.length - 2}`
    : values.join(", ");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan. Silakan coba lagi.";
}

export default function NotificationsPage() {
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filterChannel, setFilterChannel] = useState<"ALL" | Channel>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);

  const isSuperAdmin = authUser?.role?.name === "Superadmin";

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const [configResponse, authResponse] = await Promise.all([
        fetch("/api/notification-configs", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const configResult = await configResponse.json();
      const authResult = await authResponse.json().catch(() => null);

      if (!configResponse.ok || configResult?.success === false) {
        throw new Error(configResult?.message || configResult?.error || "Gagal mengambil konfigurasi notifikasi.");
      }

      const rows = Array.isArray(configResult?.data)
        ? configResult.data
        : Array.isArray(configResult)
          ? configResult
          : [];

      setConfigs(rows);
      if (authResponse.ok && authResult?.authenticated && authResult?.user) {
        const user = authResult.user as AuthUser;
        setAuthUser(user);

        // Superadmin dapat memilih perusahaan. Daftar perusahaan diambil dari
        // endpoint yang juga digunakan halaman User Management.
        if (user.role?.name === "Superadmin") {
          const companiesResponse = await fetch("/api/users", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });
          const companiesResult = await companiesResponse.json().catch(() => null);
          if (!companiesResponse.ok || !companiesResult?.success) {
            throw new Error(companiesResult?.error || "Gagal mengambil daftar perusahaan.");
          }
          setCompanies(Array.isArray(companiesResult.companies) ? companiesResult.companies : []);
        } else {
          setCompanies([]);
        }
      }
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredConfigs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return configs.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        (item.eventName || "").toLowerCase().includes(keyword);
      const matchesChannel = filterChannel === "ALL" || item.channel === filterChannel;
      const matchesStatus =
        filterStatus === "ALL" ||
        (filterStatus === "ACTIVE" ? item.isActive : !item.isActive);
      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [configs, search, filterChannel, filterStatus]);

  const stats = useMemo(
    () => ({
      total: configs.length,
      active: configs.filter((item) => item.isActive).length,
      scheduled: configs.filter((item) => item.trigger === "SCHEDULED").length,
      event: configs.filter((item) => item.trigger === "EVENT").length,
    }),
    [configs],
  );

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      ...initialForm,
      companyId: isSuperAdmin ? "" : String(authUser?.companyId ?? ""),
    });
    setPageError("");
    setModalOpen(true);
  }

  function openEdit(config: NotificationConfig) {
    const recipients =
      config.channel === "TELEGRAM"
        ? config.recipient?.chatIds ?? []
        : config.recipient?.emails ?? [];

    setEditingId(config.id);
    setForm({
      companyId: String(config.companyId ?? ""),
      name: config.name,
      channel: config.channel,
      trigger: config.trigger,
      scheduleType: config.scheduleType ?? "INTERVAL",
      intervalValue: String(config.intervalValue ?? 60),
      intervalUnit: config.intervalUnit ?? "MINUTES",
      dailyTime: config.dailyTime ?? "08:00",
      timezone: config.timezone || "Asia/Jakarta",
      eventName: config.eventName ?? "",
      recipients: recipients.join(", "),
      template: config.template,
      isActive: config.isActive,
    });
    setPageError("");
    setModalOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError("");
    setNotice("");

    const recipientList = form.recipients
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!form.name.trim()) {
      setPageError("Nama konfigurasi wajib diisi.");
      return;
    }
    if (!recipientList.length) {
      setPageError("Minimal satu penerima harus diisi.");
      return;
    }
    if (form.trigger === "EVENT" && !form.eventName.trim()) {
      setPageError("Nama event wajib diisi untuk trigger EVENT.");
      return;
    }
    if (isSuperAdmin && (!form.companyId || Number(form.companyId) <= 0)) {
      setPageError("Pilih perusahaan terlebih dahulu.");
      return;
    }

    const recipient =
      form.channel === "TELEGRAM"
        ? { chatIds: recipientList }
        : { emails: recipientList };

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      channel: form.channel,
      trigger: form.trigger,
      recipient,
      template: form.template,
      isActive: form.isActive,
      timezone: form.timezone,
      scheduleType: form.trigger === "SCHEDULED" ? form.scheduleType : null,
      intervalValue:
        form.trigger === "SCHEDULED" && form.scheduleType === "INTERVAL"
          ? Number(form.intervalValue)
          : null,
      intervalUnit:
        form.trigger === "SCHEDULED" && form.scheduleType === "INTERVAL"
          ? form.intervalUnit
          : null,
      dailyTime:
        form.trigger === "SCHEDULED" && form.scheduleType === "DAILY"
          ? form.dailyTime
          : null,
      eventName: form.trigger === "EVENT" ? form.eventName.trim() : null,
    };

    if (isSuperAdmin && form.companyId) {
      payload.companyId = Number(form.companyId);
    }

    setSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/notification-configs/${editingId}` : "/api/notification-configs",
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || result?.error || "Gagal menyimpan konfigurasi.");
      }

      setModalOpen(false);
      setNotice(editingId ? "Konfigurasi berhasil diperbarui." : "Konfigurasi berhasil dibuat.");
      await loadData();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(config: NotificationConfig) {
    setPageError("");
    setNotice("");
    try {
      const response = await fetch(`/api/notification-configs/${config.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !config.isActive }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || result?.error || "Gagal mengubah status konfigurasi.");
      }
      setNotice(`Notifikasi "${config.name}" ${config.isActive ? "dinonaktifkan" : "diaktifkan"}.`);
      await loadData();
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  async function deleteConfig(config: NotificationConfig) {
    const confirmed = window.confirm(
      `Hapus konfigurasi "${config.name}"? Konfigurasi yang sudah memiliki job atau riwayat pengiriman mungkin tidak dapat dihapus.`,
    );
    if (!confirmed) return;

    setPageError("");
    setNotice("");
    try {
      const response = await fetch(`/api/notification-configs/${config.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || result?.error || "Gagal menghapus konfigurasi.");
      }
      setNotice("Konfigurasi berhasil dihapus.");
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
              <Bell className="h-4 w-4" />
              Automation Center
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notification Management</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Kelola notifikasi otomatis melalui Telegram dan Email, baik berdasarkan jadwal maupun event sistem.
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
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 to-red-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-950/20 transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Buat Notifikasi
            </button>
          </div>
        </div>

        {notice && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
            <button onClick={() => setNotice("")} className="ml-auto" aria-label="Tutup pesan">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {pageError && !modalOpen && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            <Zap className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{pageError}</span>
            <button onClick={() => setPageError("")} className="ml-auto" aria-label="Tutup pesan">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Konfigurasi" value={stats.total} icon={<Bell className="h-5 w-5" />} detail="Semua konfigurasi" />
          <StatCard title="Aktif" value={stats.active} icon={<Check className="h-5 w-5" />} detail="Siap dijalankan" />
          <StatCard title="Scheduled" value={stats.scheduled} icon={<CalendarClock className="h-5 w-5" />} detail="Berdasarkan jadwal" />
          <StatCard title="Event Trigger" value={stats.event} icon={<Zap className="h-5 w-5" />} detail="Berdasarkan event sistem" />
        </div>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Daftar Konfigurasi</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{filteredConfigs.length} konfigurasi ditampilkan</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari konfigurasi..."
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-rose-500 sm:w-56"
                />
              </div>
              <select
                value={filterChannel}
                onChange={(event) => setFilterChannel(event.target.value as "ALL" | Channel)}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-rose-500"
              >
                <option value="ALL">Semua channel</option>
                <option value="TELEGRAM">Telegram</option>
                <option value="EMAIL">Email</option>
              </select>
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-rose-500"
              >
                <option value="ALL">Semua status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Memuat konfigurasi notifikasi...
            </div>
          ) : filteredConfigs.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                <Bell className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold">Belum ada konfigurasi notifikasi</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Buat konfigurasi pertama untuk mulai mengirim notifikasi otomatis melalui Telegram atau Email.
              </p>
              <button
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
              >
                <Plus className="h-4 w-4" />
                Buat Notifikasi
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConfigs.map((config) => (
                <div key={config.id} className="flex flex-col gap-4 p-4 transition hover:bg-muted/30 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      config.channel === "TELEGRAM"
                        ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200"
                        : "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
                    }`}>
                      {config.channel === "TELEGRAM" ? <MessageCircle className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{config.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          config.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}>
                          {config.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {config.channel}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{recipientSummary(config)}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          {config.trigger === "SCHEDULED" ? <Clock3 className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                          {config.trigger === "SCHEDULED"
                            ? config.scheduleType === "DAILY"
                              ? `Harian · ${config.dailyTime ?? "—"}`
                              : `Setiap ${config.intervalValue ?? "—"} ${config.intervalUnit === "HOURS" ? "jam" : "menit"}`
                            : `Event · ${config.eventName || "—"}`}
                        </span>
                        <span>Next run: {formatDate(config.nextRunAt)}</span>
                        <span>Last run: {formatDate(config.lastRunAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                    <button
                      onClick={() => void toggleActive(config)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        config.isActive
                          ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                          : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                      }`}
                    >
                      {config.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button
                      onClick={() => openEdit(config)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => void deleteConfig(config)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <InfoPanel
            icon={<MessageCircle className="h-5 w-5" />}
            title="Telegram"
            description="Gunakan Chat ID tujuan. Pastikan bot sudah diundang ke grup atau penerima sudah memulai percakapan dengan bot."
          />
          <InfoPanel
            icon={<Mail className="h-5 w-5" />}
            title="Email"
            description="Masukkan alamat email penerima. Pengiriman email memerlukan provider email yang dikonfigurasi pada worker."
          />
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-6">
          <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-600 dark:text-rose-300">Notification Setup</p>
                <h2 className="mt-1 text-lg font-bold">{editingId ? "Edit Konfigurasi" : "Buat Konfigurasi Notifikasi"}</h2>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Tutup modal">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="max-h-[calc(100vh-9rem)] space-y-5 overflow-y-auto p-5">
              {pageError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                  {pageError}
                </div>
              )}

              {isSuperAdmin ? (
                <Field label="Perusahaan" hint="Pilih perusahaan pemilik konfigurasi notifikasi ini.">
                  <select
                    required
                    value={form.companyId}
                    onChange={(event) => updateForm("companyId", event.target.value)}
                    className={inputClass}
                    disabled={companies.length === 0}
                  >
                    <option value="">Pilih perusahaan</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.code})
                      </option>
                    ))}
                  </select>
                  {companies.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                      Daftar perusahaan belum tersedia atau Anda tidak memiliki akses.
                    </p>
                  )}
                </Field>
              ) : (
                <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
                  <p className="text-xs font-semibold text-muted-foreground">Perusahaan</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {authUser?.company?.name || `Perusahaan ID ${authUser?.companyId ?? "akun"}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Konfigurasi ini otomatis disimpan untuk perusahaan akun Anda.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama Konfigurasi">
                  <input
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="Contoh: Daily Production Report"
                    className={inputClass}
                    required
                  />
                </Field>
                <Field label="Channel">
                  <select value={form.channel} onChange={(event) => updateForm("channel", event.target.value as Channel)} className={inputClass}>
                    <option value="TELEGRAM">Telegram</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </Field>
              </div>

              <Field
                label={form.channel === "TELEGRAM" ? "Telegram Chat ID" : "Email Penerima"}
                hint="Pisahkan beberapa penerima menggunakan koma atau baris baru."
              >
                <textarea
                  value={form.recipients}
                  onChange={(event) => updateForm("recipients", event.target.value)}
                  rows={2}
                  placeholder={form.channel === "TELEGRAM" ? "7492418618, -1001234567890" : "ops@example.com, admin@example.com"}
                  className={inputClass}
                  required
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Trigger">
                  <select value={form.trigger} onChange={(event) => updateForm("trigger", event.target.value as Trigger)} className={inputClass}>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="EVENT">Event</option>
                  </select>
                </Field>
                {form.trigger === "EVENT" ? (
                  <Field label="Event Name" hint="Harus sama dengan nama event yang dipanggil dari aplikasi.">
                    <input
                      value={form.eventName}
                      onChange={(event) => updateForm("eventName", event.target.value)}
                      placeholder="Contoh: SPK_COMPLETED"
                      className={inputClass}
                      required
                    />
                  </Field>
                ) : (
                  <Field label="Tipe Jadwal">
                    <select value={form.scheduleType} onChange={(event) => updateForm("scheduleType", event.target.value as ScheduleType)} className={inputClass}>
                      <option value="INTERVAL">Interval</option>
                      <option value="DAILY">Harian</option>
                    </select>
                  </Field>
                )}
              </div>

              {form.trigger === "SCHEDULED" && (
                <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
                  {form.scheduleType === "INTERVAL" ? (
                    <>
                      <Field label="Jalankan Setiap">
                        <input
                          type="number"
                          min="1"
                          value={form.intervalValue}
                          onChange={(event) => updateForm("intervalValue", event.target.value)}
                          className={inputClass}
                          required
                        />
                      </Field>
                      <Field label="Satuan Interval">
                        <select value={form.intervalUnit} onChange={(event) => updateForm("intervalUnit", event.target.value as IntervalUnit)} className={inputClass}>
                          <option value="MINUTES">Menit</option>
                          <option value="HOURS">Jam</option>
                        </select>
                      </Field>
                    </>
                  ) : (
                    <Field label="Waktu Pengiriman">
                      <input
                        type="time"
                        value={form.dailyTime}
                        onChange={(event) => updateForm("dailyTime", event.target.value)}
                        className={inputClass}
                        required
                      />
                    </Field>
                  )}
                  <Field label="Timezone">
                    <select value={form.timezone} onChange={(event) => updateForm("timezone", event.target.value)} className={inputClass}>
                      <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                      <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                      <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </Field>
                </div>
              )}

              <Field label="Message Template" hint="Placeholder dapat ditulis menggunakan format {{nama_field}}.">
                <textarea
                  value={form.template}
                  onChange={(event) => updateForm("template", event.target.value)}
                  rows={6}
                  placeholder="Tulis isi notifikasi..."
                  className={`${inputClass} font-mono text-xs leading-relaxed`}
                  required
                />
              </Field>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Aktifkan konfigurasi</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Worker akan memproses konfigurasi yang aktif.</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateForm("isActive", event.target.checked)}
                  className="h-4 w-4 accent-rose-700"
                />
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 to-red-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Buat Konfigurasi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  detail,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function InfoPanel({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
