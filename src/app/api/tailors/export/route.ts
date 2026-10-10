import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "tailor.view");

  if (permission.response) return permission.response;

  try {
    const tailors = await prisma.tailor.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const rows = tailors.map((tailor) => ({
      Name: tailor.name,
      "Is Active": tailor.isActive ? "TRUE" : "FALSE",
      "Created At": tailor.createdAt,
      "Updated At": tailor.updatedAt,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Name", "Is Active", "Created At", "Updated At"],
    });

    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 12 },
      { wch: 22 },
      { wch: 22 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Tailors");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="tailors.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/tailors/export error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to export tailors",
      },
      { status: 500 }
    );
  }
}