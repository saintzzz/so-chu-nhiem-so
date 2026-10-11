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
  // R3: {"title":"","sections":[]} tung qua duoc predicate va thang race,
  // huy ca candidate hop le; blocks:[null] thi no cleanDoc. Doc hop le phai
  // co it nhat 1 section, moi section >=1 block, moi block la object co
  // kind dang string. Appendix (neu co) cung phai cung hinh dang.
  const validBlock = (b: unknown): boolean => {
    if (!b || typeof b !== "object") return false;
    const blk = b as { kind?: unknown; text?: unknown; items?: unknown };
    if (typeof blk.kind !== "string") return false;
    // R4: payload phai dung kieu - text:42 tung qua predicate roi no .trim()
    // luc clean/render; items khong phai array cung no cleanDoc.
    if (blk.text !== undefined && blk.text !== null && typeof blk.text !== "string")
      return false;
    if (blk.items !== undefined && blk.items !== null) {
      if (!Array.isArray(blk.items)) return false;
      if (!blk.items.every((i) => typeof i === "string")) return false;
    }
    if (blk.kind === "list" && !Array.isArray(blk.items)) return false;
    return true;
  };
  const validSection = (s: unknown): boolean => {
    const sec = s as DocContent["sections"][0];
    return (
      !!sec &&
      typeof sec.title === "string" &&
      Array.isArray(sec.blocks) &&
      sec.blocks.length > 0 &&
      sec.blocks.every(validBlock)
    );
  };
  return (
    !!d &&
    typeof d.title === "string" &&
    Array.isArray(d.sections) &&
    d.sections.length > 0 &&
    d.sections.every(validSection) &&
    // R4: appendix: {} tung duoc chap nhan (neu khong phai array thi bo qua
    // check) roi .map no trong cleanDoc - phai la array hoac absent/null.
    (d.appendix === undefined ||
      d.appendix === null ||
      (Array.isArray(d.appendix) && d.appendix.every(validSection)))
  );
}

// Tool tieng Anh (A-01/A-03): model yeu doi khi bo qua system prompt va viet
// hoi thoai/bai doc bang tieng Viet - hoc lieu vo dung. Kiem tra ty le ky tu
// co dau tieng Viet trong noi dung sections (bo qua appendix + table vi cot
// nghia tu vung hop le la tieng Viet). Nguong 4% - heading Viet rai rac van
// duoc cho phep, than van ban Viet (~13%+) bi bat.
const VN_DIACRITIC =
  /[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵÁÀẢÃẠẤẦẨẪẬẮẰẲẴẶÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]/g;

export function sectionsLookEnglish(doc: DocContent): boolean {
  let vn = 0;
  let total = 0;
  const eat = (s?: string) => {
    if (!s) return;
    total += s.length;
    vn += (s.match(VN_DIACRITIC) ?? []).length;
  };
  for (const sec of doc.sections ?? []) {
    for (const b of sec.blocks ?? []) {
      if (b.kind === "para" || b.kind === "note" || b.kind === "heading")
        eat(b.text);
      if (b.kind === "list") (b.items ?? []).forEach(eat);
    }
  }
  return total === 0 || vn / total < 0.04;
}

/** Loc block rong model hay them vao (para/note/heading khong text, list khong item). */
function cleanDoc(doc: DocContent): DocContent {
  const clean = (blocks: DocContent["sections"][0]["blocks"]) =>
    (blocks ?? []).filter(
      (b) =>
        !(
          ((b.kind === "para" || b.kind === "note" || b.kind === "heading") &&
            !b.text?.trim()) ||
          (b.kind === "list" && !(b.items ?? []).some((i) => i?.trim()))
        ),
    );
  return {
    ...doc,
    sections: (doc.sections ?? []).map((s) => ({
      ...s,
      blocks: clean(s.blocks),
    })),
    appendix: (doc.appendix ?? []).map((s) => ({
      ...s,
      blocks: clean(s.blocks),
    })),
  };
}

export async function generateDoc(
  system: string,
  prompt: string,
  opts?: { validate?: (doc: DocContent) => boolean; retryNote?: string },
): Promise<{ doc: DocContent | null; provider: string | null; error: string | null }> {
  // CR-042: KHBD day du ~8-12k output tokens - cap 8192 cat ngang JSON.
  // 2 lan thu chia chung 1 budget 105s (maxDuration route 120s): model doi
  // khi viet sai cu phap JSON ngau nhien, retry re hon nhieu ban khung.
  // R2: budget tinh 1 lan cho CA operation, khong cap lai 70s moi attempt.
  const opStart = Date.now();
  const OP_BUDGET = 105_000;
  const remaining = () => OP_BUDGET - (Date.now() - opStart);
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = remaining();
    if (left <= 5000) break;
    const r = await generateTextDetailed(
      attempt === 0
        ? prompt
        : `${prompt}\n\nLUU Y BAT BUOC: ${opts?.retryNote ?? "output truoc bi loi cu phap JSON. Tra ve JSON hop le tuyet doi - dong du ngoac, du dau phay giua cac phan tu, khong tao chuoi ky tu lap dai."}`,
      {
        system,
        maxTokens: 16384,
        temperature: 0.7,
        // 25s mac dinh khong du cho doc 40KB+ - cap theo budget con lai.
        timeoutMs: Math.min(55000, left),
        // CR-049: ban song song AI_DOC_RACE (mac dinh 3) config dau, lay cai
        // nhanh nhat - cat do tre khi key dau cham/hang ma van giu fallback.
        race: Math.max(Number(process.env.AI_DOC_RACE ?? 3), 1),
        // R2: winner predicate = full validation (shape + tool-specific),
        // khong chi JSON-parseable - {} parse duoc nhung vo dung tung thang
        // race va huy ca candidate hop le dang chay cham hon.
        validate: (t) => {
          const parsed = extractJson<DocContent>(t);
          if (!parsed || !isDocContent(parsed)) return false;
          // R4: validate tren doc DA CLEAN - "chi toan para rong" tung thang
          // race roi cleanDoc tra ve 0 block. It nhat 1 block phai con lai.
          const cleaned = cleanDoc(parsed);
          if (!cleaned.sections.some((s) => s.blocks.length > 0)) return false;
          return opts?.validate?.(cleaned) ?? true;
        },
        maxTotalMs: left,
      },
    );
    if (!r.text) {
      // R3: quota/no_key la that bai van chuyen - return luon. Con "error"
      // co the la validation-exhaustion (candidate co text nhung reject)
      // -> van cho attempt 2 voi retryNote corrective trong budget con lai.
      if (r.error === "quota" || r.error === "no_key") {
        return { doc: null, provider: r.provider, error: r.error };
      }
      continue;
    }
    const parsed = extractJson<DocContent>(r.text);
    if (parsed && isDocContent(parsed)) {
      const cleaned = cleanDoc(parsed);
      if (
        cleaned.sections.some((s) => s.blocks.length > 0) &&
        (opts?.validate?.(cleaned) ?? true)
      ) {
        return { doc: cleaned, provider: r.provider, error: null };
      }
    }
    // Parse/shape/tool-validation fail -> attempt 2 co retryNote corrective.
  }
  return { doc: null, provider: null, error: "bad_json" };
}
