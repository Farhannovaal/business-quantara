
import { NextResponse } from "next/server";
import type {
  PermissionOverrideEffect,
  User,
} from "@prisma/client";

export type AuthorizationUser = Pick<User, "id"> & {
  role: {
    name: string;
    permissions: {
      permission: {
        code: string;
      };
    }[];
  } | null;

  permissionOverrides?: {
    effect: PermissionOverrideEffect;
    permission: {
      code: string;
    };
  }[];
};

/**
 * Centralized Superadmin detection.
 */
export function isSuperAdmin(
  user:
    | { role: { name: string } | null }
    | null
    | undefined
): boolean {
  return (
    user?.role?.name?.trim().toLowerCase() ===
    "superadmin"
  );
}

/**
 * Calculate effective permissions.
 *
 * Priority:
 * - Role permissions provide the baseline.
 * - GRANT adds permission.
 * - DENY removes permission.
 * - Superadmin bypasses permission checks.
 */
export function getEffectivePermissions(
  user: AuthorizationUser
): string[] {
  const permissions = new Set(
    user.role?.permissions.map(
      (item) => item.permission.code
    ) ?? []
  );

  if (isSuperAdmin(user)) {
    return [...permissions];
  }

  for (const override of user.permissionOverrides ?? []) {
    if (override.effect === "GRANT") {
      permissions.add(override.permission.code);
    } else if (override.effect === "DENY") {
      permissions.delete(override.permission.code);
    }
  }

  return [...permissions];
}

/**
 * Check effective permission.
 */
export function hasPermission(
  user: AuthorizationUser,
  permissionCode: string
): boolean {
  if (isSuperAdmin(user)) {
    return true;
  }

  return getEffectivePermissions(user).includes(
    permissionCode
  );
}

/**
 * Require permission.
 */
export function requirePermission(
  user: AuthorizationUser,
  permissionCode: string
): {
  allowed: boolean;
  response: NextResponse | null;
} {
  if (!hasPermission(user, permissionCode)) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          permission: permissionCode,
          message: "You do not have permission to perform this action.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    allowed: true,
    response: null,
  };
}
