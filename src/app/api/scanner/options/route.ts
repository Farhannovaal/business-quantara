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
     * - Items + Product
     * - Tailor
     * - Transaction sebelumnya
     *
     * Business state dihitung per product,
     * karena satu SPK dapat memiliki banyak product.
     */
    const spks = await prisma.sPK.findMany({
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
        },

        tailor: true,

        transactions: {
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
     * Satu SPK dapat memiliki beberapa product.
     *
     * Karena business state berbeda untuk setiap product,
     * maka scanner option dibuat per:
     *
     * SPK + Product
     */
    const spkOptions = spks.flatMap(
      (spk) => {
        return spk.items.map(
          (item) => {
            /*
             * Hanya gunakan transaksi untuk product
             * yang sedang diproses.
             */
            const productTransactions =
              spk.transactions.filter(
                (transaction) =>
                  transaction.productId ===
                  item.productId,
              );

            /*
             * Hitung business state untuk product ini.
             *
             * spkItem.quantity digunakan sebagai
             * Qty SPK product tersebut.
             */
            const summary =
              calculateSPKStatus(
                productTransactions,
                item.quantity,
              );

            /*
             * Filter transaction type berdasarkan
             * business state product.
             */
            const nextTransactionTypes =
              transactionTypes.filter(
                (transactionType) =>
                  summary.nextTransactionTypes.includes(
                    transactionType.code,
                  ),
              );

            return {
              /*
               * SPK identity
               */
              id: spk.id,
              spkId: spk.id,
              spkNumber: spk.spkNumber,
              status: spk.status,

              /*
               * Product identity
               */
              productId: item.productId,

              product: {
                id: item.product.id,
                code: item.product.code,
                name: item.product.name,
                quantity: item.quantity,
              },

              /*
               * Tailor
               */
              tailor: {
                id: spk.tailor.id,
                name: spk.tailor.name,
              },

              /*
               * Product-specific business state
               */
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

              /*
               * Transaction yang masih diperbolehkan
               * untuk product ini.
               */
              nextTransactionTypes,
            };
          },
        );
      },
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
      {
        status: 500,
      },
    );
  }
}