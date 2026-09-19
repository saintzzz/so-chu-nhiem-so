"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { NAV } from "@/lib/nav";
import { SECTION_ICONS, ITEM_ICONS, FALLBACK_ICON } from "@/lib/nav-icons";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";

export function SidebarNav({
  role,
  collapsed,
  onNavigate,
}: {
  role: Role;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = NAV[role] ?? [];
  const [open, setOpen] = useState<string | null>(
    sections.find((s) =>
      s.children?.some((c) => pathname.startsWith(c.href)),
    )?.label ?? sections.find((s) => s.children)?.label ?? null,
  );

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Điều hướng chính">
      <ul className="space-y-0.5">
        {sections.map((section) => {
          const SectionIcon = SECTION_ICONS[section.label] ?? FALLBACK_ICON;
          return (
          <li key={section.label}>
            {section.children ? (
              <>
                <button
                  onClick={() =>
                    setOpen((o) => (o === section.label ? null : section.label))
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent",
                    section.children.some((c) => pathname.startsWith(c.href)) &&
                      "text-sidebar-primary",
                  )}
                  aria-expanded={open === section.label}
                  title={collapsed ? section.label : undefined}
                >
                  <SectionIcon className="size-4 shrink-0" aria-hidden />
                  <span className={cn("flex-1", collapsed && "sr-only")}>
                    {section.label}
                  </span>
                  {!collapsed && (
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        open === section.label && "rotate-180",
                      )}
                    />
                  )}
                </button>
                {open === section.label && !collapsed && (
                  <ul className="mt-0.5 space-y-0.5 pl-3">
                    {section.children.map((item) => {
                      const ItemIcon = ITEM_ICONS[item.label] ?? FALLBACK_ICON;
                      return (
                      <li key={item.href}>
                        <Link prefetch={false}
                          href={item.href}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-sidebar-accent",
                            pathname === item.href
                              ? "bg-primary-bg font-medium text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          <ItemIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              <Link prefetch={false}
                href={section.href ?? "#"}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent",
                  pathname === section.href
                    ? "bg-primary-bg text-primary"
                    : "text-sidebar-foreground",
                )}
                title={collapsed ? section.label : undefined}
              >
                <SectionIcon className="size-4 shrink-0" />
                <span className={cn(collapsed && "sr-only")}>
                  {section.label}
                </span>
              </Link>
            )}
          </li>
          );
        })}
      </ul>
    </nav>
  );
}
