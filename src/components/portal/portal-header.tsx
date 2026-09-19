"use client";

import { useRouter } from "next/navigation";
import { GraduationCap, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function PortalHeader({
  title,
  userName,
}: {
  title: string;
  userName: string;
}) {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Sổ Chủ Nhiệm Số</p>
          <p className="truncate text-xs text-muted-foreground">
            {title} · {userName}
          </p>
        </div>
        <button
          onClick={logout}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          aria-label="Đăng xuất"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </header>
  );
}
