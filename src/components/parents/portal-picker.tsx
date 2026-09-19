"use client";

import { useRouter } from "next/navigation";
import { sortByVietnameseName } from "@/lib/utils";

export function PortalPicker({
  students: rawStudents,
  selectedId,
}: {
  students: { id: string; label: string }[];
  selectedId: string;
}) {
  const students = sortByVietnameseName(rawStudents, (s) => s.label);
  const router = useRouter();
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium">Chọn học sinh:</label>
      <select
        value={selectedId}
        onChange={(e) => router.push(`/parents/portal?student=${e.target.value}`)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
