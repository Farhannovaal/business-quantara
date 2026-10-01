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

export async function GET(
  _request: Request,
  context: Context,
) {
  const { user, response } =
    await requireAuth();

  if (response) {
    return response;
  }

  const permission =
    requirePermission(
      user,
      "qc.view",
    );

  if (permission.response) {
    return permission.response;
  }

  try {
    const { spkId } =
      await context.params;

    const id = Number(spkId);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid SPK ID.",
        },
        {
          status: 400,
        },
      );
    }

    const summary =
      await calculateQCMonitoring(id);

    const spk =
      await prisma.sPK.findUnique({
        where: {
          id,
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
        {
          status: 404,
        },
      );
    }

    const timeline =
      spk.transactions.map(
        (transaction) => ({
          id: transaction.id,

          transactionNumber:
            transaction.transactionNumber,

          type:
            transaction.transactionType.code,

          typeName:
            transaction.transactionType.name,

          quantity:
            transaction.quantity,

          employee:
            transaction.employee.name,

          createdAt:
            transaction.createdAt,
        }),
      );

    return NextResponse.json({
      success: true,

      data: {
        summary,
        timeline,
      },
    });
  } catch (error) {
    console.error(
      "GET QC detail error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengambil detail QC.",
      },
      {
        status: 500,
      },
    );
  }
}