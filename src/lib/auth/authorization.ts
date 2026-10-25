
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";

type UserWithRolePermissions = User & {
  role: {
    name: string;
    permissions: {
      permission: {
        code: string;
      };
    }[];
  } | null;
};

export function isSuperAdmin(user: UserWithRolePermissions): boolean {
  return user.role?.name === "Superadmin";
}

export function hasPermission(
  user: UserWithRolePermissions,
  permissionCode: string
): boolean {
  if (!user.role) {
    return false;
  }

  if (user.role.name === "Superadmin") {
    return true;
  }

  return user.role.permissions.some(
    (rolePermission) =>
      rolePermission.permission.code === permissionCode
  );
}

export function requirePermission(
  user: UserWithRolePermissions,
  permissionCode: string
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
        {
          status: 403,
        }
      ),
    };
  }

  return {
    allowed: true,
    response: null,
  };
}
