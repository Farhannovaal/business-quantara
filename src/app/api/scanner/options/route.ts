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

  const permission = requirePermission(user, "scanner.view");

  if (permission.response) {
    return permission.response;
  }

  try {
    const [spks, transactionTypes, employees] = await Promise.all([
      prisma.sPK.findMany({
        where: {
          status: "ACTIVE",
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          items: {
            include: {
              product: true,
            },
            orderBy: {
              id: "asc",
            },
          },
          tailor: true,
          transactions: {
            where: {
              status: "ACTIVE",
            },
            select: {
              quantity: true,
              productId: true,
              transactionType: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      }),

      prisma.transactionType.findMany({
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
      }),

      prisma.employee.findMany({
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
      }),
    ]);

    const spkOptions = spks.flatMap((spk) =>
      spk.items.map((item) => {
        const productTransactions = spk.transactions.filter(
          (transaction) => transaction.productId === item.productId,
        );

        const summary = calculateSPKStatus(
          productTransactions,
          item.quantity,
        );

        const nextTransactionTypes = transactionTypes.filter(
          (transactionType) =>
            summary.nextTransactionTypes.includes(transactionType.code),
        );

        return {
          id: spk.id,
          spkId: spk.id,
          spkNumber: spk.spkNumber,
          status: spk.status,
          productId: item.productId,
          product: {
            id: item.product.id,
            code: item.product.code,
            name: item.product.name,
            quantity: item.quantity,
          },
          tailor: {
            id: spk.tailor.id,
            name: spk.tailor.name,
          },
          summary: {
            totalPengiriman: summary.totalPengiriman,
            totalPenerimaan: summary.totalPenerimaan,
            totalQcRijek: summary.totalQcRijek,
            totalQcAcc: summary.totalQcAcc,
            totalPengirimanRijek: summary.totalPengirimanRijek,
            totalPenerimaanRijek: summary.totalPenerimaanRijek,
            sisaJahit: summary.sisaJahit,
            barangDiQc: summary.barangDiQc,
            jumlahRijek: summary.jumlahRijek,
            jumlahBarang: summary.jumlahBarang,
          },
          nextTransactionTypes,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        spks: spkOptions,
        employees,
        transactionTypes,
      },
    });
  } catch (error) {
    console.error("GET scanner options error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil opsi scanner.",
      },
      {
        status: 500,
      },
    );
  }
}