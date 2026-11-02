
import { NextResponse } from "next/server";
import type {
  User,
  PermissionOverrideEffect,
} from "@prisma/client";

export type UserWithRolePermissions = User & {
  role: {
    name: string;
    permissions: {
      permission: {
        code: string;
      };
    }[];
  } | null;

  permissionOverrides: {
    effect: PermissionOverrideEffect;
    permission: {
      code: string;
    };
  }[];
};

export function isSuperAdmin(
  user: UserWithRolePermissions,
): boolean {
  return user.role?.name === "Superadmin";
}

export function getEffectivePermissions(
  user: UserWithRolePermissions,
): string[] {
  const permissions = new Set<string>(
    user.role?.permissions.map(
      (item) => item.permission.code,
    ) ?? [],
  );

  // Superadmin tidak dipengaruhi individual override.
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

export function hasPermission(
  user: UserWithRolePermissions,
  permissionCode: string,
): boolean {
  if (isSuperAdmin(user)) {
    return true;
  }

  return getEffectivePermissions(user).includes(permissionCode);
}

export function requirePermission(
  user: UserWithRolePermissions,
  permissionCode: string,
) {
  if (!hasPermission(user, permissionCode)) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          permission: permissionCode,
        },
        { status: 403 },
      ),
    };
  }

  return {
    allowed: true,
    response: null,
  };
}
