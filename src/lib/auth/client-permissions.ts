export type PermissionUser = {
  role?: {
    permissions?: {
      permission: {
        code: string;
      };
    }[];
  } | null;
};

export function hasPermission(
  user: PermissionUser | null,
  permissionCode: string
) {
  if (!user?.role) {
    return false;
  }

  return user.role.permissions?.some(
    (item) => item.permission.code === permissionCode
  ) ?? false;
}