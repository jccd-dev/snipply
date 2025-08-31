"use client";
import React, { createContext, useContext, useMemo, useState } from "react";

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const value = useMemo(() => ({ collapsed, setCollapsed }), [collapsed]);
  return (
    <SidebarContext.Provider value={value}>
      <div className="flex min-h-dvh w-full bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export function Sidebar({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <aside
      data-collapsed={collapsed}
      className={[
        "smooth border-r border-[var(--border)] bg-[color:var(--muted)]/50 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--muted)]/35",
        "h-dvh sticky top-0",
        collapsed ? "w-[76px]" : "w-[280px]",
      ].join(" ")}
    >
      {children}
    </aside>
  );
}

export function SidebarTrigger({ className = "" }: { className?: string }) {
  const { collapsed, setCollapsed } = useSidebar();
  return (
    <button
      aria-label="Toggle sidebar"
      onClick={() => setCollapsed(!collapsed)}
      className={[
        "smooth inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)]/80",
        "hover:bg-[var(--background)]/95 hover:shadow-sm",
        "h-9 w-9",
        className,
      ].join(" ")}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-80"
      >
        <path d="M3 12h18" />
        <path d="M8 6l-6 6 6 6" />
      </svg>
    </button>
  );
}

export function SidebarInset({ children }: { children: React.ReactNode }) {
  return <main className="flex-1 min-w-0">{children}</main>;
}