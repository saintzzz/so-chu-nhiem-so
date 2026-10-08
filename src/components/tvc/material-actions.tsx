"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DocContent, Material } from "@/types/tvc";
import { formatDateTime } from "@/lib/utils";
import { DocEditor } from "./doc-editor";
import { DocRender } from "./doc-render";
import {
  updateMaterialContent,
  deleteMaterial,
  submitMaterialReview,
  reviewMaterial,
} from "@/lib/tvc/actions";
import {
  Save, Trash2, FileDown, Printer, Eye, PenLine, Loader2,
} from "lucide-react";

const btn =
  "inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";

export function MaterialActions({
  material,
  meId,
  myRoles,
  reviews = [],
}: {
  material: Material;
  meId?: string;
  myRoles?: string[];
  reviews?: { layer: number; status: string; notes: string | null; created_at: string }[];
}) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocContent>(material.content);
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const isAuthor = !meId || material.author_id === meId;
  const canEdit =
    isAuthor &&
    ["personal", "draft", "rejected", "withdrawn"].includes(material.status);
  const canSubmit = isAuthor && canEdit;
  const isToTruong = myRoles?.includes("to_truong") ?? false;
  const isBgh = myRoles?.some((r) => ["bgh", "admin"].includes(r)) ?? false;
  const canReview =
    (isToTruong && material.status === "in_review") ||
    (isBgh && ["in_review", "totruong_ok"].includes(material.status));

  const save = () =>
    start(async () => {
      const r = await updateMaterialContent(material.id, doc, doc.title);
      if (r.error) setError(r.error);
      else {
        setDirty(false);
        router.refresh();
      }
    });

  const act = (fn: () => Promise<{ error?: string; ok?: boolean }>) =>
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else router.refresh();
    });

  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-2">
        {canEdit && (
          <button className={btn} onClick={() => setEditMode(!editMode)}>
            {editMode ? <Eye className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
            {editMode ? "Xem bản in" : "Chỉnh sửa"}
          </button>
        )}
        {editMode && dirty && (
          <button className={btnPrimary} onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu thay đổi
          </button>
        )}
        <a className={btn} href={`/api/studio/materials/${material.id}/export?fmt=docx`}>
          <FileDown className="h-4 w-4" /> Xuất Word
        </a>
        {material.type === "slides" && (
          <a className={btn} href={`/api/studio/materials/${material.id}/export?fmt=pptx`}>
            <FileDown className="h-4 w-4" /> Xuất PPTX
          </a>
        )}
        <a className={btn} href={`/studio-print/${material.id}`} target="_blank">
          <Printer className="h-4 w-4" /> Xuất PDF
        </a>
        {canSubmit && (
          <button
            className={btnPrimary}
            disabled={pending}
            onClick={() => act(() => submitMaterialReview(material.id))}
          >
            Gửi duyệt
          </button>
        )}
        {canReview && (
          <>
            <button
              className={btnPrimary}
              disabled={pending}
              onClick={() => {
                const note = window.prompt("Ghi chú duyệt (không bắt buộc):") ?? "";
                act(() => reviewMaterial(material.id, "approve", note));
              }}
            >
              {isToTruong && material.status === "in_review"
                ? "Tổ duyệt"
                : "BGH duyệt - xuất bản"}
            </button>
            <button
              className={`${btn} text-destructive`}
              disabled={pending}
              onClick={() => {
                const note = window.prompt("Lý do trả về:") ?? "";
                act(() => reviewMaterial(material.id, "reject", note));
              }}
            >
              Trả về
            </button>
          </>
        )}
        {canEdit && (
          <button
            className={`${btn} text-destructive`}
            disabled={pending}
            onClick={() => {
              if (confirm("Xóa học liệu này?"))
                act(async () => {
                  const r = await deleteMaterial(material.id);
                  if (!r.error) router.push("/studio/library");
                  return r;
                });
            }}
          >
            <Trash2 className="h-4 w-4" /> Xóa
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {material.review_note && (
        <p className="mt-2 text-sm text-muted-foreground">
          Ghi chú duyệt: {material.review_note}
        </p>
      )}
      {reviews.length > 0 && (
        <div className="mt-3 rounded-xl border bg-card p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Lịch sử kiểm duyệt</p>
          {reviews.map((r, i) => (
            <p key={i}>
              {formatDateTime(r.created_at)} -{" "}
              {r.layer === 0
                ? "Tác giả"
                : r.layer === 1
                  ? "Tổ trưởng"
                  : "BGH"}
              : {r.status === "submitted" ? "gửi duyệt" : r.status === "approved" ? "duyệt" : "từ chối"}
              {r.notes ? ` (${r.notes})` : ""}
            </p>
          ))}
        </div>
      )}
      <div className="mt-4">
        {editMode ? (
          <DocEditor
            doc={doc}
            onChange={(d) => {
              setDoc(d);
              setDirty(true);
            }}
          />
        ) : (
          <DocRender doc={material.content} />
        )}
      </div>
    </div>
  );
}
