"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { AiDraftButton } from "@/components/ai/ai-draft-button";
import { createMeeting } from "@/app/(app)/team/meetings/actions";

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

/** Form tạo buổi sinh hoạt tổ - kèm AI soạn biên bản từ ghi chú thô. */
export function MeetingForm() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [content, setContent] = useState("");

  return (
    <form action={createMeeting} className="space-y-3">
      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
          Tiêu đề
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Sinh hoạt chuyên môn tháng 9"
          className={inputCls}
        />
      </div>
      <div>
        <label
          htmlFor="meeting_date"
          className="mb-1.5 block text-sm font-medium"
        >
          Ngày sinh hoạt
        </label>
        <input
          id="meeting_date"
          name="meeting_date"
          type="date"
          required
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="ai_notes" className="mb-1.5 block text-sm font-medium">
          Ghi chú nhanh (tuỳ chọn - AI soạn biên bản)
        </label>
        <input
          id="ai_notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="VD: duyệt tiến độ giáo án, phân công dự giờ, thi đua tháng 10..."
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="content" className="mb-1.5 block text-sm font-medium">
          Nội dung / biên bản
        </label>
        <AutoGrowTextarea
          id="content"
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nội dung trao đổi, kết luận, phân công..."
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <AiDraftButton<{ content: string }>
          className="mt-2"
          endpoint="/api/ai/meeting-notes"
          payload={() => ({ title, notes })}
          onApply={(r) => setContent(r.content)}
          label="AI soạn biên bản từ ghi chú"
          progressLabel="Đang soạn biên bản..."
          disabled={!notes.trim()}
        />
      </div>
      <Button type="submit" className="w-full">
        Tạo buổi sinh hoạt
      </Button>
    </form>
  );
}
