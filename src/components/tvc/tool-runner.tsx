"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ToolClientDef, ToolField } from "@/lib/tvc/types";
import type { CurriculumStandard, DocContent, Subject } from "@/types/tvc";
import { DocEditor } from "./doc-editor";
import { DocRender } from "./doc-render";
import { saveMaterial } from "@/lib/tvc/actions";
import { sanitizeKhbdDoc } from "@/lib/tvc/khbd-doc";
import { useTvcAiJob } from "@/hooks/use-tvc-ai-job";
import { Sparkles, Save, Loader2, Users } from "lucide-react";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

interface MatrixPayload {
  cells: unknown[];
  spec: unknown[];
  totalPoints?: number;
  durationMin?: number;
}

const inputCls =
  "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function ToolRunner({
  tool,
  defaultSubject,
  fromMaterial,
}: {
  tool: ToolClientDef;
  defaultSubject?: string;
  // CR-042: DC-06 - sinh tu giao an da co (?from=<material_id>)
  fromMaterial?: {
    id: string;
    title: string;
    subject: string | null;
    grade: number | null;
    standardIds: string[];
  } | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    tool.fields.forEach((f) => {
      if (f.default != null) v[f.key] = String(f.default);
    });
    // CR-032: GVBM vao tool thi mon mac dinh = mon phu trach
    if (defaultSubject && !v.subject) v.subject = defaultSubject;
    // CR-042: prefill tu giao an nguon
    if (fromMaterial) {
      if (fromMaterial.subject) v.subject = fromMaterial.subject;
      if (fromMaterial.grade) v.grade = String(fromMaterial.grade);
    }
    return v;
  });
  const [coValues, setCoValues] = useState<Record<string, string>>({});
  const [coMode, setCoMode] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<number[]>([]);
  const [standards, setStandards] = useState<CurriculumStandard[]>([]);
  const [matrixOptions, setMatrixOptions] = useState<{ id: string; title: string }[]>([]);
  const [tplOptions, setTplOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedStd, setSelectedStd] = useState<string[]>(
    fromMaterial?.standardIds ?? [],
  );
  const [doc, setDoc] = useState<DocContent | null>(null);
  const [docTabs, setDocTabs] = useState<{ label: string; doc: DocContent }[] | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [matrixPayload, setMatrixPayload] = useState<MatrixPayload | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [missing, setMissing] = useState(0);
  const [review, setReview] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const aiJob = useTvcAiJob();

  // Load subjects + matrices on mount
  useEffect(() => {
    fetch("/api/studio/context?kind=subjects")
      .then((r) => r.json())
      .then((d) => setSubjects(d.data ?? []));
    if (tool.code === "DC-03") {
      fetch("/api/studio/context?kind=matrices")
        .then((r) => r.json())
        .then((d) => setMatrixOptions(d.data ?? []));
    }
    if (tool.code === "DC-01") {
      fetch("/api/studio/context?kind=khbd_templates")
        .then((r) => r.json())
        .then((d) => {
          const list = (d.data ?? []) as { id: string; name: string }[];
          setTplOptions(list);
          const def = list.find((t) => (t as { is_default?: boolean }).is_default);
          if (def) setValues((v) => ({ khbd_template: def.id, ...v }));
        });
    }
  }, [tool.code]);

  // Cascade: subject -> grades -> standards
  useEffect(() => {
    const s = values.subject;
    if (!s) return;
    fetch(`/api/studio/context?kind=grades&subject=${s}`)
      .then((r) => r.json())
      .then((d) => setGrades(d.data ?? []));
  }, [values.subject]);

  useEffect(() => {
    const s = values.subject;
    const g = values.grade;
    if (!s || !g) return;
    fetch(`/api/studio/context?kind=standards&subject=${s}&grade=${g}`)
      .then((r) => r.json())
      .then((d) => setStandards(d.data ?? []));
  }, [values.subject, values.grade]);

  const set = (k: string, v: string) => {
    setValues((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "subject") {
        delete next.grade;
        setSelectedStd([]);
        setStandards([]);
      }
      if (k === "grade") {
        setSelectedStd([]);
        setStandards([]);
      }
      return next;
    });
  };

  const validate = () => {
    for (const f of tool.fields) {
      if (!f.required) continue;
      if (f.type === "standard" && !selectedStd.length)
        return "Chưa chọn bài học / yêu cầu cần đạt.";
      if (f.type === "subject" && !values[f.key]) return "Chưa chọn môn học.";
      if (f.type === "grade" && !values[f.key]) return "Chưa chọn khối lớp.";
      if (["text", "textarea", "words"].includes(f.type) && !values[f.key]?.trim())
        return `Chưa nhập: ${f.label}.`;
      if (f.type === "select" && !values[f.key]) return `Chưa chọn: ${f.label}.`;
    }
    return null;
  };

  const generate = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setSavedId(null);
    const input = {
      ...values,
      ...coValues,
      standard_ids: selectedStd.join(","),
      ...(fromMaterial ? { material_id: fromMaterial.id } : {}),
    };
    start(async () => {
      const res = await fetch(`/api/studio/tools/${tool.code}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra.");
        return;
      }
      if (data.pending && data.jobId) {
        aiJob.start(data.jobId, data.sessionUrl, {
          onDone: (res: unknown) => {
            const d = res as DocContent;
            const ok = d && typeof d.title === "string" && Array.isArray(d.sections);
            // CR-037: async path cung loc section lac de cho DC-01
            const clean = ok && tool.code === "DC-01" ? sanitizeKhbdDoc(d) : ok ? d : null;
            if (clean) {
              setDoc(clean);
              setDocTabs(null);
              setProvider("fallback-engine");
            } else {
              setError("AI trả về dữ liệu không đúng định dạng - thử lại sau.");
            }
          },
          onFail: () => setError("AI xử lý gặp lỗi - thử lại sau."),
        });
        return;
      }
      setDoc(data.doc);
      // Exam-pack (CR-023): DC-03 full tra them de du phong + bien ban phan bien
      if (data.docDB || data.docBBPB) {
        const tabs: { label: string; doc: DocContent }[] = [
          { label: "Đề chính thức", doc: data.doc },
        ];
        if (data.docDB) tabs.push({ label: "Đề dự phòng", doc: data.docDB });
        if (data.docBBPB) tabs.push({ label: "Biên bản phản biện", doc: data.docBBPB });
        setDocTabs(tabs);
        setActiveTab(0);
      } else {
        setDocTabs(null);
      }
      setProvider(data.provider ?? null);
      setMissing(data.missing ?? 0);
      setReview(data.review ?? 0);
      setMatrixPayload(
        data.matrix
          ? {
              cells: data.matrix.cells,
              spec: data.matrix.spec,
              totalPoints: Number(values.total_points) || 10,
              durationMin: Number(values.duration) || 45,
            }
          : null,
      );
    });
  };

  const save = async () => {
    if (!doc) return;
    setSaving(true);
    const res = await saveMaterial({
      title: doc.title,
      type: tool.materialType,
      toolCode: tool.code,
      subjectCode: values.subject ?? null,
      grade: values.grade ? Number(values.grade) : null,
      standardIds: selectedStd,
      content: doc,
      aiUsage: provider === "rule-based" || provider === "question-bank" ? "none" : "full",
      matrix: matrixPayload
        ? {
            cells: matrixPayload.cells,
            spec: matrixPayload.spec,
            durationMin: matrixPayload.durationMin,
            totalPoints: matrixPayload.totalPoints,
          }
        : undefined,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSavedId(res.id!);
  };

  const fieldEl = (f: ToolField) => {
    switch (f.type) {
      case "subject":
        return (
          <select
            className={inputCls}
            value={values.subject ?? ""}
            onChange={(e) => set("subject", e.target.value)}
          >
            <option value="">- Chọn môn -</option>
            {subjects.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        );
      case "grade":
        return (
          <select
            className={inputCls}
            value={values.grade ?? ""}
            onChange={(e) => set("grade", e.target.value)}
            disabled={!values.subject}
          >
            <option value="">- Chọn khối -</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                Lớp {g}
              </option>
            ))}
          </select>
        );
      case "standard":
        return (
          <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-lg border bg-background p-2">
            {!standards.length && (
              <p className="p-2 text-xs text-muted-foreground">
                {values.subject && values.grade
                  ? "Chưa có YCCĐ cho phạm vi này."
                  : "Chọn môn và khối trước."}
              </p>
            )}
            {standards.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedStd.includes(s.id)}
                  onChange={(e) =>
                    setSelectedStd((prev) =>
                      e.target.checked
                        ? [...prev, s.id]
                        : prev.filter((x) => x !== s.id),
                    )
                  }
                />
                <span>
                  <span className="font-mono text-xs text-primary">{s.code}</span>{" "}
                  {s.lesson_ref && <span className="text-muted-foreground">[{s.lesson_ref}]</span>}{" "}
                  {s.description}
                </span>
              </label>
            ))}
          </div>
        );
      case "select": {
        const opts =
          f.key === "matrix_id"
            ? matrixOptions.map((m) => ({ value: m.id, label: m.title }))
            : f.key === "khbd_template"
              ? tplOptions.map((t) => ({ value: t.id, label: t.name }))
              : (f.options ?? []);
        return (
          <select
            className={inputCls}
            value={values[f.key] ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          >
            <option value="">- Chọn -</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      case "textarea":
      case "words":
        return (
          <AutoGrowTextarea
            className={inputCls}
            rows={f.type === "words" ? 6 : 4}
            placeholder={f.placeholder}
            value={values[f.key] ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          />
        );
      case "number":
        return (
          <input
            type="number"
            className={inputCls}
            value={values[f.key] ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          />
        );
      default:
        return (
          <input
            className={inputCls}
            placeholder={f.placeholder}
            value={values[f.key] ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          />
        );
    }
  };

  const stdCount = selectedStd.length;
  const genLabel = useMemo(
    () => (tool.code === "DC-03" ? "Rút câu hỏi & sinh đề" : "Sinh học liệu"),
    [tool.code],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      {/* Form */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Thông tin đầu vào</h2>
          {fromMaterial && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
              <p className="font-medium">
                Sinh slide từ giáo án đã soạn - không cần nhập lại.
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {fromMaterial.title} -{" "}
                <a
                  href={`/studio/library/${fromMaterial.id}`}
                  className="text-primary hover:underline"
                >
                  xem giáo án
                </a>
              </p>
            </div>
          )}
          <div className="mt-4 space-y-4">
            {tool.fields.map((f) => (
              <div key={f.key}>
                <label className="text-sm font-medium">
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </label>
                {fieldEl(f)}
                {f.help && (
                  <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>
                )}
              </div>
            ))}
          </div>

          {tool.coDraftFields && tool.coDraftFields.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <button
                type="button"
                onClick={() => setCoMode(!coMode)}
                className="flex items-center gap-2 text-sm font-medium text-primary"
              >
                <Users className="h-4 w-4" />
                Chế độ &quot;Cùng soạn&quot; {coMode ? "(đang bật)" : ""}
              </button>
              {coMode && (
                <div className="mt-3 space-y-3">
                  {tool.coDraftFields.map((f) => (
                    <div key={f.key}>
                      <label className="text-sm font-medium">{f.label}</label>
                      <AutoGrowTextarea
                        className={inputCls}
                        rows={2}
                        placeholder={f.placeholder}
                        value={coValues[f.key] ?? ""}
                        onChange={(e) =>
                          setCoValues((p) => ({ ...p, [f.key]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          {aiJob.job && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI đang xử lý - có thể mất vài phút, vui lòng chờ...
              </p>
            </div>
          )}
          <button
            onClick={generate}
            disabled={pending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {pending ? "Đang sinh..." : genLabel}
          </button>
        </div>

        {doc && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Lưu vào thư viện</h3>
              <button
                onClick={() => setEditMode(!editMode)}
                className="text-sm text-primary hover:underline"
              >
                {editMode ? "Xem bản in" : "Chỉnh sửa"}
              </button>
            </div>
            {provider === "rule-based" && (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <span className="font-semibold">BẢN KHUNG MẪU</span> - AI tạm
                không khả dụng. Đây chỉ là khung chuẩn: các mục trong ngoặc
                [ ] cần giáo viên điền nội dung cụ thể của bài trước khi dùng.
                Bấm &quot;{genLabel}&quot; lại khi AI hoạt động để có học liệu
                đầy đủ.
              </div>
            )}
            {provider && provider !== "rule-based" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Nguồn sinh: {provider === "question-bank" ? "Ngân hàng câu hỏi" : provider === "fallback-engine" ? "AI (máy chủ dự phòng)" : "AI"}
                {missing > 0 && ` - còn thiếu ${missing} câu hỏi trong ngân hàng`}
                {review > 0 && ` - ${review} câu được thay bằng câu gần đúng (khác mức/dạng), cần rà soát`}
              </p>
            )}
            {savedId ? (
              <button
                onClick={() => router.push(`/studio/library/${savedId}`)}
                className="mt-3 w-full rounded-lg border border-success bg-emerald-400/15 py-2 text-sm font-semibold text-emerald-300"
              >
                Đã lưu - Mở trong thư viện
              </button>
            ) : (
              <button
                onClick={save}
                disabled={saving}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border bg-background py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Đang lưu..." : "Lưu học liệu"}
              </button>
            )}
            {stdCount > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Gắn {stdCount} mã yêu cầu cần đạt
              </p>
            )}
          </div>
        )}
      </div>

      {/* Preview / Editor */}
      <div className="min-w-0">
        {docTabs && docTabs.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {docTabs.map((t, i) => (
              <button
                key={t.label}
                onClick={() => {
                  // dong bo phan chinh sua hien tai vao tab truoc khi doi
                  if (doc) {
                    setDocTabs((prev) =>
                      prev
                        ? prev.map((x, j) => (j === activeTab ? { ...x, doc } : x))
                        : prev,
                    );
                  }
                  setActiveTab(i);
                  setDoc(docTabs[i].doc);
                  setEditMode(false);
                }}
                className={`rounded-full border px-3 py-1 text-sm ${
                  activeTab === i
                    ? "border-primary bg-secondary font-semibold text-secondary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {doc ? (
          editMode ? (
            <DocEditor
              doc={doc}
              onChange={(d) => {
                setDoc(d);
                if (docTabs)
                  setDocTabs((prev) =>
                    prev
                      ? prev.map((x, j) => (j === activeTab ? { ...x, doc: d } : x))
                      : prev,
                  );
              }}
            />
          ) : (
            <DocRender doc={doc} />
          )
        ) : (
          <div className="a4-sheet flex min-h-[400px] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Sparkles className="mx-auto h-8 w-8 opacity-30" />
              <p className="mt-3 text-sm">
                Điền thông tin bên trái rồi bấm &quot;{genLabel}&quot;.
                <br />
                Kết quả hiển thị tại đây - chỉnh sửa trực tiếp trước khi lưu.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
