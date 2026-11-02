
import { NextRequest, NextResponse } from "next/server";
import { PermissionOverrideEffect } from "@prisma/client";

import { requireAuth } from "@/lib/auth/require-auth";
import {
  requirePermission,
  isSuperAdmin,
} from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type OverrideInput = {
  permissionId: number;
  effect: "GRANT" | "DENY";
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

async function getTargetUser(
  userId: number,
  actor: NonNullable<
    Awaited<ReturnType<typeof requireAuth>>["user"]
  >,
) {
  return prisma.user.findFirst({
    where: isSuperAdmin(actor)
      ? { id: userId }
      : {
          id: userId,
          companyId: actor.companyId,
        },
    select: {
      id: true,
      name: true,
      email: true,
      companyId: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: {
            select: {
              permission: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      permissionOverrides: {
        select: {
          id: true,
          permissionId: true,
          effect: true,
          permission: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

function getEffectivePermissions(
  target: NonNullable<
    Awaited<ReturnType<typeof getTargetUser>>
  >,
) {
  const permissions = new Set(
    target.role?.permissions.map(
      (item) => item.permission.code,
    ) ?? [],
  );

  for (const override of target.permissionOverrides) {
    if (override.effect === "GRANT") {
      permissions.add(override.permission.code);
    } else {
      permissions.delete(override.permission.code);
    }
  }

  return [...permissions].sort();
}

/**
 * GET /api/users/[id]/permissions
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return response ?? jsonError("Unauthorized", 401);
  }

  const access = requirePermission(user, "user.manage");

  if (access.response) {
    return access.response;
  }

  try {
    const { id } = await context.params;
    const userId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return jsonError("ID pengguna tidak valid.", 400);
    }

    const target = await getTargetUser(userId, user);

    if (!target) {
      return jsonError("Pengguna tidak ditemukan.", 404);
    }

    if (target.role?.name === "Superadmin") {
      return jsonError(
        "Individual permission Superadmin tidak dapat diubah.",
        403,
      );
    }

    const permissions = await prisma.permission.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
    });

    const effectivePermissions =
      getEffectivePermissions(target);

    const rolePermissionIds = new Set(
      target.role?.permissions.map(
        (item) => item.permission.id,
      ) ?? [],
    );

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: target.id,
          name: target.name,
          email: target.email,
          role: target.role
            ? {
                id: target.role.id,
                name: target.role.name,
              }
            : null,
        },
        permissions: permissions.map((permission) => {
          const override =
            target.permissionOverrides.find(
              (item) =>
                item.permissionId === permission.id,
            );

          return {
            ...permission,
            inherited: rolePermissionIds.has(permission.id),
            override: override?.effect ?? "INHERIT",
            effective: effectivePermissions.includes(
              permission.code,
            ),
          };
        }),
      },
    });
  } catch (error) {
    console.error(
      "GET /api/users/[id]/permissions error:",
      error,
    );

    return jsonError(
      "Gagal mengambil individual permission.",
      500,
    );
  }
}

/**
 * PATCH /api/users/[id]/permissions
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return response ?? jsonError("Unauthorized", 401);
  }

  const access = requirePermission(user, "user.manage");

  if (access.response) {
    return access.response;
  }

  try {
    const { id } = await context.params;
    const userId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return jsonError("ID pengguna tidak valid.", 400);
    }

    const target = await getTargetUser(userId, user);

    if (!target) {
      return jsonError("Pengguna tidak ditemukan.", 404);
    }

    if (target.role?.name === "Superadmin") {
      return jsonError(
        "Individual permission Superadmin tidak dapat diubah.",
        403,
      );
    }

    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonError("Format data tidak valid.", 400);
    }

    const input = body as Record<string, unknown>;

    if (!Array.isArray(input.overrides)) {
      return jsonError(
        "Field overrides harus berupa array.",
        400,
      );
    }

    const overrides: OverrideInput[] = [];

    for (const item of input.overrides) {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item)
      ) {
        return jsonError(
          "Format individual permission tidak valid.",
          400,
        );
      }

      const value = item as Record<string, unknown>;

      if (
        typeof value.permissionId !== "number" ||
        !Number.isInteger(value.permissionId) ||
        value.permissionId <= 0
      ) {
        return jsonError("Permission ID tidak valid.", 400);
      }

      if (
        value.effect !== "GRANT" &&
        value.effect !== "DENY"
      ) {
        return jsonError(
          "Effect harus GRANT atau DENY.",
          400,
        );
      }

      overrides.push({
        permissionId: value.permissionId,
        effect: value.effect,
      });
    }

    const permissionIds = overrides.map(
      (item) => item.permissionId,
    );

    if (
      new Set(permissionIds).size !== permissionIds.length
    ) {
      return jsonError(
        "Permission yang sama tidak boleh dikirim lebih dari satu kali.",
        400,
      );
    }

    const requestedPermissions =
      permissionIds.length > 0
        ? await prisma.permission.findMany({
            where: {
              id: { in: permissionIds },
            },
            select: {
              id: true,
              code: true,
            },
          })
        : [];

    if (
      requestedPermissions.length !== permissionIds.length
    ) {
      return jsonError(
        "Terdapat permission yang tidak ditemukan.",
        400,
      );
    }

    const protectedPermissions = new Set([
      "user.manage",
      "role.manage",
    ]);

    if (
      requestedPermissions.some((permission) =>
        protectedPermissions.has(permission.code),
      )
    ) {
      return jsonError(
        "Permission administratif tidak dapat diubah melalui individual override.",
        403,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.userPermissionOverride.deleteMany({
        where: {
          userId: target.id,
        },
      });

      if (overrides.length > 0) {
        await tx.userPermissionOverride.createMany({
          data: overrides.map((override) => ({
            userId: target.id,
            permissionId: override.permissionId,
            effect:
              override.effect === "GRANT"
                ? PermissionOverrideEffect.GRANT
                : PermissionOverrideEffect.DENY,
          })),
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Individual permission berhasil diperbarui.",
    });
  } catch (error) {
    console.error(
      "PATCH /api/users/[id]/permissions error:",
      error,
    );

    return jsonError(
      "Gagal memperbarui individual permission.",
      500,
    );
  }
}
