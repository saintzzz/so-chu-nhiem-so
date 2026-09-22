import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function queryString(params: Record<string, string>): string {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== ""),
  );
  const s = q.toString();
  return s ? `?${s}` : "";
}

const inputCls =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring";

/** Chọn 1 ngày (mặc định hôm nay), điều hướng bằng query string ?date=.
 *  `params` chứa các query param cần giữ lại (vd: class). */
export function AttendanceDateNav({
  date,
  params,
  label = "Ngày",
  paramName = "date",
}: {
  date: string;
  params: Record<string, string>;
  label?: string;
  paramName?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-[var(--shadow-sm-token)]">
      <Link
        prefetch={false}
        href={queryString({ ...params, [paramName]: addDays(date, -1) })}
        className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
        aria-label="Ngày trước"
      >
        <ChevronLeft className="size-4" />
      </Link>
      <form method="get" className="flex items-center gap-2">
        {Object.entries(params).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label className="text-sm text-muted-foreground">{label}</label>
        <input
          type="date"
          name={paramName}
          defaultValue={date}
          className={inputCls}
        />
        <Button type="submit" variant="outline" size="sm">
          Xem
        </Button>
      </form>
      <Link
        prefetch={false}
        href={queryString({ ...params, [paramName]: addDays(date, 1) })}
        className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
        aria-label="Ngày sau"
      >
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

/** Thanh điều khiển ngày cho dashboard: xem 1 ngày (?date=) hoặc
 *  khoảng ngày (?from=&to=). Hai form độc lập - submit form này xoá
 *  param của form kia. */
export function DashboardDateBar({
  mode,
  date,
  from,
  to,
}: {
  mode: "day" | "range";
  date: string;
  from: string;
  to: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-3 py-2 shadow-[var(--shadow-sm-token)]">
      <div
        className={cnWrap(mode === "day")}
        aria-label="Xem theo ngày"
      >
        <Link
          prefetch={false}
          href={queryString({ date: addDays(date, -1) })}
          className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
          aria-label="Ngày trước"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <form method="get" className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Ngày</label>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className={inputCls}
          />
          <Button type="submit" variant="outline" size="sm">
            Xem
          </Button>
        </form>
        <Link
          prefetch={false}
          href={queryString({ date: addDays(date, 1) })}
          className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
          aria-label="Ngày sau"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <form
        method="get"
        className={cnWrap(mode === "range")}
        aria-label="Xem theo khoảng ngày"
      >
        <label className="text-sm text-muted-foreground">Từ ngày</label>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className={inputCls}
        />
        <label className="text-sm text-muted-foreground">đến</label>
        <input type="date" name="to" defaultValue={to} className={inputCls} />
        <Button type="submit" variant="outline" size="sm">
          Xem
        </Button>
      </form>
    </div>
  );
}

function cnWrap(active: boolean): string {
  return active
    ? "flex flex-wrap items-center gap-2 rounded-lg bg-primary-bg px-2 py-1"
    : "flex flex-wrap items-center gap-2 px-2 py-1";
}

/** Chọn khoảng thời gian ?from=&to= cho các trang thống kê. */
export function AttendanceRangeNav({
  from,
  to,
  params,
}: {
  from: string;
  to: string;
  params: Record<string, string>;
}) {
  return (
    <form
      method="get"
      className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-[var(--shadow-sm-token)]"
    >
      {Object.entries(params).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="text-sm text-muted-foreground">Từ ngày</label>
      <input
        type="date"
        name="from"
        defaultValue={from}
        className={inputCls}
      />
      <label className="text-sm text-muted-foreground">đến</label>
      <input type="date" name="to" defaultValue={to} className={inputCls} />
      <Button type="submit" variant="outline" size="sm">
        Xem
      </Button>
    </form>
  );
}
