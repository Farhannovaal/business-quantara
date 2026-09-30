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
    "tailor.view"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const tailors = await prisma.tailor.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: tailors,
    });
  } catch (error) {
    console.error("GET /api/tailors error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load tailors",
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
    "tailor.manage"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const isActive = body.isActive !== false;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Tailor name is required",
        },
        { status: 400 }
      );
    }

    const existingTailor = await prisma.tailor.findUnique({
      where: {
        name,
      },
    });

    if (existingTailor) {
      return NextResponse.json(
        {
          success: false,
          error: "Tailor name already exists",
        },
        { status: 409 }
      );
    }

    const tailor = await prisma.tailor.create({
      data: {
        name,
        isActive,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: tailor,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/tailors error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create tailor",
      },
      { status: 500 }
    );
  }
}