import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTransaction, TransactionEngineError } from "@/lib/transaction/engine";
import { canCreateTransactionType } from "@/lib/transaction/permissions";

type BatchItem = { productId: number; quantity: number };

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();
  if (response) return response;

  const permission = requirePermission(user, "transaction.view");
  if (permission.response) return permission.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() || "";
    const spkIdParam = searchParams.get("spkId");
    const transactionTypeIdParam = searchParams.get("transactionTypeId");

    const where: {
      spkId?: number;
      transactionTypeId?: number;
      OR?: Array<{
        transactionNumber?: { contains: string };
        spk?: { spkNumber?: { contains: string } };
      }>;
    } = {};

    if (spkIdParam) {
      const spkId = Number(spkIdParam);
      if (!Number.isInteger(spkId) || spkId <= 0) {
        return NextResponse.json({ success: false, error: "Invalid SPK ID." }, { status: 400 });
      }
      where.spkId = spkId;
    }

    if (transactionTypeIdParam) {
      const transactionTypeId = Number(transactionTypeIdParam);
      if (!Number.isInteger(transactionTypeId) || transactionTypeId <= 0) {
        return NextResponse.json({ success: false, error: "Invalid transaction type ID." }, { status: 400 });
      }
      where.transactionTypeId = transactionTypeId;
    }

    if (search) {
      where.OR = [
        { transactionNumber: { contains: search } },
        { spk: { spkNumber: { contains: search } } },
      ];
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        spk: { select: { id: true, spkNumber: true } },
        transactionType: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, code: true, name: true } },
        tailor: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: transactions });
  } catch (error) {
    console.error("GET transactions error:", error);
    return NextResponse.json({ success: false, error: "Failed to load transactions." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth();
  if (response) return response;

  try {
    const body = await request.json();
    const spkId = Number(body?.spkId);
    const transactionTypeId = Number(body?.transactionTypeId);
    const employeeId = Number(body?.employeeId);

    // Format batch: items: [{ productId, quantity }].
    // Format lama productId + quantity tetap didukung agar client lain tidak rusak.
    const items: BatchItem[] = Array.isArray(body?.items)
      ? body.items.map((item: { productId: unknown; quantity: unknown }) => ({
          productId: Number(item?.productId),
          quantity: Number(item?.quantity),
        }))
      : [{ productId: Number(body?.productId), quantity: Number(body?.quantity) }];

    if (!Number.isInteger(spkId) || spkId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid SPK ID." }, { status: 400 });
    }
    if (!Number.isInteger(transactionTypeId) || transactionTypeId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid transaction type ID." }, { status: 400 });
    }
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid employee ID." }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "Pilih minimal satu produk." }, { status: 400 });
    }
    if (items.some((item) => !Number.isInteger(item.productId) || item.productId <= 0 || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      return NextResponse.json({ success: false, error: "Setiap produk harus memiliki ID valid dan jumlah bulat lebih dari 0." }, { status: 400 });
    }
    if (new Set(items.map((item) => item.productId)).size !== items.length) {
      return NextResponse.json({ success: false, error: "Produk yang sama tidak boleh dimasukkan dua kali." }, { status: 400 });
    }

    const transactionType = await prisma.transactionType.findUnique({
      where: { id: transactionTypeId },
      select: { id: true, code: true, name: true, isActive: true },
    });

    if (!transactionType) {
      return NextResponse.json({ success: false, error: "Transaction type not found." }, { status: 404 });
    }
    if (!transactionType.isActive) {
      return NextResponse.json({ success: false, error: "Transaction type is inactive." }, { status: 400 });
    }

    if (!canCreateTransactionType(user, transactionType.code)) {
      return NextResponse.json({
        success: false,
        error: "Anda tidak memiliki akses untuk melakukan jenis transaksi ini.",
        transactionType: { id: transactionType.id, code: transactionType.code, name: transactionType.name },
      }, { status: 403 });
    }

    const results = await prisma.$transaction(
      async (tx) => {
        const spk = await tx.sPK.findUnique({
          where: { id: spkId },
          select: { tailorId: true },
        });

        if (!spk) {
          throw new TransactionEngineError(
            "SPK_NOT_FOUND",
            "SPK not found.",
            404
          );
        }

        const created = [];

        for (const item of items) {
          const transaction = await createTransaction(tx, {
            spkId,
            transactionTypeId,
            productId: item.productId,
            tailorId: spk.tailorId,
            employeeId,
            quantity: item.quantity,
            createdById: user.id,
          });

          created.push(transaction);
        }

        return created;
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );

    return NextResponse.json({ success: true, data: results, count: results.length }, { status: 201 });
  } catch (error) {
    console.error("POST transaction error:", error);

    if (error instanceof TransactionEngineError) {
      return NextResponse.json({
        success: false,
        error: error.message,
        ...(error.maxQuantity !== undefined ? { maxQuantity: error.maxQuantity } : {}),
      }, { status: error.status });
    }

    return NextResponse.json({ success: false, error: "Failed to create transaction." }, { status: 500 });
  }
}
