
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function parseActive(value: unknown): boolean | null {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "active", "yes", "ya"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "inactive", "no", "tidak"].includes(normalized)) {
    return false;
  }

  return null;
}

export async function POST(request: Request) {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "product.manage");

  if (permission.response) return permission.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "File Excel wajib diunggah" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { success: false, error: "Gunakan file .xlsx" },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Ukuran file harus lebih dari 0 dan maksimal 5 MB",
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, {
      type: "array",
      cellDates: false,
    });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return NextResponse.json(
        { success: false, error: "Sheet Excel tidak ditemukan" },
        { status: 400 }
      );
    }

    const worksheet = workbook.Sheets[sheetName];
    const matrix: unknown[][] = XLSX.utils.sheet_to_json(
      worksheet,
      { header: 1, defval: "" }
    );

    if (matrix.length < 2) {
      return NextResponse.json(
        { success: false, error: "File tidak memiliki data product" },
        { status: 400 }
      );
    }

    const headers = matrix[0].map(normalizeHeader);
    const codeIndex = headers.findIndex(
      (header) => ["code", "productcode"].includes(header)
    );
    const nameIndex = headers.findIndex(
      (header) => ["name", "productname"].includes(header)
    );
    const activeIndex = headers.findIndex(
      (header) => ["isactive", "active", "status"].includes(header)
    );

    if (codeIndex < 0 || nameIndex < 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Header Code dan Name wajib tersedia",
        },
        { status: 400 }
      );
    }

    const dataRows = matrix.slice(1);

    if (dataRows.length > MAX_ROWS) {
      return NextResponse.json(
        {
          success: false,
          error: `Maksimal ${MAX_ROWS} baris per import`,
        },
        { status: 400 }
      );
    }

    const errors: { row: number; code: string; message: string }[] = [];
    const seenCodes = new Set<string>();

    const candidates: {
      code: string;
      name: string;
      isActive: boolean;
      row: number;
    }[] = [];

    dataRows.forEach((row, index) => {
      const excelRow = index + 2;
      const code = String(row[codeIndex] ?? "").trim();
      const name = String(row[nameIndex] ?? "").trim();
      const active = parseActive(
        activeIndex < 0 ? undefined : row[activeIndex]
      );

      if (!code || !name) {
        errors.push({
          row: excelRow,
          code,
          message: "Code dan Name wajib diisi",
        });
        return;
      }

      if (code.length > 100 || name.length > 255) {
        errors.push({
          row: excelRow,
          code,
          message: "Code maksimal 100 karakter dan Name 255 karakter",
        });
        return;
      }

      if (active === null) {
        errors.push({
          row: excelRow,
          code,
          message: "Is Active harus Active/Inactive atau true/false",
        });
        return;
      }

      // Product code diperlakukan tanpa membedakan huruf besar/kecil
      // untuk mendeteksi duplikat dalam file.
      const key = code.toLowerCase();

      if (seenCodes.has(key)) {
        errors.push({
          row: excelRow,
          code,
          message: "Code duplikat dalam file",
        });
        return;
      }

      seenCodes.add(key);
      candidates.push({ code, name, isActive: active, row: excelRow });
    });

    const existingProducts = await prisma.product.findMany({
      where: {
        code: {
          in: candidates.map((item) => item.code),
        },
      },
      select: { code: true },
    });

    const existingCodes = new Set(
      existingProducts.map((product) => product.code.toLowerCase())
    );

    const newProducts = candidates.filter((item) => {
      if (existingCodes.has(item.code.toLowerCase())) {
        errors.push({
          row: item.row,
          code: item.code,
          message: "Code sudah terdaftar di database",
        });
        return false;
      }

      return true;
    });

    const result = await prisma.product.createMany({
      data: newProducts.map(({ code, name, isActive }) => ({
        code,
        name,
        isActive,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      message: "Import selesai",
      data: {
        totalRows: dataRows.length,
        imported: result.count,
        skippedOrFailed: dataRows.length - result.count,
        errors: errors.slice(0, 200),
        errorsTruncated: errors.length > 200,
      },
    });
  } catch (error) {
    console.error("POST /api/products/import error:", error);

    return NextResponse.json(
      { success: false, error: "Gagal memproses file Excel" },
      { status: 500 }
    );
  }
}
