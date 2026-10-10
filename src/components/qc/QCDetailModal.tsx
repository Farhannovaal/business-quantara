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

    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">

      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-[#151515] shadow-2xl">


        <div className="flex items-start justify-between border-b border-[#303030] px-6 py-5">

          <div>

            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">

              QC Detail

            </p>

            <h2 className="mt-1 text-xl font-bold text-gray-100">

              {item.spkNumber}

            </h2>

            <p className="mt-1 text-sm text-gray-400">

              {item.product.name} ·{" "}

              {item.tailor.name}

            </p>

          </div>

          <button

            type="button"

            onClick={onClose}

            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-[#292929] hover:text-gray-200"

            aria-label="Tutup"

          >

            <X className="h-5 w-5" />

          </button>

        </div>


        <div className="max-h-[calc(90vh-100px)] overflow-y-auto px-6 py-6">


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

              valueClassName="text-emerald-400"

            />

            <DetailMetric

              label="Rijek"

              value={item.totalRijek}

              valueClassName="text-rose-400"

            />

            <DetailMetric

              label="Sisa QC"

              value={item.sisaQC}

              valueClassName={

                item.sisaQC > 0

                  ? "text-amber-300"

                  : "text-emerald-400"

              }

            />

          </div>


          <div className="mt-5 rounded-2xl border border-[#353535] bg-[#1c1c1c] p-5">

            <div className="flex items-center justify-between gap-4">

              <div>

                <p className="text-sm font-semibold text-gray-200">

                  Progress QC

                </p>

                <p className="mt-1 text-xs text-gray-500">

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

              <p className="shrink-0 text-lg font-bold text-red-400">

                {item.progressPercentage}%

              </p>

            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#151515]">

              <div

                className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-500 transition-all"

                style={{

                  width: `${Math.min(

                    item.progressPercentage,

                    100,

                  )}%`,

                }}

              />

            </div>

          </div>


          {item.lastQC && (

            <div className="mt-5 rounded-2xl border border-red-900/60 bg-red-950/20 p-5">

              <p className="text-xs font-semibold uppercase tracking-wider text-red-400">

                QC Terakhir

              </p>

              <div className="mt-3 grid gap-4 sm:grid-cols-3">

                <div>

                  <p className="text-xs text-gray-500">

                    PIC QC

                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-200">

                    {item.lastQC.employee}

                  </p>

                </div>

                <div>

                  <p className="text-xs text-gray-500">

                    Jumlah

                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-200">

                    {formatNumber(

                      item.lastQC.quantity,

                    )}{" "}

                    pcs

                  </p>

                </div>

                <div>

                  <p className="text-xs text-gray-500">

                    Waktu

                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-200">

                    {formatDate(

                      item.lastQC.createdAt,

                    )}

                  </p>

                </div>

              </div>

            </div>

          )}


          <div className="mt-6">

            <div className="mb-4">

              <h3 className="font-semibold text-gray-100">

                Timeline Proses

              </h3>

              <p className="mt-1 text-xs text-gray-500">

                Riwayat perjalanan barang

                pada SPK ini

              </p>

            </div>

            {loading ? (

              <div className="flex items-center gap-3 py-8 text-sm text-gray-400">

                <Loader2 className="h-5 w-5 animate-spin text-red-400" />

                Memuat timeline...

              </div>

            ) : error ? (

              <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">

                {error}

              </div>

            ) : timeline.length === 0 ? (

              <div className="rounded-xl border border-dashed border-[#353535] bg-[#1c1c1c] px-4 py-8 text-center">

                <p className="text-sm text-gray-500">

                  Belum ada transaksi.

                </p>

              </div>

            ) : (

              <div className="relative ml-2 border-l border-[#353535]">

                {timeline.map(

                  (transaction) => (

                    <div

                      key={transaction.id}

                      className="relative pb-6 pl-7 last:pb-0"

                    >


                      <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-[#303030] bg-red-950/300 shadow" />

                      <div className="rounded-xl border border-[#353535] bg-[#151515] p-4">

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                          <div>

                            <p className="text-sm font-semibold text-gray-100">

                              {

                                transaction.typeName

                              }

                            </p>

                            <p className="mt-1 text-xs text-gray-500">

                              {

                                transaction.transactionNumber

                              }

                            </p>

                          </div>

                          <span className="w-fit rounded-lg bg-[#292929] px-2.5 py-1 text-xs font-bold text-gray-200">

                            {formatNumber(

                              transaction.quantity,

                            )}{" "}

                            pcs

                          </span>

                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">

                          <span>

                            PIC:{" "}

                            <strong className="font-semibold text-gray-200">

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

  valueClassName = "text-gray-100",

}: {

  label: string;

  value: number;

  valueClassName?: string;

}) {

  return (

    <div className="rounded-xl border border-[#353535] bg-[#151515] p-4">

      <p className="text-xs font-medium text-gray-500">

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
