"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { NAV } from "@/lib/nav";
import type { Role } from "@/types";

export function CommandPalette({
  open,
  onClose,
  role,
}: {
  open: boolean;
  onClose: () => void;
  role: Role;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const items = useMemo(() => {
    const flat: { label: string; href: string; section: string }[] = [];
    for (const s of NAV[role] ?? []) {
      if (s.href) flat.push({ label: s.label, href: s.href, section: "" });
      for (const c of s.children ?? [])
        flat.push({ label: c.label, href: c.href, section: s.label });
    }
    return flat;
  }, [role]);

  const filtered = items.filter((i) =>
    (i.label + i.section).toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) onClose();
      }
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const go = (href: string) => {
    router.push(href);
    onClose();
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      go(filtered[activeIndex].href);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/30 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-popover shadow-[var(--shadow-lg-token)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tìm kiếm nhanh"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Tìm chức năng..."
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={
              filtered[activeIndex] ? `cp-item-${activeIndex}` : undefined
            }
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <ul
          id="command-palette-list"
          role="listbox"
          ref={listRef}
          className="max-h-72 overflow-y-auto p-2"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Không có kết quả
            </li>
          )}
          {filtered.map((i, idx) => (
            <li key={i.href} role="option" aria-selected={idx === activeIndex}>
              <button
                id={`cp-item-${idx}`}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${
                  idx === activeIndex ? "bg-muted" : ""
                }`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => go(i.href)}
              >
                <span>{i.label}</span>
                {i.section && (
                  <span className="text-xs text-muted-foreground">
                    {i.section}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
