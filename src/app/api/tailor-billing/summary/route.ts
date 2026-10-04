import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";
import { calculateSPKStatus } from "@/lib/spk-status";

export async function GET() {
  const auth = await requireAuth();

  if (auth.response) {
    return auth.response;
  }

  const user = auth.user;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  if (!hasPermission(user, "tailor-billing.view")) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const now = new Date();

    /*
     * =========================================================
     * LOAD SPK
     * =========================================================
     *
     * Satu SPK sekarang bisa mempunyai banyak product:
     *
     * SPK
     * ├── items[]
     * │   └── product
     * ├── transactions[]
     * │   └── product
     * └── tailorBillItems[]
     *     └── productId
     *
     * Karena itu billing dihitung per:
     *
     * SPK + Product
     */
    const spks = await prisma.sPK.findMany({
      where: {
        status: {
          not: "CANCELLED",
        },
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
          include: {
            transactionType: true,
          },

          orderBy: {
            createdAt: "asc",
          },
        },

        tailorBillItems: {
          where: {
            bill: {
              status: {
                not: "CANCELLED",
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    /*
     * =========================================================
     * SUMMARY
     * =========================================================
     */

    let readySpkCount = 0;
    let missingRateSpkCount = 0;

    let readyQuantity = 0;
    let readyAmount = 0;

    let missingRateQuantity = 0;

    const tailorIds = new Set<number>();

    const readyItems: {
      spkId: number;
      spkNumber: string;
      tailorId: number;
      tailorName: string;
      productId: number;
      productName: string;
      billableQuantity: number;
      rate: number;
      amount: number;
    }[] = [];

    const missingRateItems: {
      spkId: number;
      spkNumber: string;
      tailorId: number;
      tailorName: string;
      productId: number;
      productName: string;
      billableQuantity: number;
    }[] = [];

    /*
     * =========================================================
     * LOOP SPK
     * =========================================================
     */

    for (const spk of spks) {
      /*
       * Proses setiap product di dalam SPK.
       */
      for (const spkItem of spk.items) {
        const productId = spkItem.productId;

        /*
         * -----------------------------------------------------
         * TRANSACTIONS UNTUK PRODUCT INI SAJA
         * -----------------------------------------------------
         */
        const productTransactions =
          spk.transactions.filter(
            (transaction) =>
              transaction.productId ===
              productId,
          );

        /*
         * -----------------------------------------------------
         * HITUNG STATUS PRODUCT
         * -----------------------------------------------------
         */
        const status = calculateSPKStatus(
          productTransactions.map(
            (transaction) => ({
              quantity:
                transaction.quantity,

              transactionType: {
                code:
                  transaction
                    .transactionType.code,
              },
            }),
          ),
        );

        /*
         * -----------------------------------------------------
         * TOTAL SUDAH DIBAYAR UNTUK PRODUCT INI
         * -----------------------------------------------------
         *
         * Penting:
         * jangan menjumlahkan seluruh TailorBillItem
         * dari SPK karena satu SPK bisa punya banyak product.
         */
        const totalAlreadyBilled =
          spk.tailorBillItems
            .filter(
              (item) =>
                item.productId ===
                productId,
            )
            .reduce(
              (total, item) =>
                total +
                Number(item.quantity),
              0,
            );

        /*
         * -----------------------------------------------------
         * BILLABLE QUANTITY
         * -----------------------------------------------------
         *
         * Hanya QC ACC yang menjadi barang yang
         * bisa dibayar ke penjahit.
         */
        const billableQuantity =
          Math.max(
            status.totalQcAcc -
              totalAlreadyBilled,
            0,
          );

        if (billableQuantity <= 0) {
          continue;
        }

        /*
         * -----------------------------------------------------
         * CARI TARIF PENJAHIT + PRODUCT
         * -----------------------------------------------------
         */
        const tailorRate =
          await prisma.tailorRate.findFirst({
            where: {
              tailorId:
                spk.tailorId,

              productId,

              isActive: true,

              effectiveFrom: {
                lte: now,
              },

              OR: [
                {
                  effectiveTo: null,
                },
                {
                  effectiveTo: {
                    gte: now,
                  },
                },
              ],
            },

            orderBy: {
              effectiveFrom: "desc",
            },
          });

        /*
         * -----------------------------------------------------
         * BELUM ADA TARIF
         * -----------------------------------------------------
         */
        if (!tailorRate) {
          missingRateQuantity +=
            billableQuantity;

          missingRateItems.push({
            spkId: spk.id,

            spkNumber:
              spk.spkNumber,

            tailorId:
              spk.tailorId,

            tailorName:
              spk.tailor.name,

            productId,

            productName:
              spkItem.product.name,

            billableQuantity,
          });

          continue;
        }

        /*
         * -----------------------------------------------------
         * ADA TARIF
         * -----------------------------------------------------
         */
        const rate = Number(
          tailorRate.rate,
        );

        const amount =
          billableQuantity * rate;

        readyQuantity +=
          billableQuantity;

        readyAmount += amount;

        tailorIds.add(
          spk.tailorId,
        );

        readyItems.push({
          spkId: spk.id,

          spkNumber:
            spk.spkNumber,

          tailorId:
            spk.tailorId,

          tailorName:
            spk.tailor.name,

          productId,

          productName:
            spkItem.product.name,

          billableQuantity,

          rate,

          amount,
        });
      }
    }

    /*
     * =========================================================
     * COUNT UNIQUE SPK
     * =========================================================
     *
     * Satu SPK bisa punya banyak product.
     *
     * Jadi readySpkCount bukan jumlah readyItems.
     */
    const readySpkIds =
      new Set<number>();

    for (const item of readyItems) {
      readySpkIds.add(
        item.spkId,
      );
    }

    const missingRateSpkIds =
      new Set<number>();

    for (
      const item of missingRateItems
    ) {
      missingRateSpkIds.add(
        item.spkId,
      );
    }

    readySpkCount =
      readySpkIds.size;

    missingRateSpkCount =
      missingRateSpkIds.size;

    /*
     * =========================================================
     * RESPONSE
     * =========================================================
     */

    return NextResponse.json({
      success: true,

      data: {
        readySpkCount,

        readyTailorCount:
          tailorIds.size,

        readyQuantity,

        readyAmount,

        missingRateSpkCount,

        missingRateQuantity,

        totalSpkChecked:
          spks.length,

        readyItems,

        missingRateItems,
      },
    });
  } catch (error) {
    console.error(
      "Get tailor billing summary error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal mengambil summary billing penjahit.",
      },
      {
        status: 500,
      },
    );
  }
}