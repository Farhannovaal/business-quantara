
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

type AuthenticatedUser = User & {
  role: {
    name: string;
    permissions: {
      permission: {
        code: string;
      };
    }[];
  } | null;
};

export async function getNotificationAccess() {
  const user = (await getAuthenticatedUser()) as AuthenticatedUser | null;

  if (!user) {
    return {
      user: null,
      isSuperAdmin: false,
      where: null,
      response: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const isSuperAdmin = user.role?.name === "Superadmin";
  const isAdministrator = user.role?.name === "Administrator";

  if (!isSuperAdmin && !isAdministrator) {
    return {
      user: null,
      isSuperAdmin: false,
      where: null,
      response: NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  if (!isSuperAdmin && !user.companyId) {
    return {
      user: null,
      isSuperAdmin: false,
      where: null,
      response: NextResponse.json(
        { success: false, error: "User belum memiliki perusahaan" },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    isSuperAdmin,
    where: isSuperAdmin ? {} : { companyId: user.companyId! },
    response: null,
  };
}

export async function getAccessibleNotificationConfig(id: number) {
  const access = await getNotificationAccess();

  if (access.response || !access.user || !access.where) {
    return {
      access,
      config: null,
    };
  }

  const config = await prisma.notificationConfig.findFirst({
    where: {
      id,
      ...access.where,
    },
  });

  return {
    access,
    config,
  };
}
