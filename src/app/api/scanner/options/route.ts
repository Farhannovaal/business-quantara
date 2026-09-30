import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { calculateSPKStatus } from "@/lib/spk-status";

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(
    user,
    "scanner.view",
  );

  if (permission.response) {
    return permission.response;
  }

  try {
    /*
     * Ambil semua SPK aktif beserta:
     * - Product
     * - Tailor
     * - Transaction sebelumnya
     *
     * Business state SPK akan dihitung
     * menggunakan calculateSPKStatus().
     */
    const spks = await prisma.sPK.findMany({
      where: {
        status: "ACTIVE",
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {
        product: true,

        tailor: true,

        transactions: {
          select: {
            quantity: true,

            transactionType: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    /*
     * Transaction type aktif.
     */
    const transactionTypes =
      await prisma.transactionType.findMany({
        where: {
          isActive: true,
        },

        orderBy: {
          sequence: "asc",
        },

        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          sequence: true,
        },
      });

    /*
     * Employee aktif.
     */
    const employees =
      await prisma.employee.findMany({
        where: {
          isActive: true,
        },

        orderBy: {
          name: "asc",
        },

        select: {
          id: true,
          name: true,
        },
      });

    /*
     * Bentuk data SPK untuk kebutuhan Scanner.
     *
     * IMPORTANT:
     * UI tidak menghitung business rule.
     *
     * Server yang menentukan:
     * - summary
     * - next transaction type
     */
    const spkOptions = spks.map((spk) => {
      const summary =
        calculateSPKStatus(
          spk.transactions,
        );

      const nextTransactionTypes =
        transactionTypes.filter(
          (transactionType) =>
            summary.nextTransactionTypes.includes(
              transactionType.code,
            ),
        );

      return {
        id: spk.id,

        spkNumber: spk.spkNumber,

        status: spk.status,

        product: {
          id: spk.product.id,
          code: spk.product.code,
          name: spk.product.name,
        },

        tailor: {
          id: spk.tailor.id,
          name: spk.tailor.name,
        },

        summary: {
          totalPengiriman:
            summary.totalPengiriman,

          totalPenerimaan:
            summary.totalPenerimaan,

          totalQcRijek:
            summary.totalQcRijek,

          totalQcAcc:
            summary.totalQcAcc,

          totalPengirimanRijek:
            summary.totalPengirimanRijek,

          totalPenerimaanRijek:
            summary.totalPenerimaanRijek,

          sisaJahit:
            summary.sisaJahit,

          barangDiQc:
            summary.barangDiQc,

          jumlahRijek:
            summary.jumlahRijek,

          jumlahBarang:
            summary.jumlahBarang,
        },

        nextTransactionTypes,
      };
    });

    return NextResponse.json({
      success: true,

      data: {
        spks: spkOptions,

        employees,

        transactionTypes,
      },
    });
  } catch (error) {
    console.error(
      "GET scanner options error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load scanner options.",
      },
      { status: 500 },
    );
  }
}