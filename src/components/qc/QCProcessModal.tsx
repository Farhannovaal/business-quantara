"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import type { QCItem } from "@/lib/qc/types";
import { formatNumber } from "@/lib/qc/utils";

type Employee = {
  id: number;
  name: string;
  isActive: boolean;
};

type Props = {
  item: QCItem;
  onClose: () => void;
  onSuccess: () => void;
};

export default function QCProcessModal({
  item,
  onClose,
  onSuccess,
}: Props) {
  const [employeeId, setEmployeeId] =
    useState("");

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [accQuantity, setAccQuantity] =
    useState("");

  const [rejectQuantity, setRejectQuantity] =
    useState("");

  const [notes, setNotes] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [loadingEmployees, setLoadingEmployees] =
    useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadEmployees() {
      try {
        setLoadingEmployees(true);

        const response = await fetch(
          "/api/qc/employees",
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ||
              "Gagal mengambil PIC QC.",
          );
        }

        setEmployees(
          (result.data ?? []).filter(
            (employee: Employee) =>
              employee.isActive,
          ),
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Gagal mengambil PIC QC.",
        );
      } finally {
        setLoadingEmployees(false);
      }
    }

    loadEmployees();
  }, []);

  const acc =
    Number(accQuantity) || 0;

  const rijek =
    Number(rejectQuantity) || 0;

  const total = acc + rijek;

  const isValid =
    employeeId !== "" &&
    total > 0 &&
    total <= item.sisaQC;

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!employeeId) {
      setError(
        "Pilih PIC QC terlebih dahulu.",
      );
      return;
    }

    if (total <= 0) {
      setError(
        "Minimal harus ada hasil ACC atau Rijek.",
      );
      return;
    }

    if (total > item.sisaQC) {
      setError(
        `Jumlah hasil QC melebihi sisa QC (${item.sisaQC} pcs).`,
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/qc/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          spkId: item.spkId,
          productId: item.productId,
          employeeId: Number(employeeId),
          accQuantity: acc,
          rejectQuantity: rijek,
          notes,
        }),
      });

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "Gagal menyimpan hasil QC.",
        );
      }

      setSuccess(
        "Hasil QC berhasil disimpan.",
      );

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan hasil QC.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Quality Control
          </p>

          <h2 className="mt-1 text-xl font-bold text-slate-800">
            Proses QC
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {item.spkNumber} ·{" "}
            {item.product.name}
          </p>

          <p className="text-sm text-slate-500">
            Penjahit: {item.tailor.name}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-6"
        >
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-medium text-amber-700">
              Sisa yang dapat diperiksa
            </p>

            <p className="mt-1 text-2xl font-bold text-amber-700">
              {formatNumber(item.sisaQC)} pcs
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              PIC QC
            </label>

            <select
              value={employeeId}
              onChange={(event) =>
                setEmployeeId(
                  event.target.value,
                )
              }
              disabled={loadingEmployees}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            >
              <option value="">
                {loadingEmployees
                  ? "Memuat PIC..."
                  : "Pilih PIC QC"}
              </option>

              {employees.map(
                (employee) => (
                  <option
                    key={employee.id}
                    value={employee.id}
                  >
                    {employee.name}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-emerald-700">
                ACC
              </label>

              <input
                type="number"
                min={0}
                max={item.sisaQC}
                value={accQuantity}
                onChange={(event) =>
                  setAccQuantity(
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-rose-700">
                Rijek
              </label>

              <input
                type="number"
                min={0}
                max={item.sisaQC}
                value={rejectQuantity}
                onChange={(event) =>
                  setRejectQuantity(
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50"
              />
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              total > item.sisaQC
                ? "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Total diperiksa
              </span>

              <span className="text-lg font-bold text-slate-800">
                {formatNumber(total)} /{" "}
                {formatNumber(item.sisaQC)} pcs
              </span>
            </div>

            {total > item.sisaQC && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                Melebihi sisa QC.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Catatan
            </label>

            <textarea
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value,
                )
              }
              rows={3}
              placeholder="Catatan hasil QC (opsional)"
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={
                loading || !isValid
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              Simpan Hasil QC
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}