import { prisma } from "@/lib/prisma";

export type TailorBillAction =
  | "SUBMIT"
  | "PAY"
  | "CANCEL";

type StatusActionResult = {
  id: number;
  billNumber: string;
  status: string;
  paidAt: Date | null;
};

export async function submitTailorBill(
  billId: number,
  userId: number,
): Promise<StatusActionResult> {
  if (!Number.isInteger(billId) || billId <= 0) {
    throw new Error("ID tagihan tidak valid.");
  }

  return prisma.$transaction(async (tx) => {
    const bill = await tx.tailorBill.findUnique({
      where: {
        id: billId,
      },
    });

    if (!bill) {
      throw new Error("Tagihan tidak ditemukan.");
    }

    if (bill.status !== "DRAFT") {
      throw new Error(
        `Tagihan ${bill.billNumber} tidak dapat diajukan karena status saat ini ${bill.status}.`,
      );
    }

    const updated = await tx.tailorBill.update({
      where: {
        id: bill.id,
      },

      data: {
        status: "SUBMITTED",
      },

      select: {
        id: true,
        billNumber: true,
        status: true,
        paidAt: true,
      },
    });

    await tx.activityLog.create({
      data: {
        userId,
        action: "UPDATE",
        entityType: "TAILOR_BILL",
        entityId: String(bill.id),
        description: `Mengajukan tagihan penjahit ${bill.billNumber}`,
      },
    });

    return updated;
  });
}

export async function payTailorBill(
  billId: number,
  userId: number,
): Promise<StatusActionResult> {
  if (!Number.isInteger(billId) || billId <= 0) {
    throw new Error("ID tagihan tidak valid.");
  }

  return prisma.$transaction(async (tx) => {
    const bill = await tx.tailorBill.findUnique({
      where: {
        id: billId,
      },
    });

    if (!bill) {
      throw new Error("Tagihan tidak ditemukan.");
    }

    if (bill.status !== "SUBMITTED") {
      throw new Error(
        `Tagihan ${bill.billNumber} belum dapat dibayar. Status saat ini ${bill.status}.`,
      );
    }

    const paidAt = new Date();

    const updated = await tx.tailorBill.update({
      where: {
        id: bill.id,
      },

      data: {
        status: "PAID",
        paidAt,
      },

      select: {
        id: true,
        billNumber: true,
        status: true,
        paidAt: true,
      },
    });

    await tx.activityLog.create({
      data: {
        userId,
        action: "UPDATE",
        entityType: "TAILOR_BILL",
        entityId: String(bill.id),
        description: `Membayar tagihan penjahit ${bill.billNumber}`,
      },
    });

    return updated;
  });
}

export async function cancelTailorBill(
  billId: number,
  userId: number,
): Promise<StatusActionResult> {
  if (!Number.isInteger(billId) || billId <= 0) {
    throw new Error("ID tagihan tidak valid.");
  }

  return prisma.$transaction(async (tx) => {
    const bill = await tx.tailorBill.findUnique({
      where: {
        id: billId,
      },
    });

    if (!bill) {
      throw new Error("Tagihan tidak ditemukan.");
    }

    if (
      bill.status !== "DRAFT" &&
      bill.status !== "SUBMITTED"
    ) {
      throw new Error(
        `Tagihan ${bill.billNumber} tidak dapat dibatalkan karena status saat ini ${bill.status}.`,
      );
    }

    const updated = await tx.tailorBill.update({
      where: {
        id: bill.id,
      },

      data: {
        status: "CANCELLED",
      },

      select: {
        id: true,
        billNumber: true,
        status: true,
        paidAt: true,
      },
    });

    await tx.activityLog.create({
      data: {
        userId,
        action: "UPDATE",
        entityType: "TAILOR_BILL",
        entityId: String(bill.id),
        description: `Membatalkan tagihan penjahit ${bill.billNumber}`,
      },
    });

    return updated;
  });
}