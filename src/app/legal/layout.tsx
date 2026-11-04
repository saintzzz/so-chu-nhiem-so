import Link from "next/link";
import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/login" className="mb-8 inline-flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-4" />
          </span>
          <span className="text-lg font-semibold">Sổ Chủ Nhiệm Số</span>
          <span className="text-sm text-muted-foreground">- VieSchool</span>
        </Link>
        {children}
        <footer className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <Link href="/legal/privacy" className="hover:text-primary">
            Chính sách bảo mật
          </Link>
          <Link href="/legal/terms" className="hover:text-primary">
            Điều khoản sử dụng
          </Link>
          <Link href="/login" className="hover:text-primary">
            Đăng nhập
          </Link>
          <span className="ml-auto">Cập nhật: 05/11/2026</span>
        </footer>
      </div>
    </main>
  );
}
