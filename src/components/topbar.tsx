"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NAV, ROLE_LABELS } from "@/lib/nav";
import type { Profile } from "@/types";
import { CommandPalette } from "@/components/command-palette";

function breadcrumb(pathname: string, role: Profile["role"]) {
  for (const s of NAV[role] ?? []) {
    if (s.href && pathname.startsWith(s.href))
      return { section: s.label, page: null };
    for (const c of s.children ?? []) {
      if (pathname.startsWith(c.href))
        return { section: s.label, page: c.label };
    }
  }
  return { section: "Dashboard", page: "Trang chủ" };
}

export function Topbar({
  profile,
  onOpenMobileNav,
}: {
  profile: Profile;
  onOpenMobileNav: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const crumbs = breadcrumb(pathname, profile.role);
  const initials = profile.full_name
    .split(" ")
    .map((w) => w[0])
    .slice(-2)
    .join("")
    .toUpperCase();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur">
      <button
        onClick={onOpenMobileNav}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
        aria-label="Mở menu điều hướng"
      >
        <Menu className="size-5" />
      </button>

      <nav className="hidden min-w-0 items-center gap-1.5 text-sm md:flex" aria-label="Breadcrumb">
        <span className="truncate text-muted-foreground">{crumbs.section}</span>
        {crumbs.page && (
          <>
            <span className="text-muted-foreground" aria-hidden>/</span>
            <span className="truncate font-medium">{crumbs.page}</span>
          </>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-muted sm:flex"
        >
          <Search className="size-3.5" />
          <span>Tìm nhanh...</span>
          <kbd className="rounded border border-border bg-muted px-1 text-[10px]">
            Ctrl K
          </kbd>
        </button>
        <button
          onClick={() => setPaletteOpen(true)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted sm:hidden"
          aria-label="Tìm kiếm nhanh"
        >
          <Search className="size-5" />
        </button>
        <button
          className="relative rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Thông báo"
        >
          <Bell className="size-5" />
        </button>
        <span className="hidden rounded-md bg-primary-bg px-2 py-1 text-xs font-medium text-primary lg:inline">
          {ROLE_LABELS[profile.role]}
        </span>
        <span
          className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          title={profile.full_name}
        >
          {initials}
        </span>
        <button
          onClick={logout}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <LogOut className="size-5" />
        </button>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        role={profile.role}
      />
    </header>
  );
}
