"use client";

import { useEffect, useState } from "react";
import { Clock3, History, Loader2, RefreshCw, X } from "lucide-react";

type ActivityLogItem = {
  id: number | string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string | null;
  createdAt: string;
  user?: { id: number; name: string; email: string } | null;
};

type Props = {
  transaction: {
    id: number;
    transactionNumber: string;
  } | null;
  onClose: () => void;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    CREATE: "Dibuat",
    UPDATE: "Diubah",
    CANCEL: "Dibatalkan",
    DELETE: "Dihapus",
  };
  return labels[action.toUpperCase()] ?? action;
}

export default function TransactionActivityModal({ transaction, onClose }: Props) {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadLogs(transactionId: number) {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(
        `/api/transactions/${transactionId}/activity`,
        { cache: "no-store" },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error ?? "Gagal mengambil riwayat aktivitas.");
      }
      setLogs(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil riwayat aktivitas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!transaction) {
      setLogs([]);
      setError("");
      return;
    }
    void loadLogs(transaction.id);
  }, [transaction?.id]);

  if (!transaction) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-activity-title"
        className="my-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111010] p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-rose-950/50 p-3 text-rose-300">
            <History className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="transaction-activity-title" className="text-lg font-semibold text-white">
              Riwayat Aktivitas
            </h2>
            <p className="mt-1 break-words text-sm text-rose-300">
              {transaction.transactionNumber}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup dialog" className="rounded-lg p-2 text-neutral-400 hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-neutral-400">
            Maksimal 100 aktivitas terbaru untuk transaksi ini.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadLogs(transaction.id)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-300">
            {error}
            {error.toLowerCase().includes("permission") || error.includes("403")
              ? " Akun ini memerlukan permission activity.view."
              : ""}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat riwayat aktivitas...
          </div>
        ) : !error && logs.length === 0 ? (
          <div className="py-12 text-center">
            <Clock3 className="mx-auto h-8 w-8 text-neutral-600" />
            <p className="mt-3 text-sm font-medium text-neutral-300">Belum ada aktivitas tercatat.</p>
            <p className="mt-1 text-xs text-neutral-500">
              Aktivitas edit baru muncul setelah endpoint edit menyimpan ActivityLog.
            </p>
          </div>
        ) : (
          <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {logs.map((log) => (
              <article key={log.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full border border-rose-900/40 bg-rose-950/30 px-2.5 py-1 text-xs font-semibold text-rose-300">
                    {actionLabel(log.action)}
                  </span>
                  <time className="text-xs text-neutral-500">{formatDate(log.createdAt)}</time>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-200">
                  {log.description || "Tidak ada detail aktivitas."}
                </p>
                <div className="mt-3 border-t border-white/10 pt-3 text-xs text-neutral-500">
                  Oleh: <span className="text-neutral-300">{log.user?.name ?? "Pengguna tidak tersedia"}</span>
                  {log.user?.email ? <span> · {log.user.email}</span> : null}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/[0.05]">
            Tutup
          </button>
        </div>
      </section>
    </div>
  );
}
