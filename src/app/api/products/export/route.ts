
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "product.view");

  if (permission.response) return permission.response;

  if (user.companyId == null) {
    return NextResponse.json(
      {
        success: false,
        error: "User belum terhubung dengan perusahaan.",
      },
      { status: 403 },
    );
  }

  try {
    // Export hanya produk milik perusahaan user.
    const products = await prisma.product.findMany({
      where: {
        companyId: user.companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        code: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const rows = products.map((product) => ({
      Code: product.code,
      Name: product.name,
      "Is Active": product.isActive ? "Active" : "Inactive",
      "Created At": product.createdAt.toISOString(),
      "Updated At": product.updatedAt.toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 22 },
      { wch: 32 },
      { wch: 15 },
      { wch: 25 },
      { wch: 25 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Products",
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
          'attachment; filename="products.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/products/export error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to export products",
      },
      { status: 500 },
    );
  }
}
