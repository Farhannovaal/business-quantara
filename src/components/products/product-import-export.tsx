
"use client";

import { ChangeEvent, useState } from "react";
import {
  Download,
  FileDown,
  FileUp,
  Loader2,
} from "lucide-react";

import PermissionGate from "@/components/auth/permission-gate";

type ImportError = {
  row: number;
  code: string;
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

type ProductImportExportProps = {
  onImported: () => Promise<void>;
};

const buttonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl " +
  "border border-slate-200 bg-white px-3.5 text-sm font-semibold " +
  "text-slate-600 transition hover:border-indigo-200 " +
  "hover:bg-indigo-50 hover:text-indigo-600 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export default function ProductImportExport({
  onImported,
}: ProductImportExportProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [errorsTruncated, setErrorsTruncated] = useState(false);
  const [error, setError] = useState("");

  async function downloadFile(
    endpoint: string,
    filename: string
  ) {
    const response = await fetch(endpoint, {
      cache: "no-store",
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(
        result?.error || `Gagal mengunduh ${filename}`
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
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleExport() {
    try {
      setError("");
      setExporting(true);

      await downloadFile(
        "/api/products/export",
        "products.xlsx"
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal export product"
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadTemplate() {
    try {
      setError("");
      setDownloadingTemplate(true);

      await downloadFile(
        "/api/products/template",
        "product-import-template.xlsx"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengunduh template"
      );
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function handleImport(
    event: ChangeEvent<HTMLInputElement>
  ) {
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

      const response = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      });

      const result: ImportResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Gagal import product");
      }

      setImportMessage(
        `Import selesai: ${result.data.imported} product berhasil ditambahkan. ` +
        `${result.data.skippedOrFailed} baris dilewati atau gagal.`
      );

      setImportErrors(result.data.errors ?? []);
      setErrorsTruncated(result.data.errorsTruncated ?? false);

      // Refresh tabel setelah API mengembalikan hasil sukses.
      await onImported();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal import product"
      );
    } finally {
      setImporting(false);
      input.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PermissionGate permission="product.view">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className={buttonClass}
        >
          {exporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileDown size={16} />
          )}
          <span>{exporting ? "Exporting..." : "Export"}</span>
        </button>
      </PermissionGate>

      <PermissionGate permission="product.manage">
        <button
          type="button"
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate || importing}
          className={buttonClass}
        >
          {downloadingTemplate ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          <span>
            {downloadingTemplate ? "Downloading..." : "Download Template"}
          </span>
        </button>

        <label
          className={`${buttonClass} ${
            importing ? "pointer-events-none" : "cursor-pointer"
          }`}
        >
          {importing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileUp size={16} />
          )}
          <span>{importing ? "Importing..." : "Import"}</span>

          <input
            type="file"
            accept=".xlsx"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
        </label>
      </PermissionGate>

      {error && (
        <p role="alert" className="w-full text-sm text-rose-600">
          {error}
        </p>
      )}

      {importMessage && (
        <div
          role="status"
          className="w-full rounded-xl border border-emerald-200
            bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <p className="font-semibold">{importMessage}</p>

          {importErrors.length > 0 && (
            <div className="mt-3 max-h-52 overflow-auto">
              <p className="mb-2 font-semibold">
                Detail baris yang bermasalah:
              </p>

              {importErrors.map((item, index) => (
                <p
                  key={`${item.row}-${item.code}-${index}`}
                  className="py-1"
                >
                  Baris {item.row} — {item.code || "(tanpa kode)"}:{" "}
                  {item.message}
                </p>
              ))}

              {errorsTruncated && (
                <p className="mt-2 font-medium">
                  Sebagian detail error tidak ditampilkan.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
