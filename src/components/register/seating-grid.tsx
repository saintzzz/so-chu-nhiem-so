"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Columns3,
  Copy,
  Minus,
  Plus,
  Printer,
  Rows3,
  Save,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn, sortByVietnameseName } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { SeatingLayout, SeatingSeat, Student } from "@/types";

const DEFAULT_COLS = 8;
const DEFAULT_ROWS = 5;

function buildCells(
  layout: SeatingLayout | null,
  students: Student[],
): { cols: number; rows: number; cells: (string | null)[] } {
  const cols = layout?.cols ?? DEFAULT_COLS;
  const rows = layout?.rows ?? DEFAULT_ROWS;
  const cells: (string | null)[] = Array(cols * rows).fill(null);
  if (layout) {
    layout.seats.forEach((s) => {
      const i = s.y * cols + s.x;
      if (i >= 0 && i < cells.length) cells[i] = s.student_id;
    });
  } else {
    students.forEach((s, i) => {
      if (i < cells.length) cells[i] = s.id;
    });
  }
  return { cols, rows, cells };
}

function StudentChip({
  seatIndex,
  student,
  praised,
}: {
  seatIndex: number;
  student: Student;
  praised: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `seat-${seatIndex}` });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={cn(
        "flex h-full w-full cursor-grab touch-none items-center justify-center rounded-lg border border-border bg-background px-1 py-2 text-center text-xs font-medium leading-tight",
        isDragging && "z-20 opacity-80 shadow-lg",
        praised && "border-warning bg-warning-bg text-warning",
      )}
      title={student.full_name}
    >
      {student.full_name}
    </button>
  );
}

function SeatCell({
  index,
  student,
  praised,
  selected,
  onSelect,
}: {
  index: number;
  student: Student | null;
  praised: boolean;
  selected: boolean;
  onSelect: (i: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `seat-${index}` });
  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(index)}
      className={cn(
        "h-14 min-w-[86px] rounded-lg",
        isOver && "ring-2 ring-primary",
        selected && "ring-2 ring-primary",
      )}
    >
      {student ? (
        <StudentChip seatIndex={index} student={student} praised={praised} />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          Trống
        </div>
      )}
    </div>
  );
}

export function SeatingGrid({
  classId,
  className,
  month,
  currentVersion,
  initialLayout,
  previousLayout,
  students,
}: {
  classId: string;
  className: string;
  month: string;
  currentVersion: number;
  initialLayout: SeatingLayout | null;
  previousLayout: SeatingLayout | null;
  students: Student[];
}) {
  const supabase = createClient();
  const initial = useMemo(
    () => buildCells(initialLayout, sortByVietnameseName(students, (s) => s.full_name)),
    [initialLayout, students],
  );
  const [cols, setCols] = useState(initial.cols);
  const [rows, setRows] = useState(initial.rows);
  const [cells, setCells] = useState<(string | null)[]>(initial.cells);
  const [praiseMode, setPraiseMode] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(currentVersion);
  const [message, setMessage] = useState<string | null>(null);

  const studentMap = useMemo(() => {
    const m = new Map<string, Student>();
    students.forEach((s) => m.set(s.id, s));
    return m;
  }, [students]);

  const praisedIds = useMemo(() => {
    const top = [...students]
      .sort((a, b) => b.positive_points - a.positive_points)
      .filter((s) => s.positive_points > 0)
      .slice(0, Math.max(3, Math.ceil(students.length / 4)));
    return new Set(top.map((s) => s.id));
  }, [students]);

  const unseated = useMemo(() => {
    const seated = new Set(cells.filter((sid): sid is string => !!sid));
    return sortByVietnameseName(
      students.filter((s) => !seated.has(s.id)),
      (s) => s.full_name,
    );
  }, [cells, students]);

  /** Xếp các HS chưa có ghế vào ô trống đầu tiên (trái->phải, trên->dưới). */
  function autoAssign() {
    const emptyCount = cells.filter((c) => !c).length;
    const toSeat = unseated.slice(0, emptyCount);
    if (toSeat.length === 0) {
      setMessage(
        `Không đủ ô trống cho ${unseated.length} học sinh chưa có chỗ - hãy thêm hàng/cột trước.`,
      );
      return;
    }
    const queue = [...toSeat];
    setCells((cs) =>
      cs.map((sid) => (sid ? sid : (queue.shift()?.id ?? null))),
    );
    const rest = unseated.length - toSeat.length;
    setMessage(
      rest > 0
        ? `Đã xếp ${toSeat.length} em vào ô trống, còn ${rest} em chưa đủ chỗ - hãy thêm hàng/cột rồi xếp tiếp.`
        : `Đã xếp ${toSeat.length} học sinh vào ô trống. Nhấn Lưu để áp dụng.`,
    );
  }

  function swap(a: number, b: number) {
    if (a === b) return;
    setCells((cs) => {
      const next = [...cs];
      const tmp = next[a];
      next[a] = next[b];
      next[b] = tmp;
      return next;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const from = Number(String(e.active.id).replace("seat-", ""));
    const to = e.over ? Number(String(e.over.id).replace("seat-", "")) : -1;
    if (Number.isInteger(from) && to >= 0) swap(from, to);
  }

  function onSelect(i: number) {
    if (selected === null) {
      setSelected(i);
    } else {
      swap(selected, i);
      setSelected(null);
    }
  }

  /** Đổi kích thước lưới: giữ vị trí (x,y) cũ, HS bị tràn xếp vào ô trống đầu. */
  function resize(newCols: number, newRows: number) {
    if (
      newCols < 2 ||
      newCols > 12 ||
      newRows < 2 ||
      newRows > 10 ||
      (newCols === cols && newRows === rows)
    )
      return;
    setCells((cs) => {
      const seated: { x: number; y: number; sid: string }[] = [];
      cs.forEach((sid, i) => {
        if (sid) seated.push({ x: i % cols, y: Math.floor(i / cols), sid });
      });
      const next: (string | null)[] = Array(newCols * newRows).fill(null);
      const overflow: string[] = [];
      for (const s of seated) {
        if (s.x < newCols && s.y < newRows) next[s.y * newCols + s.x] = s.sid;
        else overflow.push(s.sid);
      }
      for (const sid of overflow) {
        const idx = next.findIndex((c) => c === null);
        if (idx >= 0) next[idx] = sid;
      }
      return next;
    });
    setCols(newCols);
    setRows(newRows);
    setSelected(null);
    setMessage(`Đã đổi sơ đồ thành ${newRows} hàng x ${newCols} cột. Nhấn Lưu để áp dụng.`);
  }

  function copyPrevious() {
    if (!previousLayout) return;
    const prev = buildCells(previousLayout, students);
    setCells((cs) =>
      cs.map((_, i) => (i < prev.cells.length ? prev.cells[i] : null)),
    );
    setMessage("Đã sao chép sơ đồ tháng trước. Nhấn Lưu để áp dụng.");
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const seats: SeatingSeat[] = cells.map((student_id, i) => ({
      x: i % cols,
      y: Math.floor(i / cols),
      student_id,
    }));
    const nextVersion = version + 1;
    await supabase
      .from("seating_charts")
      .update({ is_current: false })
      .eq("class_id", classId)
      .eq("month", month);
    const { error } = await supabase.from("seating_charts").insert({
      class_id: classId,
      month,
      version: nextVersion,
      layout: { cols, rows, seats },
      is_current: true,
    });
    if (error) {
      setMessage("Không thể lưu sơ đồ. Vui lòng thử lại.");
    } else {
      setVersion(nextVersion);
      setMessage(`Đã lưu sơ đồ phiên bản v${nextVersion}.`);
      logAudit(supabase, {
        action: "Lưu sơ đồ chỗ ngồi",
        entity: "seating_charts",
        entityId: classId,
        payload: { month, version: nextVersion, seats: seats.length },
      });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={praiseMode ? "default" : "outline"}
          onClick={() => setPraiseMode((p) => !p)}
        >
          <Sparkles /> Chế độ Tuyên dương
        </Button>
        <Button
          variant="outline"
          onClick={copyPrevious}
          disabled={!previousLayout}
        >
          <Copy /> Sao chép tháng trước
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> Xuất PDF/PNG
        </Button>
        <Button onClick={save} disabled={saving}>
          <Save /> {saving ? "Đang lưu…" : `Lưu (v${version + 1})`}
        </Button>
        <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
          <Rows3 className="size-4" aria-hidden />
          Hàng
          <Button
            variant="outline"
            size="sm"
            onClick={() => resize(cols, rows - 1)}
            disabled={rows <= 2}
            aria-label="Bớt hàng"
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-5 text-center font-medium text-foreground">
            {rows}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resize(cols, rows + 1)}
            disabled={rows >= 10}
            aria-label="Thêm hàng"
          >
            <Plus className="size-3.5" />
          </Button>
          <Columns3 className="ml-2 size-4" aria-hidden />
          Cột
          <Button
            variant="outline"
            size="sm"
            onClick={() => resize(cols - 1, rows)}
            disabled={cols <= 2}
            aria-label="Bớt cột"
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-5 text-center font-medium text-foreground">
            {cols}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resize(cols + 1, rows)}
            disabled={cols >= 12}
            aria-label="Thêm cột"
          >
            <Plus className="size-3.5" />
          </Button>
        </span>
      </div>

      {unseated.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning-bg px-3 py-2">
          <p className="text-sm text-warning">
            Còn <strong>{unseated.length}</strong> học sinh chưa có chỗ ngồi:{" "}
            {unseated
              .slice(0, 6)
              .map((s) => s.full_name)
              .join(", ")}
            {unseated.length > 6 ? `, +${unseated.length - 6} em khác` : ""}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={autoAssign}
          >
            <UserPlus className="size-4" /> Xếp chỗ tự động
          </Button>
        </div>
      )}

      {message && (
        <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
          {message}
        </p>
      )}

      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)] print:border-none print:shadow-none">
        <p className="mb-3 text-sm font-medium">
          Sơ đồ chỗ ngồi lớp {className} · v{version}
          {praiseMode && (
            <span className="ml-2 text-warning">
              (Tô sáng học sinh tích cực)
            </span>
          )}
        </p>
        <p className="mb-3 text-xs text-muted-foreground md:hidden">
          Vuốt ngang để xem toàn bộ sơ đồ.
        </p>
        <div className="relative overflow-x-auto">
          <DndContext id="seating-dnd" onDragEnd={onDragEnd}>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(86px, 1fr))`,
                minWidth: cols * 96,
              }}
            >
              {Array.from({ length: cols * rows }).map((_, i) => {
                const sid = cells[i];
                const student = sid ? (studentMap.get(sid) ?? null) : null;
                return (
                  <SeatCell
                    key={i}
                    index={i}
                    student={student}
                    praised={praiseMode && !!sid && praisedIds.has(sid)}
                    selected={selected === i}
                    onSelect={onSelect}
                  />
                );
              })}
            </div>
          </DndContext>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Bàn giáo viên · Kéo thả học sinh để đổi chỗ, hoặc chạm chọn 2 ô để hoán
          đổi.
        </p>
      </div>
    </div>
  );
}
