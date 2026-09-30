import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";

export async function POST(request: NextRequest) {
  try {
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
        { status: 401 },
      );
    }

    console.log("AUTH USER:", {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name,
      permissions: user.role?.permissions?.map(
        (item) => item.permission.code,
      ),
    });

    if (!hasPermission(user, "scanner.view")) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    const documentNumber =
      typeof body?.documentNumber === "string"
        ? body.documentNumber.trim()
        : "";

    const source =
      typeof body?.source === "string"
        ? body.source.trim().toUpperCase()
        : "MANUAL";

    if (!documentNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Document number is required",
        },
        { status: 400 },
      );
    }

    const allowedSources = [
      "QR",
      "BARCODE",
      "OCR",
      "MANUAL",
    ];

    if (!allowedSources.includes(source)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid scanner source",
        },
        { status: 400 },
      );
    }

    const normalizedDocumentNumber =
      documentNumber.toUpperCase();

    const existingScan =
      await prisma.scannedDocument.findUnique({
        where: {
          documentNumber: normalizedDocumentNumber,
        },
        include: {
          transaction: {
            include: {
              spk: {
                include: {
                  product: true,
                  tailor: true,
                },
              },
              transactionType: true,
              product: true,
              tailor: true,
              employee: true,
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
      });

    if (
      existingScan &&
      existingScan.status === "PROCESSED"
    ) {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          duplicate: true,
          status: "PROCESSED",
          message:
            "This document has already been processed.",
          document: {
            id: existingScan.id,
            documentNumber:
              existingScan.documentNumber,
            documentType:
              existingScan.documentType,
            source: existingScan.source,
            status: existingScan.status,
            scannedAt: existingScan.scannedAt,
            processedAt:
              existingScan.processedAt,
          },
          transaction:
            existingScan.transaction
              ? {
                  id: existingScan.transaction.id,
                  transactionNumber:
                    existingScan.transaction
                      .transactionNumber,
                  quantity:
                    existingScan.transaction.quantity,
                  createdAt:
                    existingScan.transaction
                      .createdAt,
                  transactionType: {
                    id:
                      existingScan.transaction
                        .transactionType.id,
                    code:
                      existingScan.transaction
                        .transactionType.code,
                    name:
                      existingScan.transaction
                        .transactionType.name,
                  },
                  spk: {
                    id:
                      existingScan.transaction.spk.id,
                    spkNumber:
                      existingScan.transaction.spk
                        .spkNumber,
                    status:
                      existingScan.transaction.spk
                        .status,
                  },
                  product: {
                    id:
                      existingScan.transaction.product.id,
                    code:
                      existingScan.transaction.product
                        .code,
                    name:
                      existingScan.transaction.product
                        .name,
                  },
                  tailor: {
                    id:
                      existingScan.transaction.tailor.id,
                    name:
                      existingScan.transaction.tailor
                        .name,
                  },
                  employee: {
                    id:
                      existingScan.transaction.employee.id,
                    name:
                      existingScan.transaction.employee
                        .name,
                  },
                }
              : null,
        },
        { status: 200 },
      );
    }

    if (existingScan) {
      return NextResponse.json(
        {
          success: true,
          valid:
            existingScan.status === "VALID" ||
            existingScan.status === "PENDING",
          duplicate: false,
          status: existingScan.status,
          message:
            existingScan.status === "INVALID"
              ? existingScan.validationMessage ||
                "This document is invalid."
              : existingScan.status ===
                  "REVIEW_REQUIRED"
                ? existingScan.validationMessage ||
                  "This document requires manual review."
                : "Document found.",
          document: {
            id: existingScan.id,
            documentNumber:
              existingScan.documentNumber,
            documentType:
              existingScan.documentType,
            source: existingScan.source,
            status: existingScan.status,
            scannedAt: existingScan.scannedAt,
            processedAt:
              existingScan.processedAt,
          },
          transaction:
            existingScan.transaction
              ? {
                  id: existingScan.transaction.id,
                  transactionNumber:
                    existingScan.transaction
                      .transactionNumber,
                  quantity:
                    existingScan.transaction.quantity,
                  createdAt:
                    existingScan.transaction
                      .createdAt,
                  transactionType:
                    existingScan.transaction
                      .transactionType,
                  spk:
                    existingScan.transaction.spk,
                  product:
                    existingScan.transaction.product,
                  tailor:
                    existingScan.transaction.tailor,
                  employee:
                    existingScan.transaction.employee,
                }
              : null,
        },
        { status: 200 },
      );
    }

    const scannedDocument =
      await prisma.scannedDocument.create({
        data: {
          documentNumber:
            normalizedDocumentNumber,
          source: source as
            | "QR"
            | "BARCODE"
            | "OCR"
            | "MANUAL",
          status: "PENDING",
          scannedByUserId: user.id,
        },
      });

    return NextResponse.json(
      {
        success: true,
        valid: false,
        duplicate: false,
        status: "PENDING",
        message:
          "Document scanned successfully. Waiting for validation.",
        document: {
          id: scannedDocument.id,
          documentNumber:
            scannedDocument.documentNumber,
          source: scannedDocument.source,
          status: scannedDocument.status,
          scannedAt: scannedDocument.scannedAt,
        },
        transaction: null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/scanner/validate error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}