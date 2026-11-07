
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isSuperAdmin(user: {
  role?: { name?: string | null } | null;
}) {
  return user.role?.name?.toLowerCase() === "superadmin";
}

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) return response;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  const permission = requirePermission(user, "product.manage");

  if (permission.response) return permission.response;

  const superAdmin = isSuperAdmin(user);

  if (!superAdmin && user.companyId == null) {
    return NextResponse.json(
      {
        success: false,
        error: "User belum terhubung dengan perusahaan.",
      },
      { status: 403 },
    );
  }

  try {
    const workbook = XLSX.utils.book_new();

    const productsSheet = XLSX.utils.aoa_to_sheet([
      ["Code", "Name", "Is Active"],
    ]);

    productsSheet["!cols"] = [
      { wch: 22 },
      { wch: 32 },
      { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      productsSheet,
      "Products",
    );

    const instructionsSheet = XLSX.utils.aoa_to_sheet([
      ["PETUNJUK IMPORT MASTER DATA PRODUCT"],
      [""],
      ["Kolom", "Keterangan"],
      [
        "Code",
        "Wajib diisi, maksimal 100 karakter, harus unik dalam perusahaan tujuan.",
      ],
      ["Name", "Wajib diisi, maksimal 255 karakter."],
      [
        "Is Active",
        "Opsional. Isi Active/Inactive atau true/false. Kosong = Active.",
      ],
      [""],
      ["ATURAN IMPORT"],
      ["1", "Isi data pada sheet Products, mulai dari baris kedua."],
      ["2", "Jangan mengubah nama header."],
      ["3", "Code yang sudah terdaftar dalam perusahaan tujuan akan dilewati."],
      ["4", "Code duplikat di dalam file akan ditandai sebagai error."],
      ["5", "Import hanya menambah data baru, tidak memperbarui data lama."],
      [
        "6",
        superAdmin
          ? "Super Admin harus memilih perusahaan tujuan pada form import."
          : "Data diimpor ke perusahaan yang terhubung dengan akun yang sedang login.",
      ],
      ["7", "Simpan file sebagai Excel Workbook (.xlsx)."],
    ]);

    instructionsSheet["!cols"] = [
      { wch: 24 },
      { wch: 85 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      instructionsSheet,
      "Instructions",
    );

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="product-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/products/template error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal membuat template product",
      },
      { status: 500 },
    );
  }
}
