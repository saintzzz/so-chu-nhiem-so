"use client";

import { useRef, useState } from "react";
import { formatDate } from "@/lib/utils";
import { CalendarPlus, Download, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  downloadXlsxTemplate,
  normalizeDate,
  parseSpreadsheet,
} from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { EVENT_CATEGORIES, type SchoolYearEvent } from "./types";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm";

export function YearEventsClient({
  events: initialEvents,
  schoolId,
}: {
  events: SchoolYearEvent[];
  schoolId: string | null;
}) {
  const supabase = createClient();
  const [events, setEvents] = useState<SchoolYearEvent[]>(initialEvents);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("hoat_dong");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function addEvent() {
    if (!title.trim() || !date) return;
    setBusy(true);
    const row = {
      title: title.trim(),
      event_date: date,
      month: parseInt(date.slice(5, 7), 10),
      category,
      school_id: schoolId,
    };
    const { data, error } = await supabase
      .from("school_year_events")
      .insert(row)
      .select()
      .single();
    if (!error && data) {
      const inserted = data as SchoolYearEvent;
      setEvents((es) =>
        [...es, inserted].sort((a, b) =>
          a.event_date.localeCompare(b.event_date),
        ),
      );
      setTitle("");
      setDate("");
      setMessage("Đã thêm sự kiện.");
    } else {
      setMessage("Không thể thêm sự kiện.");
    }
    setBusy(false);
  }

  async function onUploadFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setMessage(null);
    let table: string[][];
    try {
      table = await parseSpreadsheet(file);
    } catch {
      setMessage("Không đọc được file. Vui lòng thử file Excel (.xlsx) hoặc CSV khác.");
      return;
    }
    const rows = table
      .map((cells) => {
        const [t, d, c] = cells.map((p) => (p ?? "").trim());
        const date = normalizeDate(d);
        if (!t || !date) return null;
        return {
          title: t,
          event_date: date,
          month: parseInt(date.slice(5, 7), 10),
          category: c && EVENT_CATEGORIES[c] ? c : "khac",
          school_id: schoolId,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => !Number.isNaN(Date.parse(r.event_date)) && r.title.length > 0);
    if (rows.length === 0) {
      setMessage(
        "Không có dòng hợp lệ. Cột: tieu_de, ngay (YYYY-MM-DD), danh_muc - tải template để xem mẫu.",
      );
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("school_year_events")
      .insert(rows)
      .select();
    if (!error && data) {
      const inserted = data as SchoolYearEvent[];
      setEvents((es) =>
        [...es, ...inserted].sort((a, b) =>
          a.event_date.localeCompare(b.event_date),
        ),
      );
      if (fileRef.current) fileRef.current.value = "";
      setFileName(null);
      setMessage(`Đã nhập ${inserted.length} sự kiện.`);
    } else {
      setMessage("Không thể nhập danh sách sự kiện.");
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <DataTable columns={["Sự kiện", "Ngày", "Tháng", "Danh mục"]}>
        {events.map((e) => (
          <tr key={e.id}>
            <td className="font-medium">{e.title}</td>
            <td>{formatDate(e.event_date)}</td>
            <td className="text-muted-foreground">{e.month ?? "-"}</td>
            <td>
              <StatusBadge
                label={EVENT_CATEGORIES[e.category ?? "khac"] ?? e.category ?? "Khác"}
                tone="primary"
              />
            </td>
          </tr>
        ))}
        {events.length === 0 && (
          <tr>
            <td colSpan={4} className="text-center text-muted-foreground">
              Chưa có sự kiện nào trong năm học.
            </td>
          </tr>
        )}
      </DataTable>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <h3 className="mb-3 font-semibold">Thêm sự kiện</h3>
          <div className="space-y-2">
            <input
              className={inputCls}
              placeholder="Tên sự kiện"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className={inputCls}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <select
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {Object.entries(EVENT_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <Button onClick={addEvent} disabled={busy || !title.trim() || !date}>
              <CalendarPlus /> Thêm sự kiện
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <h3 className="mb-1 font-semibold">Upload lịch năm học</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            File Excel (.xlsx) hoặc CSV với các cột: tieu_de, ngay
            (YYYY-MM-DD), danh_muc (le_hoi, kiem_tra, hoat_dong, hanh_chinh,
            khac).
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => onUploadFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <FileSpreadsheet /> {busy ? "Đang xử lý..." : "Chọn file"}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadXlsxTemplate(
                  "template_lich_nam_hoc.xlsx",
                  ["tieu_de", "ngay", "danh_muc"],
                  [
                    ["Khai giảng", "2026-09-05", "le_hoi"],
                    ["Thi giữa kỳ I", "2026-10-20", "kiem_tra"],
                  ],
                )
              }
            >
              <Download /> Tải template
            </Button>
          </div>
          {fileName && (
            <p className="mt-2 text-xs text-muted-foreground">
              Đã chọn: {fileName}
            </p>
          )}
        </div>

        {message && (
          <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
