import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type QuickAction = {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
};

// CR-116-W2: the chuc nang hay dung nhat cua tung vai tro, hien ngay tren
// man hinh dau tien sau dang nhap. Static theo vai tro (khong tracking
// ca nhan hoa) - gioi han ~6 de khong tran chu.
export function QuickActions({
  title = "Chức năng hay dùng",
  items,
}: {
  title?: string;
  items: QuickAction[];
}) {
  if (!items.length) return null;
  return (
    <section aria-label={title} className="mt-4">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((a) => (
          <Link
            key={a.href}
            prefetch={false}
            href={a.href}
            className="group rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-sm-token)] transition-colors hover:border-primary/60 hover:bg-muted/60"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <a.icon className="size-4" />
            </span>
            <p className="mt-2 text-sm font-medium leading-tight">{a.label}</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
              {a.desc}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
