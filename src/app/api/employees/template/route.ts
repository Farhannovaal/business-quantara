import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "employee.manage");

  if (permission.response) return permission.response;

  try {
    const workbook = XLSX.utils.book_new();

    const dataSheet = XLSX.utils.aoa_to_sheet([
      ["Name", "Is Active"],
    ]);

    dataSheet["!cols"] = [
      { wch: 30 },
      { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      dataSheet,
      "employees"
    );

    const instructionsSheet = XLSX.utils.aoa_to_sheet([
      ["Column", "Required", "Description", "Accepted Values"],
      [
        "Name",
        "Yes",
        "Nama employee. Harus unik dan maksimal 150 karakter.",
        "Teks",
      ],
      [
        "Is Active",
        "No",
        "Status aktif employee. Jika kosong, default TRUE.",
        "TRUE/FALSE, YES/NO, 1/0, ACTIVE/INACTIVE",
      ],
      [],
      ["Important Notes"],
      ["1. Jangan mengubah nama kolom pada sheet employees."],
      ["2. Jangan menghapus kolom wajib Name."],
      ["3. Nama employee yang sudah ada akan dilewati."],
      ["4. Simpan file dalam format Excel .xlsx."],
      ["5. Maksimal ukuran file import adalah 5 MB."],
    ]);

    instructionsSheet["!cols"] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 65 },
      { wch: 45 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      instructionsSheet,
      "Instructions"
    );

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="employee-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/employees/template error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate employee template",
      },
      { status: 500 }
    );
  }
}