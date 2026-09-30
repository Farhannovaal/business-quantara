import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/require-auth";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const permissions =
      user.role?.permissions?.map(
        (rolePermission) =>
          rolePermission.permission.code
      ) ?? [];

    return NextResponse.json(
      {
        success: true,
        authenticated: true,

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,

          role: user.role
            ? {
                id: user.role.id,
                name: user.role.name,
              }
            : null,

          permissions,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "GET /api/auth/me error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        error: "Failed to get authenticated user",
      },
      {
        status: 500,
      }
    );
  }
}