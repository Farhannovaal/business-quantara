import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

type ImportError = {
  row: number;
  code: string;
  message: string;
};

type TailorImportRow = {
  name: string;
  isActive: boolean;
  rowNumber: number;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_ERRORS = 200;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function parseActive(
  value: unknown,
): { value: boolean | null; valid: boolean } {
  if (value === undefined || value === null || value === "") {
    return { value: true, valid: true };
  }

  if (typeof value === "boolean") {
    return { value, valid: true };
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "yes", "1", "active"].includes(normalized)) {
    return { value: true, valid: true };
  }

  if (["false", "no", "0", "inactive"].includes(normalized)) {
    return { value: false, valid: true };
  }

  return { value: null, valid: false };
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    { status },
  );
}

export const POST = withApiAuth(
  async ({ request, tenant }) => {
    if (!tenant) {
      return errorResponse("Company context is unavailable.", 403);
    }

    try {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return errorResponse("File Excel wajib diunggah.", 400);
      }

      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        return errorResponse(
          "Format file tidak valid. Gunakan file .xlsx.",
          400,
        );
      }

      if (file.size === 0) {
        return errorResponse("File Excel kosong.", 400);
      }

      if (file.size > MAX_FILE_SIZE) {
        return errorResponse(
          "Ukuran file maksimal adalah 5 MB.",
          400,
        );
      }

      // Company tujuan import berasal dari active tenant context.
      // companyId dari form tidak digunakan.
      const companyId = tenant.id;

      const arrayBuffer = await file.arrayBuffer();

      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: false,
      });

      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        return errorResponse(
          "Workbook tidak memiliki sheet.",
          400,
        );
      }

      const worksheet = workbook.Sheets[firstSheetName];

      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(
        worksheet,
        {
          header: 1,
          defval: "",
          raw: false,
        },
      );

      if (rawRows.length < 2) {
        return errorResponse(
          "Tidak ada data untuk diimpor. Isi data mulai baris kedua.",
          400,
        );
      }

      const headers = rawRows[0].map(normalizeHeader);
      const nameIndex = headers.indexOf("name");
      const activeIndex = headers.indexOf("isactive");

      if (nameIndex === -1) {
        return errorResponse(
          'Kolom "Name" wajib tersedia pada baris pertama.',
          400,
        );
      }

      const dataRows = rawRows.slice(1);

      if (dataRows.length > MAX_ROWS) {
        return errorResponse(
          `Maksimal ${MAX_ROWS} baris data dalam satu kali import.`,
          400,
        );
      }

      const errors: ImportError[] = [];
      const validRows: TailorImportRow[] = [];
      const seenNames = new Set<string>();

      function addError(
        row: number,
        code: string,
        message: string,
      ) {
        errors.push({ row, code, message });
      }

      for (let index = 0; index < dataRows.length; index++) {
        const row = dataRows[index];
        const rowNumber = index + 2;

        const name = String(row[nameIndex] ?? "").trim();
        const rawActive =
          activeIndex === -1 ? "" : row[activeIndex];

        if (
          row.every(
            (value) => String(value ?? "").trim() === "",
          )
        ) {
          continue;
        }

        if (!name) {
          addError(rowNumber, "", "Nama tailor wajib diisi.");
          continue;
        }

        if (name.length > 150) {
          addError(
            rowNumber,
            name,
            "Nama tailor maksimal 150 karakter.",
          );
          continue;
        }

        const active = parseActive(rawActive);

        if (!active.valid || active.value === null) {
          addError(
            rowNumber,
            name,
            "Is Active tidak valid. Gunakan TRUE/FALSE, YES/NO, 1/0, atau ACTIVE/INACTIVE.",
          );
          continue;
        }

        const normalizedName = name.toLowerCase();

        if (seenNames.has(normalizedName)) {
          addError(
            rowNumber,
            name,
            "Nama tailor duplikat di dalam file.",
          );
          continue;
        }

        seenNames.add(normalizedName);

        validRows.push({
          name,
          isActive: active.value,
          rowNumber,
        });
      }

      // Periksa duplikasi hanya dalam company aktif.
      const existingTailors = validRows.length
        ? await prisma.tailor.findMany({
            where: {
              companyId,
              name: {
                in: validRows.map((row) => row.name),
              },
            },
            select: {
              name: true,
            },
          })
        : [];

      const existingNames = new Set(
        existingTailors.map((tailor) =>
          tailor.name.toLowerCase(),
        ),
      );

      const newRows: TailorImportRow[] = [];

      for (const row of validRows) {
        if (existingNames.has(row.name.toLowerCase())) {
          addError(
            row.rowNumber,
            row.name,
            "Nama tailor sudah terdaftar dan dilewati.",
          );
          continue;
        }

        newRows.push(row);
      }

      let imported = 0;

      for (const row of newRows) {
        try {
          await prisma.tailor.create({
            data: {
              companyId,
              name: row.name,
              isActive: row.isActive,
            },
          });

          imported++;
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2002"
          ) {
            addError(
              row.rowNumber,
              row.name,
              "Nama tailor sudah terdaftar dan dilewati.",
            );
            continue;
          }

          console.error(
            `Import tailor gagal pada baris ${row.rowNumber}:`,
            error,
          );

          addError(
            row.rowNumber,
            row.name,
            "Gagal menyimpan data tailor.",
          );
        }
      }

      const totalRows = dataRows.filter((row) =>
        row.some(
          (value) => String(value ?? "").trim() !== "",
        ),
      ).length;

      return NextResponse.json({
        success: true,
        data: {
          totalRows,
          imported,
          skippedOrFailed: errors.length,
          errors: errors.slice(0, MAX_ERRORS),
          errorsTruncated: errors.length > MAX_ERRORS,
        },
      });
    } catch (error) {
      console.error("POST /api/tailors/import error:", error);

      return errorResponse(
        "Terjadi kesalahan saat mengimpor data tailor.",
        500,
      );
    }
  },
  {
    tenant: "required",
    permission: "tailor.manage",
  },
);