import { generateTextDetailed } from "@/lib/ai";
import type { DocContent } from "@/types/tvc";

/** Tách JSON object/array đầu tiên từ text model trả về (kể cả khi có markdown fence). */
export function extractJson<T = unknown>(text: string): T | null {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const objIdx = cleaned.indexOf("{");
  const arrIdx = cleaned.indexOf("[");
  let start: number;
  let open: string;
  let close: string;
  if (arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx)) {
    start = arrIdx; open = "["; close = "]";
  } else if (objIdx !== -1) {
    start = objIdx; open = "{"; close = "}";
  } else {
    return null;
  }
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export interface GenResult {
  doc: DocContent | null;
  provider: string | null;
  usedFallback: boolean;
}

/** Validate tối thiểu cấu trúc DocContent trả từ model. */
export function isDocContent(v: unknown): v is DocContent {
  const d = v as DocContent;
  return (
    !!d &&
    typeof d.title === "string" &&
    Array.isArray(d.sections) &&
    d.sections.every(
      (s) => typeof s?.title === "string" && Array.isArray(s?.blocks),
    )
  );
}

export async function generateDoc(
  system: string,
  prompt: string,
): Promise<{ doc: DocContent | null; provider: string | null; error: string | null }> {
  const r = await generateTextDetailed(prompt, {
    system,
    maxTokens: 8192,
    temperature: 0.7,
  });
  if (!r.text) return { doc: null, provider: r.provider, error: r.error };
  const parsed = extractJson<DocContent>(r.text);
  if (!parsed || !isDocContent(parsed)) {
    return { doc: null, provider: r.provider, error: "bad_json" };
  }
  return { doc: parsed, provider: r.provider, error: null };
}
