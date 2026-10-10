"use client";

import { ChangeEvent, useState } from "react";
import {
  Download,
  FileDown,
  FileUp,
  Loader2,
  X,
} from "lucide-react";

import PermissionGate from "@/components/auth/permission-gate";

type MasterDataResource =
  | "products"
  | "tailors"
  | "employees"
  | "transaction-types"
  | "workflows";

type ImportError = {
  row: number;
  code?: string;
  name?: string;
  message: string;
};

type ImportResponse = {
  success: boolean;
  error?: string;
  data?: {
    totalRows: number;
    imported: number;
    skippedOrFailed: number;
    errors: ImportError[];
    errorsTruncated: boolean;
  };
};

type MasterDataImportExportProps = {
  resource: MasterDataResource;
  viewPermission: string;
  managePermission: string;
  onImported: () => Promise<void>;
};

const buttonClass =
  "inline-flex h-10 min-w-0 max-w-full shrink-0 items-center " +
  "justify-center gap-2 rounded-xl border border-slate-200 " +
  "bg-white px-3.5 text-sm font-semibold text-slate-600 " +
  "transition hover:border-indigo-200 hover:bg-indigo-50 " +
  "hover:text-indigo-600 disabled:cursor-not-allowed " +
  "disabled:opacity-50";

const resourceLabels: Record<MasterDataResource, string> = {
  products: "product",
  tailors: "tailor",
  employees: "employee",
  "transaction-types": "transaction type",
  workflows: "workflow",
};

export default function MasterDataImportExport({
  resource,
  viewPermission,
  managePermission,
  onImported,
}: MasterDataImportExportProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const [importMessage, setImportMessage] = useState("");
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [errorsTruncated, setErrorsTruncated] = useState(false);

  const [error, setError] = useState("");

  const resourceLabel = resourceLabels[resource];

  const exportFilename = `${resource}.xlsx`;
  const templateFilename = `${resource}-import-template.xlsx`;

  const busy = importing || exporting || downloadingTemplate;

  async function downloadFile(
    endpoint: string,
    filename: string
  ): Promise<void> {
    const response = await fetch(endpoint, {
      cache: "no-store",
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);

      throw new Error(
        result?.error || `Gagal mengunduh ${filename}.`
      );
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Beri waktu browser memulai download sebelum URL dibersihkan.
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  async function handleExport(): Promise<void> {
    try {
      setError("");
      setImportMessage("");
      setImportErrors([]);
      setExporting(true);

      await downloadFile(
        `/api/${resource}/export`,
        exportFilename
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Gagal export ${resourceLabel}.`
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadTemplate(): Promise<void> {
    try {
      setError("");
      setImportMessage("");
      setImportErrors([]);
      setDownloadingTemplate(true);

      await downloadFile(
        `/api/${resource}/template`,
        templateFilename
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengunduh template."
      );
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function handleImport(
    event: ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    try {
      setImporting(true);
      setError("");
      setImportMessage("");
      setImportErrors([]);
      setErrorsTruncated(false);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/${resource}/import`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result: ImportResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(
          result.error || `Gagal import ${resourceLabel}.`
        );
      }

      const {
        totalRows,
        imported,
        skippedOrFailed,
        errors,
        errorsTruncated: truncated,
      } = result.data;

      setImportMessage(
        `Import selesai: ${imported} ${resourceLabel} berhasil ditambahkan. ` +
          `${skippedOrFailed} baris dilewati atau gagal dari ${totalRows} baris.`
      );

      setImportErrors(errors ?? []);
      setErrorsTruncated(truncated ?? false);

      // Refresh tabel setelah API mengembalikan hasil import.
      await onImported();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Gagal import ${resourceLabel}.`
      );
    } finally {
      setImporting(false);
      input.value = "";
    }
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-3">
      {/* Baris tombol: dapat membungkus pada layar kecil */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <PermissionGate permission={viewPermission}>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={busy}
            className={buttonClass}
          >
            {exporting ? (
              <Loader2
                size={16}
                className="shrink-0 animate-spin"
              />
            ) : (
              <FileDown size={16} className="shrink-0" />
            )}

            <span>
              {exporting ? "Exporting..." : "Export"}
            </span>
          </button>
        </PermissionGate>

        <PermissionGate permission={managePermission}>
          <button
            type="button"
            onClick={() => void handleDownloadTemplate()}
            disabled={busy}
            className={buttonClass}
          >
            {downloadingTemplate ? (
              <Loader2
                size={16}
                className="shrink-0 animate-spin"
              />
            ) : (
              <Download size={16} className="shrink-0" />
            )}

            <span>
              {downloadingTemplate
                ? "Downloading..."
                : "Download Template"}
            </span>
          </button>

          <label
            className={`${buttonClass} ${
              busy
                ? "pointer-events-none cursor-not-allowed"
                : "cursor-pointer"
            }`}
          >
            {importing ? (
              <Loader2
                size={16}
                className="shrink-0 animate-spin"
              />
            ) : (
              <FileUp size={16} className="shrink-0" />
            )}

            <span>
              {importing ? "Importing..." : "Import"}
            </span>

            <input
              type="file"
              accept=".xlsx"
              onChange={(event) => void handleImport(event)}
              disabled={busy}
              className="hidden"
            />
          </label>
        </PermissionGate>
      </div>

      {/* Error umum */}
      {error && (
        <div
          role="alert"
          className="flex min-w-0 items-start gap-3 overflow-hidden rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Operasi gagal</p>

            <p className="mt-1 break-words [overflow-wrap:anywhere]">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            className="shrink-0 rounded-lg p-1 text-rose-500 hover:bg-rose-100"
            aria-label="Tutup pesan error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Hasil import */}
      {importMessage && (
        <div
          role="status"
          aria-live="polite"
          className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 sm:p-4"
        >
          <div className="min-w-0">
            <p className="break-words font-semibold [overflow-wrap:anywhere]">
              {importMessage}
            </p>

            {importErrors.length > 0 && (
              <div className="mt-3 min-w-0">
                <p className="mb-2 font-semibold">
                  Detail baris yang bermasalah:
                </p>

                <div className="max-h-52 space-y-1 overflow-y-auto overflow-x-hidden rounded-lg border border-emerald-200/70 bg-white/60 p-2 sm:p-3">
                  {importErrors.map((item, index) => {
                    const identifier =
                      item.code || item.name || "(tanpa identitas)";

                    return (
                      <p
                        key={`${item.row}-${identifier}-${index}`}
                        className="break-words py-1 [overflow-wrap:anywhere]"
                      >
                        Baris {item.row} — {identifier}:{" "}
                        {item.message}
                      </p>
                    );
                  })}
                </div>

                {errorsTruncated && (
                  <p className="mt-2 break-words text-xs font-medium [overflow-wrap:anywhere]">
                    Sebagian detail error tidak ditampilkan. Periksa
                    file Excel dan hasil validasi API.
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setImportMessage("");
              setImportErrors([]);
              setErrorsTruncated(false);
            }}
            className="mt-3 text-xs font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
          >
            Tutup notifikasi
          </button>
        </div>
      )}
    </div>
  );
}