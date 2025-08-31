"use client";
import React from "react";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import Link from "next/link";

const nav = [
  { label: "Overview", icon: "M4 6h16M4 12h16M4 18h16", href: "/" },
  { label: "Docs", icon: "M6 4h12v16H6z", href: "/docs" },
  { label: "Components", icon: "M4 8h16M4 16h16", href: "#" },
  { label: "Settings", icon: "M12 8a4 4 0 100 8 4 4 0 000-8z", href: "#" },
];

export function AppSidebar() {
  const { collapsed } = useSidebar();
  return (
    <Sidebar>
      <div className="flex h-16 items-center gap-2 p-3">
        <div className="size-9 rounded-xl bg-black/90 dark:bg-white/90 grid place-items-center text-white dark:text-black shadow-sm">S</div>
        {!collapsed && <div className="font-semibold">Snipply</div>}
      </div>
      <nav className="px-2 pb-4">
        {nav.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="smooth flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.06]"
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
              <path d={item.icon} />
            </svg>
            <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
          </Link>
        ))}
      </nav>
    </Sidebar>
  );
}