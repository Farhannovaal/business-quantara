"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Pencil, X } from "lucide-react";

export type EditableTransaction = {
  id: number;
  transactionNumber: string;
  quantity: number;
  status: "ACTIVE" | "CANCELLED";
  employee: { name: string };
  employeeId?: number;
  spk: { spkNumber: string };
  product?: { name: string } | null;
  transactionType: { name: string };
};

export type TransactionEmployee = {
  id: number;
  name: string;
  isActive: boolean;
};

type Props = {
  transaction: EditableTransaction | null;
  employees: TransactionEmployee[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void> | void;
  onError: (message: string) => void;
};

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-[#151313] px-3 py-3 text-sm text-white outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-950/60 disabled:opacity-50";

export default function TransactionEditModal({
  transaction,
  employees,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [quantity, setQuantity] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    setQuantity(String(transaction.quantity));
    setEmployeeId(
      transaction.employeeId !== undefined
        ? String(transaction.employeeId)
        : "",
    );
  }, [transaction]);

  if (!transaction) return null;

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!transaction || saving) return;

  const currentTransaction = transaction;

  const parsedQuantity = Number(quantity);
  const parsedEmployeeId = Number(employeeId);

  if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0) {
    onError("Jumlah harus berupa bilangan bulat lebih dari 0.");
    return;
  }

  if (!Number.isSafeInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
    onError("Pilih karyawan yang valid.");
    return;
  }

  try {
    setSaving(true);
    onError("");

    const response = await fetch(
      `/api/transactions/${currentTransaction.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity: parsedQuantity,
          employeeId: parsedEmployeeId,
        }),
      },
    );

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        json?.error ?? "Gagal memperbarui transaksi.",
      );
    }

    await onSaved(
      `Transaksi ${currentTransaction.transactionNumber} berhasil diperbarui.`,
    );
  } catch (error) {
    onError(
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat memperbarui transaksi.",
    );
  } finally {
    setSaving(false);
  }
}

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-transaction-title"
        className="my-auto w-full max-w-lg rounded-2xl border border-white/10 bg-[#111010] p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-rose-950/50 p-3 text-rose-300">
            <Pencil className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="edit-transaction-title" className="text-lg font-semibold text-white">
              Edit Transaction
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              Perubahan akan divalidasi kembali oleh server dan dicatat ke ActivityLog.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup dialog"
            className="rounded-lg p-2 text-neutral-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <Info label="Nomor transaksi" value={transaction.transactionNumber} />
          <Info label="SPK" value={transaction.spk.spkNumber} />
          <Info label="Produk" value={transaction.product?.name ?? "-"} />
          <Info label="Proses" value={transaction.transactionType.name} />
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="edit-transaction-quantity" className="mb-2 block text-sm font-semibold text-neutral-200">
              Jumlah
            </label>
            <input
              id="edit-transaction-quantity"
              type="number"
              min={1}
              step={1}
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={saving}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="edit-transaction-employee" className="mb-2 block text-sm font-semibold text-neutral-200">
              Karyawan
            </label>
            <select
              id="edit-transaction-employee"
              required
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              disabled={saving}
              className={fieldClass}
            >
              <option value="">Pilih karyawan...</option>
              {employees.filter((employee) => employee.isActive).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            {!transaction.employeeId && (
              <p className="mt-1 text-xs text-amber-300">
                API daftar transaksi perlu menyertakan employeeId agar pilihan awal terisi otomatis.
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-800 px-4 py-2.5 text-sm font-semibold text-white hover:from-rose-700 hover:to-red-900 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-white">{value}</div>
    </div>
  );
}
