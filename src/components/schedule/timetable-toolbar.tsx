"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { downloadXlsxTemplate, parseSpreadsheet } from "@/lib/excel";
import { Button } from "@/components/ui/button";

const WEEKDAYS = [2, 3, 4, 5, 6, 7] as const;

interface EntryCell {
  weekday: number;
  period: number;
  subject: string;
  teacher: string | null;
  room: string | null;
}

interface AllEntry extends EntryCell {
  className: string;
}

interface NameId {
  id: string;
  name: string;
}

function cellText(subject: string, teacher: string | null, room: string | null) {
  return [subject, teacher ?? "", room ?? ""]
    .join("|")
    .replace(/\|+$/, "");
}

function parseWeekday(raw: string): number | null {
  const m = raw.match(/(\d)/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 2 && n <= 8 ? n : null;
}

export function TimetableToolbar({
  classes,
  subjects,
  teachers,
  selectedClass,
  selectedEntries,
  allEntries,
}: {
  classes: NameId[];
  subjects: NameId[];
  teachers: NameId[];
  selectedClass: NameId;
  selectedEntries: EntryCell[];
  allEntries: AllEntry[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function downloadGridTemplate() {
    const grid = new Map(
      selectedEntries.map((e) => [`${e.weekday}-${e.period}`, e]),
    );
    downloadXlsxTemplate(
      `mau-tkb-${selectedClass.name.toLowerCase()}.xlsx`,
      ["Tiết", ...WEEKDAYS.map((w) => `Thứ ${w}`)],
      [1, 2, 3, 4, 5].map((p) => [
        String(p),
        ...WEEKDAYS.map((w) => {
          const e = grid.get(`${w}-${p}`);
          return e ? cellText(e.subject, e.teacher, e.room) : "";
        }),
      ]),
    );
  }

  function downloadListTemplate() {
    downloadXlsxTemplate(
      "mau-tkb-toan-truong.xlsx",
      ["Lớp", "Thứ", "Tiết", "Môn", "Giáo viên", "Phòng"],
      allEntries.map((e) => [
        e.className,
        `Thứ ${e.weekday}`,
        String(e.period),
        e.subject,
        e.teacher ?? "",
        e.room ?? "",
      ]),
    );
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setError(null);
    let table: string[][];
    try {
      table = await parseSpreadsheet(file);
    } catch {
      setError("Không đọc được file. Dùng file .xlsx hoặc .csv.");
      return;
    }
    if (table.length < 2) {
      setError("File không có dữ liệu. Tải template để xem định dạng.");
      return;
    }

    const clsByName = new Map(
      classes.map((c) => [c.name.toLowerCase(), c.id]),
    );
    const subByName = new Map(
      subjects.map((s) => [s.name.toLowerCase(), s.id]),
    );
    const teacherByName = new Map(
      teachers.map((t) => [t.name.toLowerCase(), t.id]),
    );

    const header = (table[0][0] ?? "").toLowerCase();
    const rows: Record<string, unknown>[] = [];
    const bad: string[] = [];

    if (header.includes("lớp")) {
      // List mode: Lớp | Thứ | Tiết | Môn | Giáo viên | Phòng
      for (const r of table.slice(1)) {
        const class_id = clsByName.get((r[0] ?? "").trim().toLowerCase());
        const weekday = parseWeekday(r[1] ?? "");
        const period = Number(r[2]);
        const subject_id = subByName.get(
          (r[3] ?? "").trim().toLowerCase(),
        );
        if (!class_id || !weekday || !(period >= 1 && period <= 10) || !subject_id) {
          bad.push(`${r[0] ?? "?"} - ${r[1] ?? "?"} - tiết ${r[2] ?? "?"}`);
          continue;
        }
        rows.push({
          class_id,
          weekday,
          period,
          subject_id,
          teacher_id:
            teacherByName.get((r[4] ?? "").trim().toLowerCase()) ?? null,
          room: (r[5] ?? "").trim() || null,
        });
      }
    } else if (header.includes("tiết")) {
      // Grid mode for selected class: Tiết | Thứ 2 | ... | Thứ 7
      // Ô = Môn | Giáo viên | Phòng (GV và phòng không bắt buộc)
      for (const r of table.slice(1)) {
        const period = Number(r[0]);
        if (!(period >= 1 && period <= 10)) continue;
        WEEKDAYS.forEach((weekday, i) => {
          const cell = (r[i + 1] ?? "").trim();
          if (!cell) return;
          const [subRaw, tRaw, roomRaw] = cell.split("|");
          const subject_id = subByName.get(subRaw.trim().toLowerCase());
          if (!subject_id) {
            bad.push(`tiết ${period} - Thứ ${weekday}: "${subRaw.trim()}"`);
            return;
          }
          rows.push({
            class_id: selectedClass.id,
            weekday,
            period,
            subject_id,
            teacher_id:
              teacherByName.get((tRaw ?? "").trim().toLowerCase()) ?? null,
            room: (roomRaw ?? "").trim() || null,
          });
        });
      }
    } else {
      setError(
        "Không nhận diện được định dạng. File lưới bắt đầu bằng cột \"Tiết\"; file danh sách bắt đầu bằng cột \"Lớp\".",
      );
      return;
    }

    if (rows.length === 0) {
      setError("Không có ô hợp lệ. Tải template để xem định dạng cột.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("timetable_entries")
        .upsert(rows, { onConflict: "class_id,weekday,period" });
      if (err) {
        setError(`Không thể lưu thời khóa biểu: ${err.message}`);
      } else {
        setMessage(
          `Đã nhập ${rows.length} ô tiết (ghi đè ô trùng).` +
            (bad.length ? ` Bỏ qua ${bad.length} dòng: ${bad.slice(0, 5).join("; ")}${bad.length > 5 ? "…" : ""}` : ""),
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" onClick={downloadGridTemplate}>
        Template lớp này
      </Button>
      <Button variant="outline" size="sm" onClick={downloadListTemplate}>
        Template toàn trường
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
      >
        {pending ? "Đang nhập…" : "Import Excel"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(e) => void onImport(e.target.files?.[0])}
      />
      {message && <span className="text-sm text-success">{message}</span>}
      {error && <span className="text-sm text-error">{error}</span>}
    </div>
  );
}
