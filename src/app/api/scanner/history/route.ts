import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
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
    const searchParams =
      request.nextUrl.searchParams;

    const search =
      searchParams.get("search")?.trim() || "";

    const status =
      searchParams.get("status")?.trim() || "";

    const source =
      searchParams.get("source")?.trim() || "";

    const pageParam =
      Number(searchParams.get("page") || 1);

    const limitParam =
      Number(searchParams.get("limit") || 20);

    const page =
      Number.isInteger(pageParam) &&
      pageParam > 0
        ? pageParam
        : 1;

    const limit =
      Number.isInteger(limitParam) &&
      limitParam > 0 &&
      limitParam <= 100
        ? limitParam
        : 20;

    const where: {
      status?: "PENDING" | "VALID" | "INVALID" | "PROCESSED" | "DUPLICATE" | "REVIEW_REQUIRED";
      source?: "QR" | "BARCODE" | "OCR" | "MANUAL";
      OR?: Array<{
        documentNumber?: {
          contains: string;
        };
        documentType?: {
          contains: string;
        };
        rawText?: {
          contains: string;
        };
        transaction?: {
          transactionNumber?: {
            contains: string;
          };
        };
      }>;
    } = {};

    if (
      status === "PENDING" ||
      status === "VALID" ||
      status === "INVALID" ||
      status === "PROCESSED" ||
      status === "DUPLICATE" ||
      status === "REVIEW_REQUIRED"
    ) {
      where.status = status;
    }

    if (
      source === "QR" ||
      source === "BARCODE" ||
      source === "OCR" ||
      source === "MANUAL"
    ) {
      where.source = source;
    }

    if (search) {
      where.OR = [
        {
          documentNumber: {
            contains: search,
          },
        },
        {
          documentType: {
            contains: search,
          },
        },
        {
          rawText: {
            contains: search,
          },
        },
        {
          transaction: {
            transactionNumber: {
              contains: search,
            },
          },
        },
      ];
    }

    const skip =
      (page - 1) * limit;

    const [documents, total] =
      await prisma.$transaction([
        prisma.scannedDocument.findMany({
          where,

          orderBy: {
            scannedAt: "desc",
          },

          skip,
          take: limit,

          include: {
            transaction: {
              select: {
                id: true,
                transactionNumber: true,
                quantity: true,

                transactionType: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },

                spk: {
                  select: {
                    id: true,
                    spkNumber: true,
                  },
                },
              },
            },

            scannedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),

        prisma.scannedDocument.count({
          where,
        }),
      ]);

    return NextResponse.json({
      success: true,

      data: documents,

      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(
      "GET scanner history error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load scanner history.",
      },
      { status: 500 },
    );
  }
}