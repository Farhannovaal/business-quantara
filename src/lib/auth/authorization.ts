import { NextResponse } from "next/server";
import type { User } from "@prisma/client";

type UserWithRolePermissions = User & {
  role: {
    permissions: {
      permission: {
        code: string;
      };
    }[];
  } | null;
};

export function hasPermission(
  user: UserWithRolePermissions,
  permissionCode: string
) {
  if (!user.role) {
    return false;
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