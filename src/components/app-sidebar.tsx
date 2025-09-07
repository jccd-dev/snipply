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
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Snipply" asChild>
              <div className="flex items-center gap-2">
                <Image
                  src="/logo01.png"
                  alt="Snipply logo"
                  width={24}
                  height={24}

                />
                <span className="tracking-tight font-bold font-outfit">
                  Snipply
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
