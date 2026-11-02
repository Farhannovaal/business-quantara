
"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  LockKeyhole,
  Settings2,
  X,
} from "lucide-react";

type PermissionEffect = "GRANT" | "DENY" | "INHERIT";

type PermissionItem = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  inherited: boolean;
  override: PermissionEffect;
  effective: boolean;
};

type Props = {
  userId: number;
  userName: string;
  disabled?: boolean;
};

export default function UserPermissionManager({
  userId,
  userName,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadPermissions() {
    try {
      setLoading(true);
      setError("");
      setNotice("");

      const response = await fetch(
        `/api/users/${userId}/permissions`,
        { cache: "no-store" },
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.error ?? "Gagal mengambil permission pengguna.",
        );
      }

      setPermissions(json.data.permissions ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil permission.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void loadPermissions();
    }
  }, [open, userId]);

  function updateEffect(
    permissionId: number,
    effect: PermissionEffect,
  ) {
    setPermissions((current) =>
      current.map((permission) => {
        if (permission.id !== permissionId) {
          return permission;
        }

        return {
          ...permission,
          override: effect,
          effective:
            effect === "GRANT"
              ? true
              : effect === "DENY"
                ? false
                : permission.inherited,
        };
      }),
    );
  }

  async function savePermissions() {
    try {
      setSaving(true);
      setError("");
      setNotice("");

      const overrides = permissions
        .filter(
          (permission) =>
            permission.override !== "INHERIT",
        )
        .map((permission) => ({
          permissionId: permission.id,
          effect: permission.override,
        }));

      const response = await fetch(
        `/api/users/${userId}/permissions`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ overrides }),
        },
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.error ?? "Gagal menyimpan permission pengguna.",
        );
      }

      setNotice("Individual permission berhasil disimpan.");
      await loadPermissions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan permission.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        title="Atur individual permission"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:border-rose-800 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Permissions
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm dark:bg-black/70"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setOpen(false);
            }
          }}
        >
          <div className="my-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b border-border bg-rose-50/70 p-5 dark:bg-rose-950/20">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-rose-950/50 p-2.5 text-rose-300">
                  <LockKeyhole className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-bold text-foreground">
                    Individual Permissions
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Atur permission khusus untuk {userName}.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
                <strong>INHERIT:</strong> Mengikuti permission role.
                <br />
                <strong>GRANT:</strong> Memberikan permission tambahan.
                <br />
                <strong>DENY:</strong> Mencabut permission dari user ini saja.
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {notice && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
                  <Check className="h-4 w-4" />
                  {notice}
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Memuat permissions...
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Permission</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Effective</th>
                        <th className="px-4 py-3">Override</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                      {permissions.map((permission) => (
                        <tr key={permission.id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">
                              {permission.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {permission.code}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            {permission.inherited ? (
                              <span className="text-xs font-medium text-emerald-600">
                                Granted
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Not granted
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={
                                permission.effective
                                  ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                              }
                            >
                              {permission.effective ? "Allowed" : "Denied"}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <select
                              value={permission.override}
                              disabled={saving}
                              onChange={(event) =>
                                updateEffect(
                                  permission.id,
                                  event.target.value as PermissionEffect,
                                )
                              }
                              className="w-full min-w-32 rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-rose-400"
                            >
                              <option value="INHERIT">Inherit</option>
                              <option value="GRANT">Grant</option>
                              <option value="DENY">Deny</option>
                            </select>
                          </td>
                        </tr>
                      ))}

                      {permissions.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-10 text-center text-sm text-muted-foreground"
                          >
                            Belum ada permission tersedia.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
              >
                Tutup
              </button>

              <button
                type="button"
                disabled={loading || saving}
                onClick={() => void savePermissions()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Simpan Permission
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
