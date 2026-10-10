"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import QCDetailModal from "@/components/qc/QCDetailModal";
import QCProcessModal from "@/components/qc/QCProcessModal";
import QCSummaryCard from "@/components/qc/QCSummaryCard";
import QCStatusBadge from "@/components/qc/QCStatusBadge";
import type {
  QCItem,
  QCResponse,
  QCSummary,
  StatusFilter,
} from "@/lib/qc/types";
import { formatNumber } from "@/lib/qc/utils";
export default function QualityControlPage() {
  const [items, setItems] = useState<QCItem[]>([]);
  const [summary, setSummary] =
    useState<QCSummary | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState("");
  const [search, setSearch] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");
  const [selectedItem, setSelectedItem] =
    useState<QCItem | null>(null);
  const [processItem, setProcessItem] =
    useState<QCItem | null>(null);
  async function loadData(
    showRefresh = false,
  ) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set(
          "search",
          search.trim(),
        );
      }
      if (statusFilter !== "ALL") {
        params.set(
          "status",
          statusFilter,
        );
      }
      const queryString =
        params.toString();
      const response = await fetch(
        `/api/qc${
          queryString
            ? `?${queryString}`
            : ""
        }`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const result =
        (await response.json()) as QCResponse;
      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "Gagal mengambil data QC.",
        );
      }
      setItems(result.data.items);
      setSummary(result.data.summary);
    } catch (error) {
      console.error(
        "Load QC data error:",
        error,
      );
      setError(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data QC.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData();
    }, 250);
    return () =>
      clearTimeout(timeout);
  }, [search, statusFilter]);
  const filteredItems = useMemo(() => {
    return items;
  }, [items]);
  return (
    <main className="min-h-screen w-full bg-[#111111]">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-700 to-red-500 text-white shadow-lg shadow-red-950/30">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Quality Control
                </h1>
                <p className="mt-0.5 text-sm text-gray-400">
                  Monitoring proses pemeriksaan
                  barang dari penjahit
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              loadData(true)
            }
            disabled={
              loading || refreshing
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#333333] bg-[#171717] px-4 text-sm font-semibold text-gray-200 shadow-sm transition hover:border-red-700 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </button>
        </div>
        {/* SUMMARY */}
        {summary && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QCSummaryCard
              title="Menunggu QC"
              value={summary.sisaQC}
              subtitle={`${summary.waiting} SPK`}
              icon={Clock3}
              iconClassName="bg-amber-950/30 text-amber-400"
            />
            <QCSummaryCard
              title="Sudah Diperiksa"
              value={summary.totalSudahQC}
              subtitle={`${summary.inProgress} SPK sedang berjalan`}
              icon={ShieldCheck}
              iconClassName="bg-cyan-950/30 text-cyan-400"
            />
            <QCSummaryCard
              title="QC ACC"
              value={summary.totalAcc}
              subtitle="Barang diterima"
              icon={CheckCircle2}
              iconClassName="bg-emerald-950/30 text-emerald-400"
            />
            <QCSummaryCard
              title="QC Rijek"
              value={summary.totalRijek}
              subtitle="Barang perlu rework"
              icon={XCircle}
              iconClassName="bg-rose-950/30 text-rose-400"
            />
          </div>
        )}
        {/* FILTER */}
        <div className="mb-4 rounded-2xl border border-[#333333] bg-[#171717] p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Cari SPK, produk, atau penjahit..."
                className="h-11 w-full rounded-xl border border-[#333333] bg-[#111111] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-red-500 focus:bg-[#171717] focus:ring-4 focus:ring-red-950/40"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as StatusFilter,
                )
              }
              className="h-11 rounded-xl border border-[#333333] bg-[#171717] px-4 text-sm font-medium text-gray-200 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-950/40"
            >
              <option value="ALL">
                Semua Status
              </option>
              <option value="WAITING">
                Menunggu QC
              </option>
              <option value="IN_PROGRESS">
                Sedang QC
              </option>
              <option value="COMPLETED">
                Selesai
              </option>
            </select>
          </div>
        </div>
        {/* ERROR */}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-900 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}
        {/* TABLE */}
        <div className="overflow-hidden rounded-2xl border border-[#333333] bg-[#171717] shadow-sm">
          <div className="border-b border-[#2a2a2a] px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white">
                  Monitoring QC
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {filteredItems.length} SPK
                </p>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                Memuat data QC...
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#262626]">
                <PackageCheck className="h-6 w-6 text-gray-500" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-gray-200">
                Tidak ada data QC
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                Belum ada barang yang
                diterima dari penjahit atau
                tidak ada data yang sesuai
                filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead>
                  <tr className="border-b border-[#2a2a2a] bg-[#1a1a1a]">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      SPK
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Produk
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Penjahit
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Diterima
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Sudah QC
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      ACC
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-rose-400">
                      Rijek
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Progress
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Status
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a]">
                  {filteredItems.map(
                    (item) => (
                      <tr
                        key={item.spkId}
                        className="group transition hover:bg-[#1a1a1a]"
                      >
                        {/* SPK */}
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-white">
                            {item.spkNumber}
                          </p>
                        </td>
                        {/* PRODUCT */}
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-200">
                            {item.product.name}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {item.product.code}
                          </p>
                        </td>
                        {/* TAILOR */}
                        <td className="px-5 py-4">
                          <p className="text-sm text-gray-200">
                            {item.tailor.name}
                          </p>
                        </td>
                        {/* DITERIMA */}
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-white">
                            {formatNumber(
                              item.totalDiterima,
                            )}
                          </span>
                        </td>
                        {/* SUDAH QC */}
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-cyan-300">
                            {formatNumber(
                              item.totalSudahQC,
                            )}
                          </span>
                        </td>
                        {/* ACC */}
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-emerald-400">
                            {formatNumber(
                              item.totalAcc,
                            )}
                          </span>
                        </td>
                        {/* RIJEK */}
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-rose-400">
                            {formatNumber(
                              item.totalRijek,
                            )}
                          </span>
                        </td>
                        {/* PROGRESS */}
                        <td className="px-5 py-4">
                          <div className="w-32">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-gray-300">
                                {
                                  item.progressPercentage
                                }
                                %
                              </span>
                              <span className="text-[11px] text-gray-500">
                                {formatNumber(
                                  item.sisaQC,
                                )}{" "}
                                sisa
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-[#262626]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-500 transition-all"
                                style={{
                                  width: `${item.progressPercentage}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        {/* STATUS */}
                        <td className="px-5 py-4">
                          <QCStatusBadge
                            status={item.status}
                          />
                        </td>
                        {/* ACTION */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {item.sisaQC > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setProcessItem(
                                    item,
                                  )
                                }
                                className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700"
                              >
                                Proses QC
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedItem(
                                  item,
                                )
                              }
                              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-red-400 transition hover:bg-red-950/30"
                            >
                              Detail
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* DETAIL MODAL */}
      {selectedItem && (
        <QCDetailModal
          item={selectedItem}
          onClose={() =>
            setSelectedItem(null)
          }
        />
      )}
      {/* PROCESS QC MODAL */}
      {processItem && (
        <QCProcessModal
          item={processItem}
          onClose={() =>
            setProcessItem(null)
          }
          onSuccess={() =>
            loadData(true)
          }
        />
      )}
    </main>
  );
}