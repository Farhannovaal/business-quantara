import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateSPKStatus } from "@/lib/spk-status";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(user, "tracking.view");

  if (permission.response) {
    return permission.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const spkIdParam = searchParams.get("spkId");

    const parsedSpkId = spkIdParam ? Number(spkIdParam) : null;

    const spks = await prisma.sPK.findMany({
      where: {
        ...(parsedSpkId !== null && Number.isInteger(parsedSpkId)
          ? { id: parsedSpkId }
          : {}),
        ...(search
          ? {
              OR: [
                {
                  spkNumber: {
                    contains: search,
                  },
                },
                {
                  items: {
                    some: {
                      product: {
                        name: {
                          contains: search,
                        },
                      },
                    },
                  },
                },
                {
                  items: {
                    some: {
                      product: {
                        code: {
                          contains: search,
                        },
                      },
                    },
                  },
                },
                {
                  tailor: {
                    name: {
                      contains: search,
                    },
                  },
                },
              ],
            }
          : {}),
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
          orderBy: {
            createdAt: "asc",
          },
          include: {
            transactionType: true,
            employee: true,
            product: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const data = spks.map((spk) => {
      const items = spk.items.map((spkItem) => {
        const productTransactions = spk.transactions.filter(
          (transaction) => transaction.productId === spkItem.productId,
        );

        const summary = calculateSPKStatus(
          productTransactions.map((transaction) => ({
            quantity: transaction.quantity,
            transactionType: {
              code: transaction.transactionType.code,
            },
          })),
          spkItem.quantity,
        );

        const transactions = productTransactions.map((transaction) => ({
          id: transaction.id,
          transactionNumber: transaction.transactionNumber,
          quantity: transaction.quantity,
          createdAt: transaction.createdAt,
          product: {
            id: transaction.product.id,
            code: transaction.product.code,
            name: transaction.product.name,
          },
          transactionType: {
            id: transaction.transactionType.id,
            code: transaction.transactionType.code,
            name: transaction.transactionType.name,
          },
          employee: {
            id: transaction.employee.id,
            name: transaction.employee.name,
          },
        }));

        return {
          id: spkItem.id,
          productId: spkItem.productId,
          quantity: spkItem.quantity,
          product: {
            id: spkItem.product.id,
            code: spkItem.product.code,
            name: spkItem.product.name,
          },
          summary,
          transactions,
        };
      });

      const summary = calculateSPKStatus(
        spk.transactions.map((transaction) => ({
          quantity: transaction.quantity,
          transactionType: {
            code: transaction.transactionType.code,
          },
        })),
      );

      const transactions = spk.transactions.map((transaction) => ({
        id: transaction.id,
        transactionNumber: transaction.transactionNumber,
        quantity: transaction.quantity,
        createdAt: transaction.createdAt,
        product: {
          id: transaction.product.id,
          code: transaction.product.code,
          name: transaction.product.name,
        },
        transactionType: {
          id: transaction.transactionType.id,
          code: transaction.transactionType.code,
          name: transaction.transactionType.name,
        },
        employee: {
          id: transaction.employee.id,
          name: transaction.employee.name,
        },
      }));

      return {
        id: spk.id,
        spkNumber: spk.spkNumber,
        status: spk.status,
        tailor: {
          id: spk.tailor.id,
          name: spk.tailor.name,
        },
        summary,
        items,
        transactions,
      };
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("GET /api/tracking error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data tracking.",
      },
      {
        status: 500,
      },
    );
  }
}
