import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "bo_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================================
  // PUBLIC ROUTES
  // ============================================================

  // Login boleh diakses tanpa session.
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // API tidak diproteksi oleh Proxy.
  // API akan kita amankan menggunakan server-side auth.
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Next internal assets
  if (pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // ============================================================
  // SESSION CHECK
  // ============================================================

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;

  // Tidak ada session cookie → redirect ke login
  if (!sessionId) {
    const loginUrl = new URL("/login", request.url);

    // Simpan URL tujuan supaya nantinya bisa dikembalikan
    // setelah login.
    loginUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`
    );

    return NextResponse.redirect(loginUrl);
  }

  // Ada cookie → lanjutkan request.
  // Validasi session sebenarnya tetap dilakukan server-side.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
        * Jalankan Proxy untuk semua route aplikasi,
        * kecuali file statis.
        */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};