import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

export const GET = withApiAuth(
  async ({ tenant }) => {
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Company context is unavailable." },
        { status: 403 },
      );
    }

    try {
      const employees = await prisma.employee.findMany({
        where: {
          companyId: tenant.id,
        },
        orderBy: { createdAt: "desc" },
        select: {
          name: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const rows = employees.map((employee) => ({
        Name: employee.name,
        "Is Active": employee.isActive ? "TRUE" : "FALSE",
        "Created At": employee.createdAt,
        "Updated At": employee.updatedAt,
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

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "employee",
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
          "Content-Disposition": 'attachment; filename="employee.xlsx"',
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("GET /api/employee/export error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to export employee",
        },
        { status: 500 },
      );
    }
  },
  {
    tenant: "required",
    permission: "employee.view",
  },
);