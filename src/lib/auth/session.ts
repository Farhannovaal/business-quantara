import { cookies } from "next/headers";
import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "bo_session";

const SESSION_DURATION_SECONDS = 60 * 60 * 8; // 8 jam

export async function createSession(userId: number) {
  const sessionId = randomBytes(32).toString("hex");

  const expiresAt = new Date(
    Date.now() +
      SESSION_DURATION_SECONDS * 1000,
  );

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });

  return sessionId;
}

export async function getSession() {
  const cookieStore = await cookies();

  const sessionId =
    cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({
      where: {
        id: session.id,
      },
    });

    cookieStore.delete(SESSION_COOKIE);

    return null;
  }

  return session;
}

export async function destroySession() {
  const cookieStore = await cookies();

  const sessionId =
    cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    await prisma.session.deleteMany({
      where: {
        id: sessionId,
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}