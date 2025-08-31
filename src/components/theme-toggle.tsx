"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

// Minimal, dependency-free theme toggle using `html.dark` class.
// - Persists preference to localStorage("theme") as "light" | "dark"
// - Respects system preference on first load if no stored preference
// - Syncs across tabs via the storage event
export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const root = document.documentElement
    const apply = (val: string | null) => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      const theme = val ?? (prefersDark ? "dark" : "light")
      if (theme === "dark") root.classList.add("dark")
      else root.classList.remove("dark")
    }

    apply(localStorage.getItem("theme"))

    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme") apply(e.newValue)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const toggle = () => {
    const root = document.documentElement
    const isDark = root.classList.contains("dark")
    const next = isDark ? "light" : "dark"
    if (next === "dark") root.classList.add("dark")
    else root.classList.remove("dark")
    localStorage.setItem("theme", next)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={toggle}
      // Prevent React hydration warnings for subtree when theme differs server vs client
      suppressHydrationWarning
    >
      {mounted ? (
        <>
          <Sun className="size-5 block dark:hidden" />
          <Moon className="size-5 hidden dark:block" />
        </>
      ) : (
        // Render a stable icon before mount so server and first client render match
        <Sun className="size-5" />
      )}
    </Button>
  )
}