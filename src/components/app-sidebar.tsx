"use client"

import * as React from "react"
import { SquareTerminal } from "lucide-react"

import { NavMain } from "@/components/nav-main"
// Removed NavProjects and TeamSwitcher to eliminate placeholder sections
// import { NavProjects } from "@/components/nav-projects"
// import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Build minimal, real navigation tied to existing routes
  const navItems: Parameters<typeof NavMain>[0]["items"] = [
    {
      title: "App",
      url: "#",
      icon: SquareTerminal,
      isActive: true,
      items: [
        { title: "Home", url: "/" },
        { title: "Dashboard", url: "/dashboard" },
        { title: "Docs", url: "/docs" },
      ],
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {/* Minimal brand placeholder without extra UI */}
        <div className="px-2 text-sm font-semibold tracking-tight">Snipply</div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
        {/* Removed <NavProjects /> to avoid placeholder content */}
      </SidebarContent>
      {/* Preserve the footer area for future authentication integration */}
      <SidebarFooter>{/* Intentionally left empty */}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
