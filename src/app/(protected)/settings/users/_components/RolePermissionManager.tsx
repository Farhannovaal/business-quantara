"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {

  AlertCircle,

  Check,

  ChevronDown,

  Loader2,

  Plus,

  RefreshCw,

  Save,

  ShieldCheck,

  Users,

  X,

} from "lucide-react";

type Permission = {

  id: number;

  code: string;

  name: string;

  description: string | null;

};

type Role = {

  id: number;

  name: string;

  description: string | null;

  userCount: number;

  permissionCodes: string[];

};

const inputClass =

  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-rose-500 dark:focus:border-rose-700 focus:ring-4 focus:ring-rose-200 dark:focus:ring-rose-950/30";

const buttonClass =

  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:border-rose-300 dark:hover:border-rose-800 hover:text-rose-700 dark:hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50";

export default function RolePermissionManager() {

  const [roles, setRoles] = useState<Role[]>([]);

  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [name, setName] = useState("");

  const [description, setDescription] = useState("");

  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  const [creating, setCreating] = useState(false);

  const [expanded, setExpanded] = useState(false);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const selectedRole = useMemo(

    () => roles.find((role) => role.id === selectedId) ?? null,

    [roles, selectedId],

  );

  const loadRoles = useCallback(async () => {

    setLoading(true);

    setError("");

    try {

      const response = await fetch("/api/roles", {

        cache: "no-store",

      });

      const json = await response.json();

      if (!response.ok || !json.success) {

        throw new Error(json.error ?? "Gagal memuat role.");

      }

      const nextRoles: Role[] = Array.isArray(json.data)

        ? json.data

        : [];

      setRoles(nextRoles);

      setPermissions(

        Array.isArray(json.permissions) ? json.permissions : [],

      );

      setSelectedId((current) =>

        current !== null &&

        nextRoles.some((role) => role.id === current)

          ? current

          : nextRoles[0]?.id ?? null,

      );

    } catch (err) {

      setError(

        err instanceof Error ? err.message : "Gagal memuat role.",

      );

    } finally {

      setLoading(false);

    }

  }, []);

  useEffect(() => {

    void loadRoles();

  }, [loadRoles]);

  useEffect(() => {

    if (creating) return;

    if (!selectedRole) {

      setName("");

      setDescription("");

      setSelectedCodes([]);

      return;

    }

    setName(selectedRole.name);

    setDescription(selectedRole.description ?? "");

    setSelectedCodes(selectedRole.permissionCodes);

  }, [selectedRole, creating]);

  function selectRole(role: Role) {

    setSelectedId(role.id);

    setName(role.name);

    setDescription(role.description ?? "");

    setSelectedCodes(role.permissionCodes);

    setCreating(false);

    setError("");

    setNotice("");

  }

  function startCreate() {

    setSelectedId(null);

    setName("");

    setDescription("");

    setSelectedCodes([]);

    setCreating(true);

    setExpanded(true);

    setError("");

    setNotice("");

  }

  function togglePermission(code: string, checked: boolean) {

    setSelectedCodes((current) =>

      checked

        ? [...new Set([...current, code])]

        : current.filter((item) => item !== code),

    );

  }

  async function saveRole(

    event: React.FormEvent<HTMLFormElement>,

  ) {

    event.preventDefault();

    if (saving) return;

    if (!name.trim()) {

      setError("Nama role wajib diisi.");

      return;

    }

    if (!creating && selectedId === null) {

      setError("Pilih role yang ingin diperbarui.");

      return;

    }

    setSaving(true);

    setError("");

    setNotice("");

    try {

      const response = await fetch(

        creating ? "/api/roles" : `/api/roles/${selectedId}`,

        {

          method: creating ? "POST" : "PATCH",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            name: name.trim(),

            description: description.trim(),

            permissionCodes: selectedCodes,

          }),

        },

      );

      const json = await response.json();

      if (!response.ok || !json.success) {

        throw new Error(

          json.error ?? "Gagal menyimpan role.",

        );

      }

      const savedRoleId: number = json.data.id;

      setNotice(

        creating

          ? "Role berhasil dibuat."

          : "Role dan permission berhasil diperbarui.",

      );

      setCreating(false);

      await loadRoles();

      setSelectedId(savedRoleId);

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "Gagal menyimpan role.",

      );

    } finally {

      setSaving(false);

    }

  }

  return (

    <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-lg shadow-black/5 dark:shadow-black/20">

      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">

        <button

          type="button"

          onClick={() => setExpanded((value) => !value)}

          className="flex min-w-0 items-center gap-3 text-left"

          aria-expanded={expanded}

        >

          <span className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/40 p-2.5 text-rose-700 dark:text-rose-300">

            <ShieldCheck className="h-5 w-5" />

          </span>

          <span className="min-w-0">

            <span className="block font-bold text-foreground">

              Pengaturan Role & Permission

            </span>

            <span className="mt-1 block text-xs text-muted-foreground">

              Atur hak akses fitur untuk setiap role.

            </span>

          </span>

          <ChevronDown

            className={`ml-1 h-4 w-4 shrink-0 text-muted-foreground transition ${

              expanded ? "rotate-180" : ""

            }`}

          />

        </button>

        <div className="flex flex-wrap gap-2">
            
          <button

            type="button"

            onClick={() => void loadRoles()}

            disabled={loading || saving}

            className={buttonClass}

          >

            <RefreshCw

              className={`h-4 w-4 ${

                loading ? "animate-spin" : ""

              }`}

            />

            Refresh

          </button>

          <button

            type="button"

            onClick={startCreate}

            disabled={saving}

            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 dark:bg-rose-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 dark:hover:bg-rose-700 disabled:opacity-50"

          >

            <Plus className="h-4 w-4" />

            Tambah Role

          </button>

        </div>

      </div>

      {expanded && (

        <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">

          <aside className="border-b border-border p-4 lg:border-b-0 lg:border-r">

            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">

              Daftar Role ({roles.length})

            </p>

            {loading ? (

              <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">

                <Loader2 className="h-4 w-4 animate-spin" />

                Memuat role...

              </div>

            ) : roles.length === 0 ? (

              <p className="py-4 text-sm text-muted-foreground">

                Belum ada role.

              </p>

            ) : (

              <div className="space-y-2">

                {roles.map((role) => (

                  <button

                    key={role.id}

                    type="button"

                    onClick={() => selectRole(role)}

                    disabled={saving}

                    className={`w-full rounded-xl border p-3 text-left transition ${

                      !creating && selectedId === role.id

                        ? "border-rose-300 dark:border-rose-700/70 bg-rose-50 dark:bg-rose-950/30"

                        : "border-border bg-muted hover:border-border"

                    }`}

                  >

                    <span className="block truncate text-sm font-semibold text-foreground">

                      {role.name}

                    </span>

                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">

                      <Users className="h-3.5 w-3.5" />

                      {role.userCount} pengguna

                    </span>

                  </button>

                ))}

              </div>

            )}

          </aside>

          <form

            onSubmit={saveRole}

            className="min-w-0 space-y-5 p-4 md:p-5"

          >

            {(error || notice) && (

              <div

                className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${

                  error

                    ? "border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300"

                    : "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300"

                }`}

              >

                {error ? (

                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                ) : (

                  <Check className="mt-0.5 h-4 w-4 shrink-0" />

                )}

                <span className="flex-1">{error || notice}</span>

                <button

                  type="button"

                  onClick={() => {

                    setError("");

                    setNotice("");

                  }}

                  aria-label="Tutup pesan"

                >

                  <X className="h-4 w-4" />

                </button>

              </div>

            )}

            <div className="grid gap-4 sm:grid-cols-2">

              <label className="space-y-1.5">

                <span className="block text-xs font-semibold text-muted-foreground">

                  Nama Role \*

                </span>

                <input

                  className={inputClass}

                  value={name}

                  onChange={(event) => setName(event.target.value)}

                  maxLength={100}

                  required

                  placeholder="Contoh: Supervisor"

                />

              </label>

              <label className="space-y-1.5">

                <span className="block text-xs font-semibold text-muted-foreground">

                  Deskripsi

                </span>

                <input

                  className={inputClass}

                  value={description}

                  onChange={(event) =>

                    setDescription(event.target.value)

                  }

                  maxLength={255}

                  placeholder="Deskripsi tanggung jawab role"

                />

              </label>

            </div>

            <div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">

                <div>

                  <h3 className="text-sm font-bold text-foreground">

                    Permission

                  </h3>

                  <p className="mt-1 text-xs text-muted-foreground">

                    {selectedCodes.length} permission dipilih.

                    Perubahan berlaku untuk seluruh pengguna dengan

                    role ini.

                  </p>

                </div>

                <div className="flex gap-2">

                  <button

                    type="button"

                    className={buttonClass}

                    onClick={() =>

                      setSelectedCodes(

                        permissions.map((item) => item.code),

                      )

                    }

                  >

                    Pilih Semua

                  </button>

                  <button

                    type="button"

                    className={buttonClass}

                    onClick={() => setSelectedCodes([])}

                  >

                    Hapus Pilihan

                  </button>

                </div>

              </div>

              {permissions.length === 0 ? (

                <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-200">

                  Belum ada data permission di database.

                </div>

              ) : (

                <div className="grid gap-2 sm:grid-cols-2">

                  {permissions.map((item) => (

                    <label

                      key={item.code}

                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${

                        selectedCodes.includes(item.code)

                          ? "border-rose-300 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/20"

                          : "border-border bg-muted hover:border-border"

                      }`}

                    >

                      <input

                        type="checkbox"

                        checked={selectedCodes.includes(item.code)}

                        onChange={(event) =>

                          togglePermission(

                            item.code,

                            event.target.checked,

                          )

                        }

                        className="mt-1 h-4 w-4 accent-rose-600"

                      />

                      <span className="min-w-0 flex-1">

                        <span className="block text-sm font-semibold text-foreground">

                          {item.name}

                        </span>

                        <code className="mt-1 block break-all text-[11px] text-rose-700 dark:text-rose-300">

                          {item.code}

                        </code>

                        {item.description && (

                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">

                            {item.description}

                          </span>

                        )}

                      </span>

                    </label>

                  ))}

                </div>

              )}

            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">

              <p className="text-xs leading-relaxed text-muted-foreground">

                {creating

                  ? "Role baru akan dibuat setelah disimpan."

                  : "Perubahan permission memengaruhi seluruh pengguna dengan role ini."}

              </p>

              <button

                type="submit"

                disabled={

                  saving ||

                  loading ||

                  (!creating && selectedId === null)

                }

                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 dark:from-rose-700 dark:to-rose-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:from-rose-500 dark:hover:from-rose-600 hover:to-rose-600 dark:hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-50"

              >

                {saving ? (

                  <Loader2 className="h-4 w-4 animate-spin" />

                ) : (

                  <Save className="h-4 w-4" />

                )}

                {saving

                  ? "Menyimpan..."

                  : creating

                    ? "Buat Role"

                    : "Simpan Role & Permission"}

              </button>

            </div>

          </form>

        </div>

      )}

    </section>

  );

}
