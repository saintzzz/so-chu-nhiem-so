"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Sparkles } from "lucide-react";
import { AiProgress } from "@/components/ai/ai-progress";
import { useAiJob } from "@/hooks/use-ai-job";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { parseSpreadsheet } from "@/lib/excel";

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

interface ExtractedRow {
  name: string;
  dob?: string;
  gender?: string;
  parent_name?: string;
  phone?: string;
}

/** Dán văn bản danh sách HS (copy từ giấy tờ/Excel lộn xộn) -> AI trả về bảng CSV. */
export function AiExtract() {
  const job = useAiJob();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ExtractedRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (job.done && job.result !== null) {
      const r = job.result as { rows?: ExtractedRow[] };
      job.reset();
      setRows(r.rows ?? null);
      if (!r.rows?.length) setErr("Không trích xuất được dữ liệu. Thử lại.");
    } else if (job.failed) {
      job.reset();
      setErr("Không nhận được kết quả. Vui lòng thử lại.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.done, job.failed, job.result]);

  async function run() {
    setBusy(true);
    setErr(null);
    setRows(null);
    setCopied(false);
    try {
      const res = await fetch("/api/ai/extract-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json()) as {
        result?: { rows?: ExtractedRow[] } | null;
        pending?: boolean;
        jobId?: string;
        devinUrl?: string;
        error?: string;
      };
      if (json.pending && json.jobId && json.devinUrl) {
        job.start(json.jobId, json.devinUrl);
        return;
      }
      if (json.result?.rows?.length) setRows(json.result.rows);
      else setErr(json.error ?? "Không trích xuất được dữ liệu. Thử lại.");
    } catch {
      setErr("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = busy || Boolean(job.job);

  function toCsv() {
    if (!rows) return "";
    const esc = (s?: string) => `"${(s ?? "").replaceAll('"', '""')}"`;
    return [
      "full_name,dob,gender,parent_name,phone",
      ...rows.map((r) =>
        [r.name, r.dob, r.gender, r.parent_name, r.phone].map(esc).join(","),
      ),
    ].join("\n");
  }

  async function copyCsv() {
    await navigator.clipboard.writeText(toCsv());
    setCopied(true);
  }

  /** Đọc file Excel/CSV thành bảng text rồi đưa vào ô văn bản cho AI xử lý. */
  async function onFile(file: File | undefined) {
    if (!file) return;
    setErr(null);
    try {
      const table = await parseSpreadsheet(file);
      const asText = table
        .map((row) => row.map((c) => c ?? "").join("\t"))
        .join("\n");
      setText(asText);
    } catch {
      setErr("Không đọc được file. Thử file Excel (.xlsx) hoặc CSV khác.");
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">
            AI trích xuất danh sách từ văn bản
          </h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Thu gọn" : "Mở"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet /> Chọn file Excel/CSV
            </Button>
            <span className="text-xs text-muted-foreground">
              hoặc dán văn bản vào ô bên dưới
            </span>
          </div>
          <AutoGrowTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Dán danh sách học sinh ở bất kỳ định dạng nào (copy từ giấy tờ, tin nhắn, Excel lộn xộn)..."
            className={INPUT_CLS}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={run}
              disabled={waiting || text.trim().length < 10}
            >
              {waiting ? "Đang trích xuất..." : "Trích xuất"}
            </Button>
            {rows && (
              <Button size="sm" variant="outline" onClick={copyCsv}>
                {copied ? "Đã copy CSV" : "Copy dạng CSV để import"}
              </Button>
            )}
          </div>
          {waiting && <AiProgress label="Đang trích xuất..." />}
          {err && <p className="text-sm text-error">{err}</p>}
          {rows && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Họ tên</th>
                    <th className="px-3 py-2 font-medium">Ngày sinh</th>
                    <th className="px-3 py-2 font-medium">Giới tính</th>
                    <th className="px-3 py-2 font-medium">Phụ huynh</th>
                    <th className="px-3 py-2 font-medium">SĐT</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2">{r.dob ?? "-"}</td>
                      <td className="px-3 py-2">{r.gender ?? "-"}</td>
                      <td className="px-3 py-2">{r.parent_name ?? "-"}</td>
                      <td className="px-3 py-2">{r.phone ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows && (
            <p className="text-xs text-muted-foreground">
              Kiểm tra kỹ bảng trước khi copy CSV vào mục upload bên dưới.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
