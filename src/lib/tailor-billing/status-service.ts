import { prisma } from "@/lib/prisma";

export type TailorBillAction =
  | "SUBMIT"
  | "PAY"
  | "CANCEL";

const tailorBillInclude = {
  tailor: {
    select: {
      id: true,
      name: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  items: {
    include: {
      spk: {
        select: {
          id: true,
          spkNumber: true,
        },
      },
      product: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
} as const;

export async function submitTailorBill(
  billId: number,
  userId: number,
) {
  if (!Number.isInteger(billId) || billId <= 0) {
    throw new Error("ID tagihan tidak valid.");
  }

  await prisma.$transaction(async (tx) => {
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

    await tx.tailorBill.update({
      where: {
        id: bill.id,
      },
      data: {
        status: "SUBMITTED",
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
  });

  const result = await prisma.tailorBill.findUnique({
    where: {
      id: billId,
    },
    include: tailorBillInclude,
  });

  if (!result) {
    throw new Error("Tagihan tidak ditemukan setelah submit.");
  }

  return result;
}

export async function payTailorBill(
  billId: number,
  userId: number,
) {
  if (!Number.isInteger(billId) || billId <= 0) {
    throw new Error("ID tagihan tidak valid.");
  }

  await prisma.$transaction(async (tx) => {
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

    await tx.tailorBill.update({
      where: {
        id: bill.id,
      },
      data: {
        status: "PAID",
        paidAt,
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
  });

  const result = await prisma.tailorBill.findUnique({
    where: {
      id: billId,
    },
    include: tailorBillInclude,
  });

  if (!result) {
    throw new Error("Tagihan tidak ditemukan setelah pembayaran.");
  }

  return result;
}

export async function cancelTailorBill(
  billId: number,
  userId: number,
) {
  if (!Number.isInteger(billId) || billId <= 0) {
    throw new Error("ID tagihan tidak valid.");
  }

  await prisma.$transaction(async (tx) => {
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

    await tx.tailorBill.update({
      where: {
        id: bill.id,
      },
      data: {
        status: "CANCELLED",
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
  });

  const result = await prisma.tailorBill.findUnique({
    where: {
      id: billId,
    },
    include: tailorBillInclude,
  });

  if (!result) {
    throw new Error("Tagihan tidak ditemukan setelah pembatalan.");
  }

  return result;
}