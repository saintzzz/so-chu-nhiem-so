"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function EvidenceForm({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === "") {
      setError("Vui lòng nhập tên minh chứng");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      const { error: e2 } = await supabase.from("assessment_evidence").insert({
        assessment_id: assessmentId,
        title: title.trim(),
        url: url.trim() === "" ? null : url.trim(),
        note: note.trim() === "" ? null : note.trim(),
      });
      if (e2) throw e2;
      setTitle("");
      setUrl("");
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể thêm minh chứng");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Tên minh chứng <span className="text-error">*</span>
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: Kế hoạch chủ nhiệm tháng 9"
          className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Đường dẫn (URL)
        </span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Ghi chú
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Mô tả ngắn về minh chứng..."
          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
        />
      </label>
      {error && (
        <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving} className="w-full">
        <Plus />
        {saving ? "Đang thêm..." : "Thêm minh chứng"}
      </Button>
    </form>
  );
}
