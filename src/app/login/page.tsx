  "use client";

  import { FormEvent, useState } from "react";
  import {
    ArrowRight,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    ShieldCheck,
  } from "lucide-react";

  export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setError("");

      if (!email.trim() || !password) {
        setError("Email dan password wajib diisi.");
        return;
      }

      try {
        setLoading(true);

        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setError(result.message || "Email atau password salah.");
          return;
        }

        // Gunakan full page navigation agar data user dan permission dimuat ulang.
        window.location.href = "/";
      } catch (error) {
        console.error("Login error:", error);
        setError("Tidak dapat terhubung ke server.");
      } finally {
        setLoading(false);
      }
    }

    return (
      <main className="min-h-screen bg-[#080808] text-white">
        <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
          {/* PANEL KIRI */}
          <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#242020] via-[#111010] to-black lg:flex">
            {/* Dekorasi gradient */}
            <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-red-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-rose-900/20 blur-3xl" />
            <div className="pointer-events-none absolute left-1/3 top-1/3 h-64 w-64 rounded-full bg-white/[0.02] blur-3xl" />

            <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
              {/* BRAND */}
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur">
                    <ShieldCheck className="h-6 w-6 text-rose-200" />
                  </div>

                  <div>
                    <p className="text-lg font-bold tracking-tight text-white">
                      Overpassion Operation
                    </p>
                    <p className="text-sm text-neutral-400">
                      Operations Platform
                    </p>
                  </div>
                </div>
              </div>

              {/* HERO */}
              <div className="max-w-xl">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-rose-300/15 bg-rose-500/[0.06] px-3 py-1.5 text-xs font-medium text-rose-100 backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  Overpassion Operations System
                </div>

                <h1 className="text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
                  Manage your operations
                  <br />
                  <span className="bg-gradient-to-r from-neutral-200 via-white to-neutral-500 bg-clip-text text-transparent">
                    in one place.
                  </span>
                </h1>

                <p className="mt-6 max-w-lg text-base leading-7 text-neutral-400">
                  Kelola SPK, transaksi, production tracking, master data,
                  workflow, dan business rules dalam satu platform terintegrasi.
                </p>

                <div className="mt-8 flex items-center gap-3 text-xs text-neutral-500">
                  <span className="h-px w-10 bg-gradient-to-r from-rose-500/70 to-transparent" />
                  Integrated Overpassion Operations
                </div>
              </div>

              {/* FOOTER */}
              <div className="flex items-center justify-between text-sm text-neutral-500">
                <span>Overpassion Operation Platform</span>
                <span className="text-neutral-600">Secure workspace</span>
              </div>
            </div>
          </section>

          {/* PANEL KANAN / LOGIN */}
          <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#171414] via-[#0b0a0a] to-black px-6 py-12">
            {/* Glow background */}
            <div className="pointer-events-none absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-red-900/10 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-rose-950/10 blur-[100px]" />

            <div className="relative z-10 w-full max-w-md">
              {/* LOGO MOBILE */}
              <div className="mb-10 flex items-center gap-3 lg:hidden">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                  <ShieldCheck className="h-6 w-6 text-rose-200" />
                </div>

                <div>
                  <p className="font-bold text-white">
                    Overpassion Operation
                  </p>
                  <p className="text-xs text-neutral-500">
                    Operations Platform
                  </p>
                </div>
              </div>

              {/* LOGIN CARD */}
              <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
                {/* HEADER */}
                <div className="mb-8">
                  <p className="mb-2 text-sm font-semibold tracking-wide text-rose-300">
                    Welcome back
                  </p>

                  <h2 className="text-3xl font-bold tracking-tight text-white">
                    Sign in
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    Masuk untuk melanjutkan ke Overpassion Operation.
                  </p>
                </div>

                {/* FORM */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* EMAIL */}
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium text-neutral-300"
                    >
                      Email
                    </label>

                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="admin@business.local"
                        disabled={loading}
                        className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-rose-400/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* PASSWORD */}
                  <div>
                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-medium text-neutral-300"
                    >
                      Password
                    </label>

                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Masukkan password"
                        disabled={loading}
                        className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-rose-400/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        disabled={loading}
                        aria-label={
                          showPassword
                            ? "Sembunyikan password"
                            : "Tampilkan password"
                        }
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 transition hover:text-rose-300 disabled:cursor-not-allowed"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* ERROR */}
                  {error && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-400/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200"
                    >
                      {error}
                    </div>
                  )}

                  {/* SUBMIT */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-300/10 bg-gradient-to-r from-rose-800 via-red-900 to-[#651b24] px-4 text-sm font-semibold text-white shadow-lg shadow-red-950/30 transition hover:from-rose-700 hover:via-red-800 hover:to-[#7b202c] hover:shadow-red-950/50 focus:outline-none focus:ring-4 focus:ring-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>

                {/* FOOTER */}
                <div className="mt-8 border-t border-white/[0.08] pt-6 text-center">
                  <p className="text-xs text-neutral-500">
                    Overpassion Operation Platform
                  </p>
                </div>
              </div>

              <p className="mt-6 text-center text-xs text-neutral-600">
                Authorized access only
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }