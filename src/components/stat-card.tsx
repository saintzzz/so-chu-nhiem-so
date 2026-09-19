import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  tone?: "default" | "success" | "warning" | "error" | "primary";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    error: "text-error",
    primary: "text-primary",
  };
  const inner = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", tones[tone])}>{value}</p>
    </>
  );
  const cls =
    "block rounded-xl border border-border bg-card p-4 text-left shadow-[var(--shadow-sm-token)] transition-shadow hover:shadow-[var(--shadow-md-token)]";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
