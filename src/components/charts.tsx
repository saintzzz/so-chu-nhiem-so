"use client";

import { useId, useState } from "react";

export function ChartCard({
  title,
  ariaDescription,
  children,
  tableContent,
}: {
  title: string;
  ariaDescription: string;
  children: React.ReactNode;
  tableContent?: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        {tableContent && (
          <button
            onClick={() => setShowTable((s) => !s)}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            {showTable ? "Xem biểu đồ" : "Xem bảng dữ liệu"}
          </button>
        )}
      </div>
      <div role="img" aria-label={ariaDescription}>
        {showTable ? tableContent : children}
      </div>
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

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
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

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
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
  );
}
