
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Theme"
        className="inline-flex h-10 w-10 items-center justify-center
          rounded-xl border border-border bg-card text-card-foreground"
      >
        <Sun size={18} />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Aktifkan White Mode" : "Aktifkan Dark Mode"}
      title={isDark ? "White Mode" : "Dark Mode"}
      className="inline-flex h-10 w-10 items-center justify-center
        rounded-xl border border-border bg-card text-card-foreground
        transition-colors hover:bg-muted
        focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-ring"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
