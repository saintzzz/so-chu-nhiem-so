"use client";

import { useId, useState } from "react";

export function ChartCard({
  title,
  ariaDescription,
  children,
  tableContent,
  data,
}: {
  title: string;
  ariaDescription: string;
  children: React.ReactNode;
  tableContent?: React.ReactNode;
  /** Nếu truyền data thì có sẵn bảng dữ liệu thay thế cho biểu đồ (a11y/mobile). */
  data?: { label: string; value: number }[];
}) {
  const [showTable, setShowTable] = useState(false);
  const table =
    tableContent ??
    (data ? (
      data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Chưa có dữ liệu.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Nhãn</th>
              <th className="py-1.5 text-right font-medium">Giá trị</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b border-border/60 last:border-0">
                <td className="py-1.5 pr-2">{d.label}</td>
                <td className="py-1.5 text-right font-medium">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    ) : undefined);
  return (
    // min-w-0: grid/flex item mac dinh min-width:auto -> SVG minWidth 560
    // lam card phinh qua viewport tren mobile (noi dung bi clip khuat).
    <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        {table && (
          <button
            onClick={() => setShowTable((s) => !s)}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            {showTable ? "Xem biểu đồ" : "Xem bảng dữ liệu"}
          </button>
        )}
      </div>
      {showTable && table ? (
        // Bang thay the giu nguyen semantics table - khong dat role="img" len wrapper.
        table
      ) : (
        <div role="img" aria-label={ariaDescription} className="min-w-0">
          {children}
        </div>
      )}
    </div>
  );
}

export function LineChart({
  data,
  width = 560,
  height = 220,
  yMax,
  yTicks = 4,
}: {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  yMax?: number;
  yTicks?: number;
}) {
  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const max = yMax ?? Math.max(...data.map((d) => d.value)) * 1.2;
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;
  const pts = data.map((d, i) => ({
    x: pad.left + (i / Math.max(data.length - 1, 1)) * iw,
    y: pad.top + ih - (d.value / max) * ih,
    ...d,
  }));
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const area = `${path} L${pts[pts.length - 1]?.x ?? pad.left},${pad.top + ih} L${pad.left},${pad.top + ih} Z`;
  const gid = useId();

  // R2-11: tren man hinh hep, SVG 560px co xuong ~310px lam chu qua nho.
  // Giu be rong toi thieu = viewBox va cho cuon ngang de nhan doc duoc.
  return (
    <div className="relative overflow-x-auto">
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: width }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
        </linearGradient>
      </defs>
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = pad.top + (i / yTicks) * ih;
        const val = ((max * (yTicks - i)) / yTicks).toFixed(0);
        return (
          <g key={i}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray={i === yTicks ? undefined : "2 4"}
            />
            <text
              x={pad.left - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {val}
            </text>
          </g>
        );
      })}
      <path d={area} fill={`url(#${gid})`} stroke="none" />
      <path
        d={path}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={4}
            fill="var(--chart-1)"
            stroke="var(--card)"
            strokeWidth={2}
            className="cursor-pointer"
          >
            <title>{`${p.label}: ${p.value}`}</title>
          </circle>
          <text
            x={p.x}
            y={height - 8}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
    </div>
  );
}

export function BarChart({
  data,
  width = 560,
  height = 220,
}: {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
}) {
  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const max = Math.max(...data.map((d) => d.value), 1) * 1.15;
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;
  const bw = Math.min(48, (iw / data.length) * 0.6);

  // R2-11: giu be rong toi thieu = viewBox, cuon ngang tren mobile de chu doc duoc.
  return (
    <div className="relative overflow-x-auto">
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: width }}>
      {data.map((d, i) => {
        const x = pad.left + (i + 0.5) * (iw / data.length) - bw / 2;
        const h = (d.value / max) * ih;
        return (
          <g key={i}>
            <rect
              x={x}
              y={pad.top + ih - h}
              width={bw}
              height={h}
              rx={6}
              fill={`var(--chart-${(i % 5) + 1})`}
              className="transition-opacity hover:opacity-75"
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            <text
              x={x + bw / 2}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {d.label}
            </text>
            <text
              x={x + bw / 2}
              y={pad.top + ih - h - 4}
              textAnchor="middle"
              className="fill-foreground text-[10px] font-medium"
            >
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}
