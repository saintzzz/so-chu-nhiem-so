"use client";

import { useState } from "react";
import { GraduationCap, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { Profile } from "@/types";
import { SidebarNav } from "@/components/sidebar-nav";
import { Topbar } from "@/components/topbar";
import { domainThemeFor } from "@/lib/domain-theme";
import { effectiveRoles } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const roles = effectiveRoles(profile);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = domainThemeFor();

  return (
    <div className={cn("flex min-h-screen", `theme-${theme}`)}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
          collapsed ? "w-16" : "w-64",
        )}
        aria-label="Điều hướng chính"
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <GraduationCap className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold leading-tight">Sổ Chủ Nhiệm Số</span>
                <a
                  href="https://vieschool.com"
                  className="text-[10px] leading-tight text-muted-foreground hover:text-primary hover:underline"
                >
                  sản phẩm của VieSchool
                </a>
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent"
            aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>
        <SidebarNav roles={roles} collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-sidebar-border bg-sidebar">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <GraduationCap className="size-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight">Sổ Chủ Nhiệm Số</span>
                  <a
                    href="https://vieschool.com"
                    className="text-[10px] leading-tight text-muted-foreground hover:text-primary hover:underline"
                  >
                    sản phẩm của VieSchool
                  </a>
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent"
                aria-label="Đóng menu"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarNav
              roles={roles}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          profile={profile}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
