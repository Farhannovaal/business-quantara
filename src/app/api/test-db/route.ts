import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const products = await prisma.product.count();
    const spks = await prisma.sPK.count();
    const transactions = await prisma.transaction.count();

    return NextResponse.json({
      success: true,
      database: "business_operation",
      counts: {
        products,
        spks,
        transactions,
      },
    });
  } catch (error) {
    console.error("Database connection error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Database connection failed",
      },
      { status: 500 }
    );
  }
}