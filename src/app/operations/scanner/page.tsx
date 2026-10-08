"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  History,
  Package,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import QrBarcodeScanner from "@/components/scanner/QrBarcodeScanner";
import OcrScanner from "@/components/scanner/OcrScanner";

type ScannerSource =
  | "QR"
  | "BARCODE"
  | "OCR"
  | "MANUAL";

type ScannerMode = "QR" | "OCR";

type GeminiOcrData = {
  documentNumber: string | null;
  date: string | null;
  spkNumber: string | null;
  transactionType: string | null;
  productCode: string | null;
  productName: string | null;
  tailorName: string | null;
  employeeName: string | null;
  quantity: number | null;
  unit: string | null;
};

type ScanStatus =
  | "PENDING"
  | "VALID"
  | "INVALID"
  | "PROCESSED"
  | "DUPLICATE"
  | "REVIEW_REQUIRED";

type Product = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

type Tailor = {
  id: number;
  code?: string;
  name: string;
  isActive: boolean;
};

type Employee = {
  id: number;
  code?: string;
  name: string;
  isActive: boolean;
};

type TransactionType = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  sequence: number;
  isActive: boolean;
};

type SPKSummary = {
  totalPengiriman: number;
  totalPenerimaan: number;
  totalQcRijek: number;
  totalQcAcc: number;
  totalPengirimanRijek: number;
  totalPenerimaanRijek: number;

  sisaJahit: number;
  barangDiQc: number;
  jumlahRijek: number;
  jumlahBarang: number;

  nextTransactionTypes: string[];
};

type SPKProductItem = {
  id: number;
  productId: number;
  quantity: number;
  product: Product;
};

type SPKProductSummary = {
  productId: number;
  product: Product;
  quantity: number;
  summary: SPKSummary;
};

type SPK = {
  id: number;
  spkNumber: string;
  status: string;
  items: SPKProductItem[];
  tailor: Tailor;
  summary: SPKSummary;
  productSummaries: SPKProductSummary[];
};

type ScannedDocument = {
  id: number;
  documentNumber: string;
  documentType?: string | null;
  source: ScannerSource;
  status: ScanStatus;
  scannedAt?: string;
  processedAt?: string | null;
};

type TransactionResult = {
  id: number;
  transactionNumber: string;
  quantity: number;
  createdAt: string;

  transactionType: TransactionType;

  spk: {
    id: number;
    spkNumber: string;
    status?: string;
    product?: Product;
    tailor?: Tailor;
  };

  product: Product;

  tailor: Tailor;

  employee: Employee;
};

const TRANSACTION_LABELS: Record<
  string,
  string
> = {
  PENGIRIMAN_SIAP_JAHIT:
    "Pengiriman Siap Jahit",

  PENERIMAAN_DARI_PENJAHIT:
    "Penerimaan dari Penjahit",

  QUALITY_CONTROL:
    "Quality Control",

  QC_RIJEK:
    "QC / Rijek",

  QC_ACC_DIKIRIM_KE_GUDANG:
    "QC / ACC dikirim ke Gudang",

  PENGIRIMAN_RIJEK:
    "Pengiriman Rijek",

  PENERIMAAN_RIJEK:
    "Penerimaan Rijek",
};

function getTransactionLabel(
  code: string,
  fallback?: string,
) {
  return (
    TRANSACTION_LABELS[code] ??
    fallback ??
    code
  );
}

function getMaxQuantity(
  productQuantity: number,
  summary: SPKSummary,
  transactionTypeCode: string,
): number | null {
  switch (transactionTypeCode) {
    case "PENGIRIMAN_SIAP_JAHIT":
      return Math.max(productQuantity - summary.totalPengiriman, 0);
    case "PENERIMAAN_DARI_PENJAHIT":
      return summary.sisaJahit;
    case "QUALITY_CONTROL":
    case "QC_RIJEK":
    case "QC_ACC_DIKIRIM_KE_GUDANG":
      return summary.barangDiQc;
    case "PENGIRIMAN_RIJEK":
      return Math.max(summary.totalQcRijek - summary.totalPengirimanRijek, 0);
    case "PENERIMAAN_RIJEK":
      return Math.max(summary.totalPengirimanRijek - summary.totalPenerimaanRijek, 0);
    default:
      return null;
  }
}

function formatDate(
  value?: string | null,
) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusStyle(
  status: ScanStatus,
) {
  switch (status) {
    case "PROCESSED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "VALID":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";

    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "DUPLICATE":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "INVALID":
      return "border-rose-200 bg-rose-50 text-rose-700";

    case "REVIEW_REQUIRED":
      return "border-orange-200 bg-orange-50 text-orange-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function ScannerPage() {
  /*
   * ============================================================
   * AUTH / PERMISSION
   * ============================================================
   */

  const [permissions, setPermissions] =
    useState<string[]>([]);

  const [authLoading, setAuthLoading] =
    useState(true);

  /*
   * ============================================================
   * INITIAL DATA
   * ============================================================
   */

  const [spks, setSpks] = useState<SPK[]>(
    [],
  );

  const [
    transactionTypes,
    setTransactionTypes,
  ] = useState<TransactionType[]>([]);

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [loadingInitialData, setLoadingInitialData] =
    useState(true);

  /*
   * ============================================================
   * SCANNER
   * ============================================================
   */

  const [documentNumber, setDocumentNumber] =
    useState("");

  const [scannerSource, setScannerSource] =
    useState<ScannerSource>("MANUAL");

  const [scanningDocument, setScanningDocument] =
    useState(false);

  const [showCamera, setShowCamera] =
    useState(true);

  const [scannerMode, setScannerMode] =
    useState<ScannerMode>("QR");

  const [isDuplicate, setIsDuplicate] =
    useState(false);

  const [
    scannedDocument,
    setScannedDocument,
  ] =
    useState<ScannedDocument | null>(null);

  const [
    scanMessage,
    setScanMessage,
  ] = useState("");

  /*
   * ============================================================
   * GEMINI OCR
   * ============================================================
   */

  const [aiOcrData, setAiOcrData] =
    useState<GeminiOcrData | null>(null);

  const [aiMatchMessage, setAiMatchMessage] =
    useState("");

  const [aiMatchStatus, setAiMatchStatus] =
    useState<
      "IDLE" | "MATCHED" | "PARTIAL" | "NOT_FOUND"
    >("IDLE");

  const aiAutoFillRef = useRef(false);

  /*
   * ============================================================
   * FORM
   * ============================================================
   */

  const [selectedSpkId, setSelectedSpkId] =
    useState("");

  const [selectedSpk, setSelectedSpk] =
    useState<SPK | null>(null);

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [
    selectedTypeId,
    setSelectedTypeId,
  ] = useState("");

  const [
    selectedEmployeeId,
    setSelectedEmployeeId,
  ] = useState("");

  const [quantity, setQuantity] =
    useState("");

  const [searchSpk, setSearchSpk] =
    useState("");

  /*
   * ============================================================
   * SUBMIT / PREVIEW
   * ============================================================
   */

  const [
    showPreview,
    setShowPreview,
  ] = useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [success, setSuccess] =
    useState("");

  const [error, setError] =
    useState("");

  const [
    processedTransaction,
    setProcessedTransaction,
  ] =
    useState<TransactionResult | null>(
      null,
    );

  /*
   * ============================================================
   * LOAD AUTH
   * ============================================================
   */

  async function loadAuth() {
    try {
      setAuthLoading(true);

      const response = await fetch(
        "/api/auth/me",
        {
          credentials: "include",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        setPermissions([]);
        return;
      }

      const result =
        await response.json();

      setPermissions(
        result.user?.permissions ?? [],
      );
    } catch (err) {
      console.error(
        "Failed to load auth:",
        err,
      );

      setPermissions([]);
    } finally {
      setAuthLoading(false);
    }
  }

  /*
   * ============================================================
   * LOAD INITIAL DATA
   * ============================================================
   */

  async function loadInitialData() {
    try {
      setLoadingInitialData(true);
      setError("");

      const [
        spkResponse,
        typeResponse,
        employeeResponse,
      ] = await Promise.all([
        fetch("/api/spks"),
        fetch("/api/transaction-types"),
        fetch("/api/employees"),
      ]);

      const [
        spkJson,
        typeJson,
        employeeJson,
      ] = await Promise.all([
        spkResponse.json(),
        typeResponse.json(),
        employeeResponse.json(),
      ]);

      if (!spkResponse.ok) {
        throw new Error(
          spkJson.error ??
            "Gagal mengambil data SPK.",
        );
      }

      if (!typeResponse.ok) {
        throw new Error(
          typeJson.error ??
            "Gagal mengambil transaction type.",
        );
      }

      if (!employeeResponse.ok) {
        throw new Error(
          employeeJson.error ??
            "Gagal mengambil data employee.",
        );
      }

      setSpks(
        spkJson.data ?? [],
      );

      setTransactionTypes(
        (typeJson.data ?? []).filter(
          (item: TransactionType) =>
            item.isActive,
        ),
      );

      setEmployees(
        (employeeJson.data ?? []).filter(
          (item: Employee) =>
            item.isActive,
        ),
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data.",
      );
    } finally {
      setLoadingInitialData(false);
    }
  }

  useEffect(() => {
    loadAuth();
    loadInitialData();
  }, []);

  /*
   * ============================================================
   * PERMISSION
   * ============================================================
   */

  const canProcess =
    permissions.includes(
      "scanner.create",
    );

  /*
   * ============================================================
   * FILTER SPK
   * ============================================================
   */

  const filteredSpks = useMemo(() => {
    const keyword = searchSpk.trim().toLowerCase();
    if (!keyword) return spks;

    return spks.filter((spk) => {
      const matchesProduct = spk.items?.some(
        (item) =>
          item.product.name.toLowerCase().includes(keyword) ||
          item.product.code.toLowerCase().includes(keyword),
      );

      return (
        spk.spkNumber.toLowerCase().includes(keyword) ||
        matchesProduct ||
        spk.tailor.name.toLowerCase().includes(keyword)
      );
    });
  }, [spks, searchSpk]);

  const selectedProductSummary = useMemo(() => {
    if (!selectedSpk || !selectedProductId) return null;
    return selectedSpk.productSummaries?.find(
      (item) => String(item.productId) === selectedProductId,
    ) ?? null;
  }, [selectedSpk, selectedProductId]);

  const selectedProduct = useMemo(() => {
    if (!selectedSpk || !selectedProductId) return null;
    return selectedSpk.items.find(
      (item) => String(item.productId) === selectedProductId,
    )?.product ?? null;
  }, [selectedSpk, selectedProductId]);

  /*
   * ============================================================
   * SELECTED TRANSACTION TYPE
   * ============================================================
   */

  const selectedTransactionType =
    useMemo(() => {
      return transactionTypes.find(
        (type) =>
          String(type.id) ===
          selectedTypeId,
      );
    }, [
      transactionTypes,
      selectedTypeId,
    ]);

  /*
   * ============================================================
   * AVAILABLE TRANSACTION TYPES
   * ============================================================
   */

  const availableTransactionTypes = useMemo(() => {
    if (!selectedProductSummary) return [];
    const allowed = new Set(selectedProductSummary.summary.nextTransactionTypes);
    return transactionTypes
      .filter((type) => type.isActive && allowed.has(type.code))
      .sort((a, b) => a.sequence - b.sequence);
  }, [selectedProductSummary, transactionTypes]);

    /*
    * ============================================================
    * MAX QUANTITY
    * ============================================================
    */

  const maxQuantity = useMemo(() => {
    if (!selectedProductSummary || !selectedTransactionType) return null;
    return getMaxQuantity(
      selectedProductSummary.quantity,
      selectedProductSummary.summary,
      selectedTransactionType.code,
    );
  }, [selectedProductSummary, selectedTransactionType]);

  /*
   * ============================================================
   * LOAD SPK DETAIL
   * ============================================================
   */

  async function loadSpkDetail(
    id: string,
  ) {
    if (!id) {
      setSelectedSpk(null);
      setSelectedProductId("");
      setSelectedTypeId("");
      setQuantity("");
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `/api/spks/${id}`,
        {
          cache: "no-store",
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Gagal mengambil detail SPK.",
        );
      }

      /*
       * API SPK mengembalikan data
       * pada property data.
       */
      const spkData = result.data;

      setSelectedSpk(spkData);

      const preserveAiForm =
        aiAutoFillRef.current;

      aiAutoFillRef.current = false;

      if (!preserveAiForm) {
        setSelectedProductId("");
      }

      if (!preserveAiForm) {
        setSelectedTypeId("");
        setQuantity("");
      }
    } catch (err) {
      console.error(err);

      setSelectedSpk(null);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil detail SPK.",
      );
    }
  }

  useEffect(() => {
    loadSpkDetail(selectedSpkId);
  }, [selectedSpkId]);

  /*
   * ============================================================
   * RESET TRANSACTION FORM
   * ============================================================
   */

  function resetTransactionForm() {
    setSelectedSpkId("");
    setSelectedSpk(null);
    setSelectedProductId("");
    setSelectedTypeId("");
    setSelectedEmployeeId("");
    setQuantity("");
    setShowPreview(false);
  }

  /*
   * ============================================================
   * RESET SCANNER
   * ============================================================
   */

  function resetScanner() {
    setDocumentNumber("");
    setScannerSource("MANUAL");
    setScannerMode("QR");
    setIsDuplicate(false);

    setScannedDocument(null);
    setScanMessage("");

    setAiOcrData(null);
    setAiMatchMessage("");
    setAiMatchStatus("IDLE");
    aiAutoFillRef.current = false;

    setSuccess("");
    setError("");

    setProcessedTransaction(null);

    resetTransactionForm();
  }

  /*
   * ============================================================
   * VALIDATE DOCUMENT
   * ============================================================
   */

  async function validateDocument(
    value: string,
    source: ScannerSource,
  ) {
    const normalized =
      value.trim().toUpperCase();

    if (!normalized) {
      setError(
        "Nomor dokumen wajib diisi.",
      );

      return;
    }

    try {
      setScanningDocument(true);

      setError("");
      setSuccess("");
      setScanMessage("");

      setProcessedTransaction(null);
      setIsDuplicate(false);
      setShowPreview(false);

      const response = await fetch(
        "/api/scanner/validate",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            documentNumber:
              normalized,
            source,
          }),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Gagal melakukan validasi dokumen.",
        );
      }

      setDocumentNumber(
        normalized,
      );

      setScannerSource(source);

      /*
       * ========================================================
       * DUPLICATE / SUDAH DIPROSES
       * ========================================================
       */

      if (result.duplicate) {
        setIsDuplicate(true);

        setScannedDocument(
          result.document ??
            null,
        );

        setScanMessage(
          result.message ??
            "Dokumen sudah pernah diproses.",
        );

        if (result.transaction) {
          setProcessedTransaction(
            result.transaction,
          );
        }

        setSelectedSpkId("");
        setSelectedSpk(null);
        setSelectedTypeId("");
        setSelectedEmployeeId("");
        setQuantity("");

        return;
      }

      /*
       * ========================================================
       * DOCUMENT PENDING / VALID
       * ========================================================
       */

      setScannedDocument(
        result.document ??
          null,
      );

      setScanMessage(
        result.message ??
          "Dokumen berhasil dibaca.",
      );

      /*
       * Jangan otomatis membuat transaksi.
       *
       * Operator tetap harus memilih
       * SPK, transaction type, employee,
       * dan quantity.
       */
    } catch (err) {
      console.error(err);

      setScannedDocument(null);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal melakukan validasi dokumen.",
      );
    } finally {
      setScanningDocument(false);
    }
  }

  function normalizeMatchValue(
    value: string | null | undefined,
  ) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  /*
   * ============================================================
   * OCR RESULT
   * ============================================================
   */

  async function handleOcrResult(result: {
    text: string;
    documentNumber: string | null;
    aiData?: GeminiOcrData | null;
  }) {
    setError("");
    setSuccess("");
    setScanMessage("");
    setAiMatchMessage("");
    setAiMatchStatus("IDLE");

    /*
     * ========================================================
     * GEMINI STRUCTURED RESULT
     * ========================================================
     */
    if (result.aiData) {
      const ai = result.aiData;

      setAiOcrData(ai);
      setScannerSource("OCR");

      if (ai.documentNumber) {
        setDocumentNumber(
          ai.documentNumber.trim().toUpperCase(),
        );

        await validateDocument(
          ai.documentNumber,
          "OCR",
        );
      } else {
        setDocumentNumber("");
        setScanMessage(
          "Gemini berhasil membaca nota, tetapi nomor dokumen belum terbaca. Lengkapi nomor nota secara manual.",
        );
      }

      const normalizedSpk =
        normalizeMatchValue(ai.spkNumber);

      const matchedSpk = normalizedSpk
        ? spks.find(
            (spk) =>
              normalizeMatchValue(spk.spkNumber) ===
              normalizedSpk,
          )
        : undefined;

      const normalizedProductCode = normalizeMatchValue(ai.productCode);
      const normalizedProductName = normalizeMatchValue(ai.productName);

      const matchedProduct = matchedSpk
        ? matchedSpk.items.find((item) => {
            const codeMatch = normalizedProductCode &&
              normalizeMatchValue(item.product.code) === normalizedProductCode;
            const nameMatch = normalizedProductName &&
              normalizeMatchValue(item.product.name) === normalizedProductName;
            return Boolean(codeMatch || nameMatch);
          })
        : undefined;

      const normalizedType =
        normalizeMatchValue(ai.transactionType);

      const matchedTransactionType = normalizedType
        ? transactionTypes.find(
            (type) =>
              normalizeMatchValue(type.name) ===
                normalizedType ||
              normalizeMatchValue(type.code) ===
                normalizedType,
          )
        : undefined;

      const normalizedEmployee =
        normalizeMatchValue(ai.employeeName);

      const matchedEmployee = normalizedEmployee
        ? employees.find(
            (employee) =>
              normalizeMatchValue(employee.name) ===
              normalizedEmployee,
          )
        : undefined;

      if (matchedSpk) {
        aiAutoFillRef.current = true;
        setSelectedSpkId(String(matchedSpk.id));
        setSelectedSpk(matchedSpk);
      } else {
        aiAutoFillRef.current = false;
        setSelectedSpkId("");
        setSelectedSpk(null);
        setSelectedProductId("");
        setSelectedTypeId("");
      }

      if (matchedProduct && matchedSpk) {
        setSelectedProductId(String(matchedProduct.productId));
      } else if (matchedSpk) {
        setSelectedProductId("");
      }

      if (matchedTransactionType && matchedSpk) {
        const matchedProductSummary = matchedProduct
          ? matchedSpk.productSummaries?.find(
              (item) => item.productId === matchedProduct.productId,
            )
          : null;

        const isAllowed = Boolean(
          matchedProductSummary?.summary.nextTransactionTypes.includes(
            matchedTransactionType.code,
          ),
        );

        if (isAllowed) {
          setSelectedTypeId(
            String(matchedTransactionType.id),
          );
        } else {
          setSelectedTypeId("");
          setAiMatchMessage(
            `Proses "${matchedTransactionType.name}" terbaca dari nota, tetapi belum diperbolehkan untuk ${matchedSpk.spkNumber}.`,
          );
        }
      } else {
        setSelectedTypeId("");
      }

      if (matchedEmployee) {
        setSelectedEmployeeId(
          String(matchedEmployee.id),
        );
      } else {
        setSelectedEmployeeId("");
      }

      if (
        ai.quantity !== null &&
        Number.isInteger(ai.quantity) &&
        ai.quantity > 0
      ) {
        setQuantity(String(ai.quantity));
      } else {
        setQuantity("");
      }

      const spkMatched = Boolean(matchedSpk);
      const productExpected = Boolean(ai.productCode || ai.productName);
      const productMatched = Boolean(matchedProduct);
      const typeMatched = Boolean(matchedTransactionType);
      const employeeExpected = Boolean(ai.employeeName);
      const employeeMatched = Boolean(matchedEmployee);

      if (
        spkMatched &&
        (!productExpected || productMatched) &&
        typeMatched &&
        (!employeeExpected || employeeMatched)
      ) {
        setAiMatchStatus("MATCHED");
        setAiMatchMessage(
          "Data Gemini berhasil dicocokkan dengan Master Data.",
        );
      } else if (spkMatched || productMatched || typeMatched || employeeMatched) {
        setAiMatchStatus("PARTIAL");
        setAiMatchMessage(
          "Sebagian data berhasil dicocokkan. Periksa field yang belum ditemukan sebelum melanjutkan.",
        );
      } else {
        setAiMatchStatus("NOT_FOUND");
        setAiMatchMessage(
          "Data Gemini belum berhasil dicocokkan dengan Master Data. Lengkapi data secara manual.",
        );
      }

      return;
    }

    /* OCR lokal */
    setAiOcrData(null);

    if (!result.documentNumber) {
      setScannerSource("OCR");
      setDocumentNumber("");
      setScanMessage(
        "OCR berhasil membaca teks, tetapi nomor dokumen tidak ditemukan. Periksa nota atau gunakan input manual.",
      );
      return;
    }

    await validateDocument(
      result.documentNumber,
      "OCR",
    );
  }

  /*
   * ============================================================
   * MANUAL SUBMIT
   * ============================================================
   */

  async function handleManualScan(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await validateDocument(
      documentNumber,
      "MANUAL",
    );
  }

  /*
   * ============================================================
   * CAMERA DETECTED
   * ============================================================
   */

  async function handleCameraDetected(
    value: string,
    source: "QR" | "BARCODE",
  ) {
    await validateDocument(
      value,
      source,
    );
  }

  /*
   * ============================================================
   * PREVIEW
   * ============================================================
   */

  function handlePreview() {
    setError("");

    if (!scannedDocument) {
      setError(
        "Scan atau validasi dokumen terlebih dahulu.",
      );

      return;
    }

    if (
      scannedDocument.status ===
        "PROCESSED" ||
      processedTransaction
    ) {
      setError(
        "Dokumen ini sudah diproses.",
      );

      return;
    }

    if (!selectedSpk) {
      setError(
        "Pilih SPK terlebih dahulu.",
      );

      return;
    }

    if (!selectedProductId || !selectedProduct) {
      setError("Pilih produk terlebih dahulu.");
      return;
    }

    if (!selectedTransactionType) {
      setError(
        "Pilih proses transaksi terlebih dahulu.",
      );

      return;
    }

    if (!selectedEmployeeId) {
      setError(
        "Pilih karyawan terlebih dahulu.",
      );

      return;
    }

    const parsedQuantity =
      Number(quantity);

    if (
      !Number.isInteger(
        parsedQuantity,
      ) ||
      parsedQuantity <= 0
    ) {
      setError(
        "Jumlah harus berupa angka bulat lebih dari 0.",
      );

      return;
    }

    if (
      maxQuantity !== null &&
      parsedQuantity >
        maxQuantity
    ) {
      setError(
        `Jumlah melebihi batas. Maximum untuk proses ini adalah ${maxQuantity}.`,
      );

      return;
    }

    setShowPreview(true);
  }

  /*
   * ============================================================
   * PROCESS TRANSACTION
   * ============================================================
   */

  async function handleProcess() {
    if (!canProcess) {
      setError(
        "Anda tidak memiliki permission untuk memproses scan.",
      );

      return;
    }

    if (!scannedDocument) {
      setError(
        "Scanned document tidak ditemukan.",
      );

      return;
    }

    if (!selectedSpk) {
      setError(
        "SPK wajib dipilih.",
      );

      return;
    }

    if (!selectedProductId || !selectedProduct) {
      setError("Produk wajib dipilih.");
      return;
    }

    if (!selectedTransactionType) {
      setError(
        "Transaction type wajib dipilih.",
      );

      return;
    }

    if (!selectedEmployeeId) {
      setError(
        "Employee wajib dipilih.",
      );

      return;
    }

    const parsedQuantity =
      Number(quantity);

    if (
      !Number.isInteger(
        parsedQuantity,
      ) ||
      parsedQuantity <= 0
    ) {
      setError(
        "Quantity tidak valid.",
      );

      return;
    }

    const employee =
      employees.find(
        (item) =>
          String(item.id) ===
          selectedEmployeeId,
      );

    if (!employee) {
      setError(
        "Employee tidak ditemukan.",
      );

      return;
    }

    try {
      setSubmitting(true);

      setError("");
      setSuccess("");

      const response = await fetch(
        "/api/scanner/process",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            scannedDocumentId:
              scannedDocument.id,

            spkId:
              selectedSpk.id,

            transactionTypeId:
              selectedTransactionType.id,

            productId:
              Number(selectedProductId),

            tailorId:
              selectedSpk.tailor.id,

            employeeId:
              employee.id,

            quantity:
              parsedQuantity,
          }),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        /*
         * Backend Transaction Engine tetap
         * menjadi sumber kebenaran.
         */
        if (
          result.maxQuantity !==
          undefined
        ) {
          throw new Error(
            `${result.error ?? "Quantity tidak valid."} Maximum: ${result.maxQuantity}.`,
          );
        }

        throw new Error(
          result.error ??
            "Gagal memproses transaksi.",
        );
      }

      const transaction =
        result.transaction as TransactionResult;

      setProcessedTransaction(
        transaction,
      );

      setIsDuplicate(false);

      setScannedDocument(
        result.scannedDocument ??
          {
            ...scannedDocument,
            status: "PROCESSED",
          },
      );

      setSuccess(
        "Transaksi berhasil diproses.",
      );

      setShowPreview(false);

      /*
       * Refresh SPK agar summary
       * langsung mengikuti transaksi terbaru.
       */
      await loadSpkDetail(
        String(selectedSpk.id),
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal memproses transaksi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (
    authLoading ||
    loadingInitialData
  ) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-indigo-600" />

            <p className="mt-3 text-sm font-medium text-slate-600">
              Loading Field Scanner...
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* ====================================================== */}
        {/* HEADER */}
        {/* ====================================================== */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-indigo-600">
              <ScanLine className="h-4 w-4" />
              Operations
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
              Field Scanner
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Scan QR atau barcode pada nota
              fisik, validasi dokumen, lalu
              proses transaksi melalui
              Transaction Engine.
            </p>
          </div>

          <Link
            href="/operations/scanner/history"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <History className="h-4 w-4" />
            Scanner History
          </Link>
        </div>

        {/* ====================================================== */}
        {/* ALERT */}
        {/* ====================================================== */}

        {error && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />

              <div>
                <p className="text-sm font-bold text-rose-700">
                  Terjadi kesalahan
                </p>

                <p className="mt-1 text-sm leading-6 text-rose-600">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setError("")
                }
                className="ml-auto rounded-lg p-1 text-rose-400 hover:bg-rose-100 hover:text-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

              <div>
                <p className="text-sm font-bold text-emerald-700">
                  Berhasil
                </p>

                <p className="mt-1 text-sm leading-6 text-emerald-600">
                  {success}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================== */}
        {/* DUPLICATE RESULT */}
        {/* ====================================================== */}

        {isDuplicate && processedTransaction && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <AlertCircle className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-bold text-amber-800">
                    Dokumen Sudah Diproses
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-amber-700">
                    Dokumen ini sudah memiliki transaksi dan tidak dapat diproses kembali.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  No. Dokumen
                </p>
                <p className="mt-1 break-all font-mono text-sm font-bold text-slate-800">
                  {scannedDocument?.documentNumber ?? documentNumber}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  No. Transaksi
                </p>
                <p className="mt-1 break-all font-mono text-sm font-bold text-indigo-600">
                  {processedTransaction.transactionNumber}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Process
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {getTransactionLabel(
                    processedTransaction.transactionType.code,
                    processedTransaction.transactionType.name,
                  )}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Quantity
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {processedTransaction.quantity}
                </p>
              </div>
            </div>

            <div className="grid gap-4 border-t border-slate-100 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  SPK
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {processedTransaction.spk.spkNumber}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Product
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {processedTransaction.product.name}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Penjahit
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {processedTransaction.tailor.name}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Employee
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {processedTransaction.employee.name}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex flex-col gap-1 text-xs text-slate-500">
                <span>
                  Diproses pada: <span className="font-semibold text-slate-700">{formatDate(processedTransaction.createdAt)}</span>
                </span>
                {scannedDocument?.source && (
                  <span>
                    Scan saat ini: <span className="font-semibold text-slate-700">{scannerSource}</span>
                    {scannedDocument.source !== scannerSource && (
                      <span className="ml-1 text-slate-400">
                        (dokumen pertama kali tercatat melalui {scannedDocument.source})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetScanner}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                <ScanLine className="h-4 w-4" />
                Scan Dokumen Lain
              </button>

              <Link
                href="/operations/scanner/history"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <History className="h-4 w-4" />
                Lihat History
              </Link>
            </div>
          </div>
        )}

        {/* ====================================================== */}
        {/* PROCESSED RESULT */}
        {/* ====================================================== */}

        {processedTransaction && !isDuplicate && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-bold text-emerald-800">
                    Transaksi berhasil diproses
                  </p>

                  <p className="mt-0.5 text-xs text-emerald-600">
                    Document dan transaction
                    sudah tercatat di sistem.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Transaction
                </p>

                <p className="mt-1 font-mono text-sm font-bold text-indigo-600">
                  {
                    processedTransaction.transactionNumber
                  }
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Document
                </p>

                <p className="mt-1 font-mono text-sm font-bold text-slate-800">
                  {documentNumber}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Process
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {getTransactionLabel(
                    processedTransaction
                      .transactionType
                      .code,
                    processedTransaction
                      .transactionType
                      .name,
                  )}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Quantity
                </p>

                <p className="mt-1 text-sm font-bold text-slate-800">
                  {
                    processedTransaction.quantity
                  }
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetScanner}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <ScanLine className="h-4 w-4" />
                Scan Dokumen Berikutnya
              </button>

              <Link
                href="/operations/scanner/history"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                <History className="h-4 w-4" />
                Lihat History
              </Link>
            </div>
          </div>
        )}

        {/* ====================================================== */}
        {/* MAIN GRID */}
        {/* ====================================================== */}

        {!processedTransaction && !isDuplicate && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            {/* ================================================== */}
            {/* LEFT */}
            {/* ================================================== */}

            <div className="space-y-6">
              {/* SCANNER INPUT */}
              {showCamera && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <ScanLine className="h-5 w-5 text-indigo-600" />
                          <h2 className="text-sm font-bold text-slate-800">
                            Scanner Input
                          </h2>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Gunakan QR / barcode atau OCR untuk membaca nomor nota.
                        </p>
                      </div>

                      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                        <button
                          type="button"
                          onClick={() => setScannerMode("QR")}
                          disabled={Boolean(scannedDocument) || scanningDocument}
                          className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                            scannerMode === "QR"
                              ? "bg-white text-indigo-600 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          QR / Barcode
                        </button>
                        <button
                          type="button"
                          onClick={() => setScannerMode("OCR")}
                          disabled={Boolean(scannedDocument) || scanningDocument}
                          className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                            scannerMode === "OCR"
                              ? "bg-white text-indigo-600 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          OCR Nota
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {scannerMode === "QR" ? (
                      <QrBarcodeScanner
                        disabled={
                          scanningDocument ||
                          Boolean(scannedDocument)
                        }
                        onDetected={handleCameraDetected}
                      />
                    ) : (
                      <OcrScanner
                        disabled={
                          scanningDocument ||
                          Boolean(scannedDocument)
                        }
                        onResult={handleOcrResult}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* GEMINI DATABASE MATCH */}
              {aiOcrData && (
                <div className="mt-6 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
                  <div className="border-b border-indigo-100 bg-indigo-50/70 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          Gemini AI → Database Validation
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Hasil pembacaan AI dicocokkan dengan Master Data.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div
                      className={`rounded-xl border p-4 ${
                        aiMatchStatus === "MATCHED"
                          ? "border-emerald-200 bg-emerald-50"
                          : aiMatchStatus === "PARTIAL"
                            ? "border-amber-200 bg-amber-50"
                            : "border-rose-200 bg-rose-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {aiMatchStatus === "MATCHED" ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
                        )}
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {aiMatchStatus === "MATCHED"
                              ? "Data berhasil dicocokkan"
                              : aiMatchStatus === "PARTIAL"
                                ? "Data sebagian berhasil dicocokkan"
                                : "Perlu pemeriksaan manual"}
                          </p>
                          {aiMatchMessage && (
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {aiMatchMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">SPK</p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {selectedSpk?.spkNumber ?? aiOcrData.spkNumber ?? "-"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Proses</p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {selectedTransactionType?.name ?? aiOcrData.transactionType ?? "-"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Quantity</p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {quantity ? `${quantity}${aiOcrData.unit ? ` ${aiOcrData.unit}` : ""}` : "-"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Employee</p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {employees.find((employee) => String(employee.id) === selectedEmployeeId)?.name ?? aiOcrData.employeeName ?? "-"}
                        </p>
                      </div>
                    </div>

                    {!aiOcrData.documentNumber && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-bold text-amber-800">Nomor nota belum terbaca</p>
                        <p className="mt-1 text-xs leading-5 text-amber-700">
                          Masukkan nomor nota secara manual sebelum transaksi dapat diproses.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MANUAL */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-indigo-600" />

                        <h2 className="text-sm font-bold text-slate-800">
                          Manual Input
                        </h2>
                      </div>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Gunakan input manual jika
                        kamera tidak tersedia.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setShowCamera(
                          (value) =>
                            !value,
                        )
                      }
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      {showCamera
                        ? "Sembunyikan scanner"
                        : "Tampilkan scanner"}
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={
                    handleManualScan
                  }
                  className="p-5"
                >
                  <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                    Nomor Dokumen
                  </label>

                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                      <ClipboardList className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        value={
                          documentNumber
                        }
                        onChange={(event) =>
                          setDocumentNumber(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Contoh: NT-20260930-00128"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 font-mono text-sm font-medium text-slate-800 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={
                        scanningDocument ||
                        !documentNumber.trim()
                      }
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {scanningDocument ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          Validate
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* DOCUMENT RESULT */}
              {scannedDocument && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Scanned Document
                        </p>

                        <h2 className="mt-1 font-mono text-lg font-bold text-slate-800">
                          {
                            scannedDocument.documentNumber
                          }
                        </h2>
                      </div>

                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getStatusStyle(
                          scannedDocument.status,
                        )}`}
                      >
                        {
                          scannedDocument.status
                        }
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Source
                      </p>

                      <p className="mt-1 text-sm font-bold text-slate-700">
                        {
                          scannedDocument.source
                        }
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Scanned At
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {formatDate(
                          scannedDocument.scannedAt,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Processed At
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {formatDate(
                          scannedDocument.processedAt,
                        )}
                      </p>
                    </div>
                  </div>

                  {scanMessage && (
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                      <p className="text-xs leading-5 text-slate-600">
                        {scanMessage}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TRANSACTION FORM */}
              {scannedDocument &&
                !processedTransaction && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                          <FileCheck2 className="h-4 w-4" />
                        </div>

                        <div>
                          <h2 className="text-sm font-bold text-slate-800">
                            Transaction Details
                          </h2>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Lengkapi data transaksi
                            sebelum melakukan
                            konfirmasi.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5 p-5">
                      {/* SPK */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                          SPK
                        </label>

                        <div className="relative mt-2">
                          <ClipboardList className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                          <select
                            value={
                              selectedSpkId
                            }
                            onChange={(
                              event,
                            ) =>
                              setSelectedSpkId(
                                event.target
                                  .value,
                              )
                            }
                            className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                          >
                            <option value="">
                              Pilih SPK
                            </option>

                            {filteredSpks.map((spk) => (
                              <option
                                key={spk.id}
                                value={spk.id}
                              >
                                {spk.spkNumber} —{" "}
                                {spk.items
                                  .map((item) => item.product.name)
                                  .join(", ")}{" "}
                                — {spk.tailor.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* SPK SEARCH */}
                        <div className="mt-2">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

                            <input
                              value={
                                searchSpk
                              }
                              onChange={(
                                event,
                              ) =>
                                setSearchSpk(
                                  event
                                    .target
                                    .value,
                                )
                              }
                              placeholder="Cari SPK / product / penjahit..."
                              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* PRODUCT */}
                      {selectedSpk && (
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                            Product
                          </label>
                          <select
                            value={selectedProductId}
                            onChange={(event) => {
                              setSelectedProductId(event.target.value);
                              setSelectedTypeId("");
                              setQuantity("");
                              setError("");
                            }}
                            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                          >
                            <option value="">Pilih product</option>
                            {selectedSpk.items.map((item) => (
                              <option key={item.productId} value={item.productId}>
                                {item.product.code} — {item.product.name} — Qty SPK: {item.quantity}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* SPK INFO */}
                      {selectedSpk && (
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                          <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-400">
                                Product
                              </p>

                              <p className="mt-1 text-sm font-bold text-slate-800">
                                {
                                  selectedProduct?.name ?? "Belum dipilih"
                                }
                              </p>

                              <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                                {
                                  selectedProduct?.code ?? "-"
                                }
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-400">
                                Penjahit
                              </p>

                              <p className="mt-1 text-sm font-bold text-slate-800">
                                {
                                  selectedSpk
                                    .tailor
                                    .name
                                }
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-400">
                                Available
                              </p>

                              <p className="mt-1 text-sm font-bold text-slate-800">
                                {
                                  selectedProductSummary?.summary.jumlahBarang ?? 0
                                }
                              </p>

                              <p className="mt-0.5 text-[11px] text-slate-500">
                                Total barang
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TRANSACTION TYPE */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                          Transaction Type
                        </label>

                        <select
                          value={
                            selectedTypeId
                          }
                          onChange={(
                            event,
                          ) => {
                            setSelectedTypeId(
                              event.target
                                .value,
                            );

                            setQuantity(
                              "",
                            );

                            setError("");
                          }}
                          disabled={
                            !selectedSpk || !selectedProductId
                          }
                          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="">
                            Pilih proses
                          </option>

                          {availableTransactionTypes.map(
                            (type) => (
                              <option
                                key={
                                  type.id
                                }
                                value={
                                  type.id
                                }
                              >
                                {getTransactionLabel(
                                  type.code,
                                  type.name,
                                )}
                              </option>
                            ),
                          )}
                        </select>

                        {selectedSpk &&
                          availableTransactionTypes.length ===
                            0 && (
                            <p className="mt-2 text-xs text-amber-600">
                              Tidak ada proses
                              transaksi yang
                              tersedia untuk
                              status SPK saat
                              ini.
                            </p>
                          )}
                      </div>

                      {/* EMPLOYEE */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                          Employee
                        </label>

                        <div className="relative mt-2">
                          <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                          <select
                            value={
                              selectedEmployeeId
                            }
                            onChange={(
                              event,
                            ) =>
                              setSelectedEmployeeId(
                                event
                                  .target
                                  .value,
                              )
                            }
                            className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                          >
                            <option value="">
                              Pilih employee
                            </option>

                            {employees.map(
                              (employee) => (
                                <option
                                  key={
                                    employee.id
                                  }
                                  value={
                                    employee.id
                                  }
                                >
                                  {
                                    employee.name
                                  }
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      </div>

                      {/* QUANTITY */}
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                            Quantity
                          </label>

                          {maxQuantity !==
                            null && (
                            <span className="text-xs font-semibold text-indigo-600">
                              Available:{" "}
                              {
                                maxQuantity
                              }
                            </span>
                          )}
                        </div>

                        <input
                          type="number"
                          min="1"
                          max={
                            maxQuantity ??
                            undefined
                          }
                          value={
                            quantity
                          }
                          onChange={(
                            event,
                          ) =>
                            setQuantity(
                              event
                                .target
                                .value,
                            )
                          }
                          disabled={
                            !selectedTransactionType
                          }
                          placeholder="Masukkan quantity"
                          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                        />

                        {maxQuantity !==
                          null && (
                          <p className="mt-2 text-[11px] leading-5 text-slate-400">
                            Maximum quantity
                            mengikuti
                            business rule SPK.
                          </p>
                        )}
                      </div>

                      {/* ACTION */}
                      <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={
                            resetScanner
                          }
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Clear
                        </button>

                        <button
                          type="button"
                          onClick={
                            handlePreview
                          }
                          disabled={
                            !canProcess ||
                            submitting
                          }
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FileCheck2 className="h-4 w-4" />
                          Preview & Confirm
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>

                      {!canProcess && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                          <p className="text-xs leading-5 text-amber-700">
                            Akun ini dapat
                            melihat scanner,
                            tetapi tidak
                            memiliki permission
                            <span className="mx-1 font-mono font-bold">
                              scanner.create
                            </span>
                            untuk memproses
                            transaksi.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* ================================================== */}
            {/* RIGHT */}
            {/* ================================================== */}

            <aside className="space-y-6">
              {/* WORKFLOW */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-sm font-bold text-slate-800">
                    Scanner Workflow
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Alur pemrosesan dokumen.
                  </p>
                </div>

                <div className="p-5">
                  <div className="space-y-5">
                    {[
                      {
                        number: "01",
                        title: "Scan",
                        description:
                          "Baca QR / barcode, OCR nota, atau masukkan nomor dokumen.",
                        icon: ScanLine,
                      },
                      {
                        number: "02",
                        title: "Validate",
                        description:
                          "Sistem memeriksa dokumen dan duplicate.",
                        icon: ShieldCheck,
                      },
                      {
                        number: "03",
                        title: "Complete Data",
                        description:
                          "Pilih SPK, product, proses, employee, dan quantity.",
                        icon: ClipboardList,
                      },
                      {
                        number: "04",
                        title: "Process",
                        description:
                          "Transaction Engine membuat transaksi.",
                        icon: CheckCircle2,
                      },
                    ].map(
                      (step, index) => {
                        const Icon =
                          step.icon;

                        return (
                          <div
                            key={
                              step.number
                            }
                            className="flex gap-3"
                          >
                            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                              <Icon className="h-4 w-4" />

                              {index <
                                3 && (
                                <span className="absolute left-1/2 top-full h-5 w-px -translate-x-1/2 bg-slate-200" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400">
                                  {
                                    step.number
                                  }
                                </span>

                                <p className="text-sm font-bold text-slate-800">
                                  {
                                    step.title
                                  }
                                </p>
                              </div>

                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {
                                  step.description
                                }
                              </p>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>

              {/* CURRENT DOCUMENT */}
              {scannedDocument && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Current Document
                    </p>

                    <p className="mt-2 break-all font-mono text-sm font-bold text-slate-800">
                      {
                        scannedDocument.documentNumber
                      }
                    </p>
                  </div>

                  <div className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        Source
                      </span>

                      <span className="text-xs font-bold text-slate-700">
                        {
                          scannedDocument.source
                        }
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        Status
                      </span>

                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] font-bold ${getStatusStyle(
                          scannedDocument.status,
                        )}`}
                      >
                        {
                          scannedDocument.status
                        }
                      </span>
                    </div>

                    {selectedSpk && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">
                          SPK
                        </span>

                        <span className="text-right text-xs font-bold text-slate-700">
                          {
                            selectedSpk.spkNumber
                          }
                        </span>
                      </div>
                    )}

                    {selectedProduct && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">Product</span>
                        <span className="text-right text-xs font-bold text-slate-700">
                          {selectedProduct.code} — {selectedProduct.name}
                        </span>
                      </div>
                    )}

                    {selectedTransactionType && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">
                          Process
                        </span>

                        <span className="text-right text-xs font-bold text-slate-700">
                          {getTransactionLabel(
                            selectedTransactionType.code,
                            selectedTransactionType.name,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BUSINESS RULE */}
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                    <ShieldCheck className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-indigo-900">
                      Business Rule Protected
                    </p>

                    <p className="mt-1 text-xs leading-5 text-indigo-700">
                      Scanner tidak langsung
                      membuat transaksi.
                      Semua transaksi tetap
                      melewati validasi
                      Transaction Engine.
                    </p>
                  </div>
                </div>
              </div>

              {/* QUICK LINKS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Quick Access
                </p>

                <div className="mt-3 space-y-2">
                  <Link
                    href="/operations/scanner/history"
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-100 hover:bg-indigo-50/50"
                  >
                    <span className="flex items-center gap-2">
                      <History className="h-4 w-4 text-slate-400" />
                      Scanner History
                    </span>

                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>

                  <Link
                    href="/operations/transactions"
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-100 hover:bg-indigo-50/50"
                  >
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-slate-400" />
                      Transactions
                    </span>

                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ====================================================== */}
        {/* PREVIEW MODAL */}
        {/* ====================================================== */}

        {showPreview &&
          scannedDocument &&
          selectedSpk &&
          selectedProduct &&
          selectedTransactionType && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                {/* HEADER */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5">
                  <div>
                    <div className="flex items-center gap-2 text-indigo-600">
                      <FileCheck2 className="h-5 w-5" />

                      <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
                        Confirmation
                      </span>
                    </div>

                    <h2 className="mt-2 text-lg font-bold text-slate-800">
                      Preview Transaction
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Pastikan data berikut
                      sudah benar sebelum
                      transaksi diproses.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowPreview(
                        false,
                      )
                    }
                    disabled={submitting}
                    className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* DATA */}
                <div className="space-y-4 p-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                          Document
                        </p>

                        <p className="mt-1 break-all font-mono text-sm font-bold text-slate-800">
                          {
                            scannedDocument.documentNumber
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                          Source
                        </p>

                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {
                            scannedDocument.source
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <PreviewRow
                      label="SPK"
                      value={
                        selectedSpk.spkNumber
                      }
                    />

                    <PreviewRow
                      label="Product"
                      value={`${selectedProduct.code} — ${selectedProduct.name}`}
                    />

                    <PreviewRow
                      label="Penjahit"
                      value={
                        selectedSpk.tailor
                          .name
                      }
                    />

                    <PreviewRow
                      label="Process"
                      value={getTransactionLabel(
                        selectedTransactionType.code,
                        selectedTransactionType.name,
                      )}
                    />

                    <PreviewRow
                      label="Employee"
                      value={
                        employees.find(
                          (employee) =>
                            String(
                              employee.id,
                            ) ===
                            selectedEmployeeId,
                        )?.name ??
                        "-"
                      }
                    />

                    <PreviewRow
                      label="Quantity"
                      value={quantity}
                      strong
                    />
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

                      <p className="text-xs leading-5 text-amber-700">
                        Setelah dikonfirmasi,
                        sistem akan membuat
                        transaction dan
                        mengubah status scanned
                        document menjadi
                        PROCESSED. Pastikan
                        quantity dan proses
                        sudah sesuai.
                      </p>
                    </div>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setShowPreview(
                        false,
                      )
                    }
                    disabled={submitting}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Kembali
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleProcess
                    }
                    disabled={
                      submitting ||
                      !canProcess
                    }
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Confirm & Process
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </main>
  );
}

/*
 * ================================================================
 * PREVIEW ROW
 * ================================================================
 */

function PreviewRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span
        className={`max-w-[65%] text-right text-sm ${
          strong
            ? "font-bold text-indigo-600"
            : "font-semibold text-slate-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}