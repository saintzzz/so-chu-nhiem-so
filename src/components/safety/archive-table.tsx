"use client";

import { useMemo, useState } from "react";
import { DataTable, Pagination } from "@/components/data-table";
import { StatusBadge, SEVERITY, FLOW_STATUS } from "@/components/status-badge";

const INPUT_CLS =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const PAGE_SIZE = 10;

export interface ArchivedIncident {
  id: string;
  occurredAt: string;
  className: string;
  studentName: string;
  type: string;
  severity: keyof typeof SEVERITY;
  status: keyof typeof FLOW_STATUS;
  description: string;
}

export function ArchiveTable({ rows }: { rows: ArchivedIncident[] }) {
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (severity !== "all" && r.severity !== severity) return false;
      if (status !== "all" && r.status !== status) return false;
      if (!needle) return true;
      return [r.studentName, r.className, r.type, r.description]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, severity, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Tìm theo học sinh, lớp, loại sự cố, mô tả..."
          className={`${INPUT_CLS} min-w-64 flex-1`}
        />
        <select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(1);
          }}
          className={INPUT_CLS}
        >
          <option value="all">Tất cả mức độ</option>
          {Object.entries(SEVERITY).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className={INPUT_CLS}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="resolved">Đã xử lý</option>
          <option value="archived">Lưu trữ</option>
        </select>
      </div>

      <DataTable
        columns={[
          "Thời điểm",
          "Lớp",
          "Học sinh",
          "Loại sự cố",
          "Mức độ",
          "Trạng thái",
        ]}
        footer={
          <Pagination
            total={filtered.length}
            page={safePage}
            pageSize={PAGE_SIZE}
          />
        }
      >
        {pageRows.length === 0 ? (
          <tr>
            <td
              colSpan={6}
              className="py-8 text-center text-sm text-muted-foreground"
            >
              Không tìm thấy sự cố phù hợp.
            </td>
          </tr>
        ) : (
          pageRows.map((r) => {
            const sev = SEVERITY[r.severity];
            const st = FLOW_STATUS[r.status];
            return (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-muted-foreground">
                  {r.occurredAt}
                </td>
                <td className="font-medium">{r.className}</td>
                <td>{r.studentName}</td>
                <td>
                  <div className="max-w-64">
                    <p className="truncate">{r.type}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.description}
                    </p>
                  </div>
                </td>
                <td>
                  <StatusBadge label={sev.label} tone={sev.tone} />
                </td>
                <td>
                  <StatusBadge label={st.label} tone={st.tone} />
                </td>
              </tr>
            );
          })
        )}
      </DataTable>
    </div>
  );
}
