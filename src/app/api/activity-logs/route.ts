import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(
    user,
    "activity.view",
    );

  if (permission.response) {
    return permission.response;
  }

  try {
    const searchParams =
      request.nextUrl.searchParams;

    const search =
      searchParams.get("search")?.trim() || "";

    const action =
      searchParams.get("action")?.trim() || "";

    const entityType =
      searchParams
        .get("entityType")
        ?.trim() || "";

    const pageParam =
      Number(searchParams.get("page") || 1);

    const limitParam =
      Number(searchParams.get("limit") || 20);

    const page =
      Number.isInteger(pageParam) &&
      pageParam > 0
        ? pageParam
        : 1;

    const limit =
      Number.isInteger(limitParam) &&
      limitParam > 0 &&
      limitParam <= 100
        ? limitParam
        : 20;

    const where: {
      action?: string;
      entityType?: string;
      OR?: Array<{
        description?: {
          contains: string;
        };
        entityId?: {
          contains: string;
        };
        user?: {
          name?: {
            contains: string;
          };
          email?: {
            contains: string;
          };
        };
      }>;
    } = {};

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (search) {
      where.OR = [
        {
          description: {
            contains: search,
          },
        },
        {
          entityId: {
            contains: search,
          },
        },
        {
          user: {
            name: {
              contains: search,
            },
          },
        },
        {
          user: {
            email: {
              contains: search,
            },
          },
        },
      ];
    }

    const skip =
      (page - 1) * limit;

    const [logs, total] =
      await prisma.$transaction([
        prisma.activityLog.findMany({
          where,

          orderBy: {
            createdAt: "desc",
          },

          skip,
          take: limit,

          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),

        prisma.activityLog.count({
          where,
        }),
      ]);

    return NextResponse.json({
      success: true,

      data: logs,

      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(
      "GET activity logs error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load activity logs.",
      },
      { status: 500 },
    );
  }
}