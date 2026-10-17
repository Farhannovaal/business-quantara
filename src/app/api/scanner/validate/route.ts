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

    if (!hasPermission(user, "scanner.view")) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        { status: 403 },
      );
    }

    // Scanner documents must belong to the authenticated tenant.
    if (user.companyId == null) {
      return NextResponse.json(
        {
          success: false,
          error: "Company is not assigned to this user.",
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

    const allowedSources = ["QR", "BARCODE", "OCR", "MANUAL"] as const;

    if (!allowedSources.includes(source as (typeof allowedSources)[number])) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid scanner source",
        },
        { status: 400 },
      );
    }

    const normalizedDocumentNumber = documentNumber.toUpperCase();
    const normalizedSource = source as (typeof allowedSources)[number];

    /*
     * Cari dokumen berdasarkan compound unique key tenant + document number.
     * Include transaction agar data relasi tersedia saat membentuk response.
     */
    const existingScan = await prisma.scannedDocument.findUnique({
      where: {
        companyId_documentNumber: {
          companyId: user.companyId,
          documentNumber: normalizedDocumentNumber,
        },
      },
      include: {
        transaction: {
          include: {
            spk: {
              include: {
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

    // Dokumen sudah diproses.
    if (existingScan && existingScan.status === "PROCESSED") {
      const transaction = existingScan.transaction;

      return NextResponse.json(
        {
          success: true,
          valid: false,
          duplicate: true,
          status: "PROCESSED",
          message: "This document has already been processed.",
          document: {
            id: existingScan.id,
            documentNumber: existingScan.documentNumber,
            documentType: existingScan.documentType,
            source: existingScan.source,
            status: existingScan.status,
            scannedAt: existingScan.scannedAt,
            processedAt: existingScan.processedAt,
          },
          transaction: transaction
            ? {
                id: transaction.id,
                transactionNumber: transaction.transactionNumber,
                quantity: transaction.quantity,
                createdAt: transaction.createdAt,
                transactionType: transaction.transactionType
                  ? {
                      id: transaction.transactionType.id,
                      code: transaction.transactionType.code,
                      name: transaction.transactionType.name,
                    }
                  : null,
                spk: transaction.spk
                  ? {
                      id: transaction.spk.id,
                      spkNumber: transaction.spk.spkNumber,
                      status: transaction.spk.status,
                    }
                  : null,
                product: transaction.product
                  ? {
                      id: transaction.product.id,
                      code: transaction.product.code,
                      name: transaction.product.name,
                    }
                  : null,
                tailor: transaction.tailor
                  ? {
                      id: transaction.tailor.id,
                      name: transaction.tailor.name,
                    }
                  : null,
                employee: transaction.employee
                  ? {
                      id: transaction.employee.id,
                      name: transaction.employee.name,
                    }
                  : null,
              }
            : null,
        },
        { status: 200 },
      );
    }

    // Dokumen sudah ada, tetapi belum diproses.
    if (existingScan) {
      const transaction = existingScan.transaction;

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
              ? existingScan.validationMessage || "This document is invalid."
              : existingScan.status === "REVIEW_REQUIRED"
                ? existingScan.validationMessage ||
                  "This document requires manual review."
                : "Document found.",
          document: {
            id: existingScan.id,
            documentNumber: existingScan.documentNumber,
            documentType: existingScan.documentType,
            source: existingScan.source,
            status: existingScan.status,
            scannedAt: existingScan.scannedAt,
            processedAt: existingScan.processedAt,
          },
          transaction: transaction
            ? {
                id: transaction.id,
                transactionNumber: transaction.transactionNumber,
                quantity: transaction.quantity,
                createdAt: transaction.createdAt,
                transactionType: transaction.transactionType,
                spk: transaction.spk,
                product: transaction.product,
                tailor: transaction.tailor,
                employee: transaction.employee,
              }
            : null,
        },
        { status: 200 },
      );
    }

    // Belum ada dokumen untuk tenant ini, buat sebagai PENDING.
    const scannedDocument = await prisma.scannedDocument.create({
      data: {
        companyId: user.companyId,
        documentNumber: normalizedDocumentNumber,
        source: normalizedSource,
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
          documentNumber: scannedDocument.documentNumber,
          source: scannedDocument.source,
          status: scannedDocument.status,
          scannedAt: scannedDocument.scannedAt,
        },
        transaction: null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/scanner/validate error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
