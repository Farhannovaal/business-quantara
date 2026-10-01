"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  X,
} from "lucide-react";

import type {
  QCItem,
  QCTimelineItem,
} from "@/lib/qc/types";

import {
  formatDate,
  formatNumber,
} from "@/lib/qc/utils";

type Props = {
  item: QCItem;
  onClose: () => void;
};

export default function QCDetailModal({
  item,
  onClose,
}: Props) {
  const [timeline, setTimeline] =
    useState<QCTimelineItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/qc/${item.spkId}`,
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
              "Gagal mengambil detail QC.",
          );
        }

        setTimeline(
          result.data.timeline ?? [],
        );
      } catch (error) {
        console.error(
          "Load QC detail error:",
          error,
        );

        setError(
          error instanceof Error
            ? error.message
            : "Gagal mengambil detail QC.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [item.spkId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              QC Detail
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-800">
              {item.spkNumber}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {item.product.name} ·{" "}
              {item.tailor.name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="max-h-[calc(90vh-100px)] overflow-y-auto px-6 py-6">

          {/* SUMMARY */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <DetailMetric
              label="Diterima"
              value={item.totalDiterima}
            />

            <DetailMetric
              label="Sudah QC"
              value={item.totalSudahQC}
            />

            <DetailMetric
              label="ACC"
              value={item.totalAcc}
              valueClassName="text-emerald-600"
            />

            <DetailMetric
              label="Rijek"
              value={item.totalRijek}
              valueClassName="text-rose-600"
            />

            <DetailMetric
              label="Sisa QC"
              value={item.sisaQC}
              valueClassName={
                item.sisaQC > 0
                  ? "text-amber-600"
                  : "text-emerald-600"
              }
            />
          </div>

          {/* PROGRESS */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Progress QC
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {formatNumber(
                    item.totalSudahQC,
                  )}{" "}
                  dari{" "}
                  {formatNumber(
                    item.totalDiterima,
                  )}{" "}
                  pcs sudah memiliki
                  keputusan
                </p>
              </div>

              <p className="shrink-0 text-lg font-bold text-indigo-600">
                {item.progressPercentage}%
              </p>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all"
                style={{
                  width: `${Math.min(
                    item.progressPercentage,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* LAST QC */}
          {item.lastQC && (
            <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                QC Terakhir
              </p>

              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">
                    PIC QC
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {item.lastQC.employee}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Jumlah
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {formatNumber(
                      item.lastQC.quantity,
                    )}{" "}
                    pcs
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Waktu
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {formatDate(
                      item.lastQC.createdAt,
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TIMELINE */}
          <div className="mt-6">
            <div className="mb-4">
              <h3 className="font-semibold text-slate-800">
                Timeline Proses
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                Riwayat perjalanan barang
                pada SPK ini
              </p>
            </div>

            {loading ? (
              <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />

                Memuat timeline...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : timeline.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <p className="text-sm text-slate-400">
                  Belum ada transaksi.
                </p>
              </div>
            ) : (
              <div className="relative ml-2 border-l border-slate-200">
                {timeline.map(
                  (transaction) => (
                    <div
                      key={transaction.id}
                      className="relative pb-6 pl-7 last:pb-0"
                    >
                      {/* DOT */}
                      <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 shadow" />

                      {/* CARD */}
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {
                                transaction.typeName
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {
                                transaction.transactionNumber
                              }
                            </p>
                          </div>

                          <span className="w-fit rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {formatNumber(
                              transaction.quantity,
                            )}{" "}
                            pcs
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                          <span>
                            PIC:{" "}
                            <strong className="font-semibold text-slate-700">
                              {
                                transaction.employee
                              }
                            </strong>
                          </span>

                          <span>
                            {formatDate(
                              transaction.createdAt,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailMetric({
  label,
  value,
  valueClassName = "text-slate-800",
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-lg font-bold ${valueClassName}`}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}