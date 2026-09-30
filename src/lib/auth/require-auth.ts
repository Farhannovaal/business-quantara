import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function getAuthenticatedUser() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  return user;
}

export async function requireAuth() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}