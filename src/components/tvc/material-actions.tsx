"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DocContent, Material } from "@/types/tvc";
import { DocEditor } from "./doc-editor";
import { DocRender } from "./doc-render";
import {
  updateMaterialContent,
  deleteMaterial,
} from "@/lib/tvc/actions";
import {
  Save, Trash2, FileDown, Printer, Eye, PenLine, Loader2,
} from "lucide-react";

const btn =
  "inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";

export function MaterialActions({ material }: { material: Material }) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocContent>(material.content);
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const canEdit = ["personal", "draft", "rejected", "withdrawn"].includes(material.status);

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
        <a className={btn} href={`/studio-print/${material.id}`} target="_blank">
          <Printer className="h-4 w-4" /> Xuất PDF
        </a>
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
