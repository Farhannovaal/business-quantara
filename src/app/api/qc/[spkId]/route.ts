
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePermission } from "@/lib/auth/authorization";
import {
  calculateQCMonitoring,
} from "@/lib/qc/calculator";

type Context = {
  params: Promise<{
    spkId: string;
  }>;
};

function isSuperAdmin(user: {
  role?: { name?: string | null } | null;
}) {
  return user.role?.name?.toLowerCase() === "superadmin";
}

export async function GET(
  _request: Request,
  context: Context,
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  const permission = requirePermission(user, "qc.view");

  if (permission.response) {
    return permission.response;
  }

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
    const { spkId } = await context.params;
    const id = Number(spkId);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid SPK ID.",
        },
        { status: 400 },
      );
    }

    // Validasi kepemilikan SPK sebelum kalkulasi QC.
    const spk = await prisma.sPK.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(superAdmin ? {} : { companyId: user.companyId! }),
      },
      include: {
        transactions: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            transactionType: {
              select: {
                code: true,
                name: true,
              },
            },
            employee: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!spk) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK tidak ditemukan.",
        },
        { status: 404 },
      );
    }

    const summary = await calculateQCMonitoring(id);

    const timeline = spk.transactions.map((transaction) => ({
      id: transaction.id,
      transactionNumber: transaction.transactionNumber,
      type: transaction.transactionType.code,
      typeName: transaction.transactionType.name,
      quantity: transaction.quantity,
      employee: transaction.employee.name,
      createdAt: transaction.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        summary,
        timeline,
      },
    });
  } catch (error) {
    console.error("GET QC detail error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengambil detail QC.",
      },
      { status: 500 },
    );
  }
}
