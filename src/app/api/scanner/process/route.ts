import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";
import {
  createTransaction,
  TransactionEngineError,
} from "@/lib/transaction/engine";

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

    if (!hasPermission(user, "scanner.create")) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    const scannedDocumentId =
      Number(body?.scannedDocumentId);

    const spkId = Number(body?.spkId);
    const transactionTypeId =
      Number(body?.transactionTypeId);
    const productId = Number(body?.productId);
    const tailorId = Number(body?.tailorId);
    const employeeId = Number(body?.employeeId);
    const quantity = Number(body?.quantity);

    if (
      !Number.isInteger(scannedDocumentId) ||
      scannedDocumentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid scanned document",
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const scannedDocument =
          await tx.scannedDocument.findUnique({
            where: {
              id: scannedDocumentId,
            },
          });

        if (!scannedDocument) {
          throw new TransactionEngineError(
            "SCANNED_DOCUMENT_NOT_FOUND",
            "Scanned document not found",
            404,
          );
        }

        if (
          scannedDocument.status === "PROCESSED" ||
          scannedDocument.transactionId
        ) {
          throw new TransactionEngineError(
            "DOCUMENT_ALREADY_PROCESSED",
            "This document has already been processed",
            409,
          );
        }

        const transaction =
          await createTransaction(tx, {
            spkId,
            transactionTypeId,
            productId,
            tailorId,
            employeeId,
            quantity,
            createdById: user.id,
          });

        await tx.scannedDocument.update({
          where: {
            id: scannedDocument.id,
          },
          data: {
            status: "PROCESSED",
            transactionId: transaction.id,
            processedAt: new Date(),
            validationMessage:
              "Document successfully processed.",
          },
        });

        return {
          transaction,
          scannedDocument: {
            id: scannedDocument.id,
            documentNumber:
              scannedDocument.documentNumber,
            status: "PROCESSED",
          },
        };
      },
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Transaction successfully created.",
        transaction: {
          id: result.transaction.id,
          transactionNumber:
            result.transaction.transactionNumber,
          quantity:
            result.transaction.quantity,
          createdAt:
            result.transaction.createdAt,
          transactionType:
            result.transaction.transactionType,
          spk: result.transaction.spk,
          product:
            result.transaction.product,
          tailor:
            result.transaction.tailor,
          employee:
            result.transaction.employee,
        },
        scannedDocument:
          result.scannedDocument,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/scanner/process error:",
      error,
    );

    if (
      error instanceof TransactionEngineError
    ) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          ...(error.maxQuantity !== undefined
            ? {
                maxQuantity:
                  error.maxQuantity,
              }
            : {}),
        },
        {
          status: error.status,
        },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}