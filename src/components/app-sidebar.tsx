"use client"

import * as React from "react"
import Image from "next/image"
import { HouseIcon, AppWindowIcon, PresentationChartIcon } from "@phosphor-icons/react"

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
    title: "Home",
    url: "/",
    icon: HouseIcon,
    },
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: PresentationChartIcon,
    },
    {
      title: "Capsules",
      url: "/docs",
      icon: AppWindowIcon,
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {/* Brand: logo + wordmark (Outfit) */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Image
            src="/logo01.png"
            alt="Snipply logo"
            width={22}
            height={22}
            priority
            className="rounded-sm"
          />
          <span className="brand-title text-sm tracking-tight group-data-[collapsible=icon]/sidebar-wrapper:hidden">
            Snipply
          </span>
        </div>
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
