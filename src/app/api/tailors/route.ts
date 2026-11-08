import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

export const GET = withApiAuth(
  async ({ tenant }) => {
    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: "Company context is unavailable.",
        },
        { status: 403 },
      );
    }

    try {
      const tailors = await prisma.tailor.findMany({
        where: {
          companyId: tenant.id,
        },
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
        { status: 500 },
      );
    }
  },
  {
    tenant: "required",
    permission: "tailor.view",
  },
);

export const POST = withApiAuth(
  async ({ request, tenant }) => {
    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: "Company context is unavailable.",
        },
        { status: 403 },
      );
    }

    try {
      const body = await request.json().catch(() => null);

      if (
        body === null ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid request body",
          },
          { status: 400 },
        );
      }

      const name =
        typeof body.name === "string"
          ? body.name.trim()
          : "";

      let isActive = true;

      if (body.isActive !== undefined) {
        if (typeof body.isActive !== "boolean") {
          return NextResponse.json(
            {
              success: false,
              error: "isActive must be a boolean",
            },
            { status: 400 },
          );
        }

        isActive = body.isActive;
      }

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error: "Tailor name is required",
          },
          { status: 400 },
        );
      }

      const companyId = tenant.id;

      const existingTailor = await prisma.tailor.findUnique({
        where: {
          companyId_name: {
            companyId,
            name,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingTailor) {
        return NextResponse.json(
          {
            success: false,
            error: "Tailor name already exists",
          },
          { status: 409 },
        );
      }

      const tailor = await prisma.tailor.create({
        data: {
          companyId,
          name,
          isActive,
        },
      });

      return NextResponse.json(
        {
          success: true,
          data: tailor,
        },
        { status: 201 },
      );
    } catch (error) {
      console.error("POST /api/tailors error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create tailor",
        },
        { status: 500 },
      );
    }
  },
  {
    tenant: "required",
    permission: "tailor.manage",
  },
);