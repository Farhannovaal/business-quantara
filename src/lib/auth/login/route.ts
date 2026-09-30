import { cookies } from "next/headers";
import { randomBytes } from "crypto";

const SESSION_COOKIE = "bo_session";

const SESSION_DURATION_SECONDS = 60 * 60 * 8; // 8 jam

type SessionData = {
  userId: number;
  expiresAt: number;
};

/**
 * Temporary in-memory session store.
 *
 * Ini hanya untuk development/testing.
 * Nanti kita pindahkan ke Redis agar session:
 * - tetap tersedia setelah restart
 * - bisa dipakai multi-instance
 * - lebih cocok untuk production
 */
const sessions = new Map<string, SessionData>();

export async function createSession(userId: number) {
  const sessionId = randomBytes(32).toString("hex");

  const expiresAt =
    Date.now() +
    SESSION_DURATION_SECONDS * 1000;

  sessions.set(sessionId, {
    userId,
    expiresAt,
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

  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export async function destroySession() {
  const cookieStore = await cookies();

  const sessionId =
    cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    sessions.delete(sessionId);
  }

  cookieStore.delete(SESSION_COOKIE);
}