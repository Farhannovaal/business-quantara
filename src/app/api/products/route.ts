import { requirePermission } from "@/lib/auth/authorization";

import { requireAuth } from "@/lib/auth/require-auth";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }
  const permission = requirePermission(
    user,
    "product.view"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const products = await prisma.product.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("GET /api/products error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load products",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }
  const permission = requirePermission(
    user,
    "product.manage"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const body = await request.json();

    const code = String(body.code ?? "").trim();
    const name = String(body.name ?? "").trim();
    const isActive = body.isActive !== false;

    if (!code || !name) {
      return NextResponse.json(
        {
          success: false,
          error: "Product code and name are required",
        },
        { status: 400 }
      );
    }

    const existingProduct = await prisma.product.findUnique({
      where: {
        code,
      },
    });

    if (existingProduct) {
      return NextResponse.json(
        {
          success: false,
          error: "Product code already exists",
        },
        { status: 409 }
      );
    }

    const product = await prisma.product.create({
      data: {
        code,
        name,
        isActive,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: product,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/products error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create product",
      },
      { status: 500 }
    );
  }
}