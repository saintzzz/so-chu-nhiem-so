/**
 * CR-025: LLM content harness - sinh YCCĐ + ngan hang cau hoi qua AI provider,
 * qua validate pipeline giong app truoc khi insert DB.
 *
 * Su dung:
 *   node scripts/gen-tvc-content.mjs --mode=questions [--subject=toan] [--grade=4] [--per-std=2] [--owner=gvcn@demo.scn] [--dry]
 *   node scripts/gen-tvc-content.mjs --mode=yccd --subject=tieng_anh --grade=5 --count=6 [--dry]
 *
 * Provider: doc env giong src/lib/ai.ts (GEMINI_API_KEY > OPENAI_API_KEY > ANTHROPIC_API_KEY,
 * AI_PROVIDER/AI_MODEL override). Cau hoi AI sinh luon vao `review_state=unreviewed`,
 * `source=generated` - cho qua phase chuyen gia ra soat (backlog B1/B2, CR-024).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => l.split("=", 2).map((s) => s.trim())),
);
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=", 2)[1] : d;
};
const MODE = arg("mode", "questions");
const SUBJECT = arg("subject", null);
const GRADE = arg("grade", null) ? Number(arg("grade")) : null;
const PER_STD = Number(arg("per-std", 2));
const COUNT = Number(arg("count", 5));
const DRY = process.argv.includes("--dry");
const OWNER = arg("owner", "gvcn@demo.scn");
// --from-file=path.json: harness qua ChatGPT/Claude web (khong can API key) -
// LLM web tra JSON co "std_code" -> script validate + insert.
const FROM_FILE = arg("from-file", null);

// ---------- LLM ----------
const MODELS = { gemini: "gemini-2.5-flash", openai: "gpt-4o-mini", anthropic: "claude-haiku-4-5-20251001" };
function providers() {
  const forced = env.AI_PROVIDER;
  const order = ["gemini", "openai", "anthropic"].filter((p) =>
    forced ? p === forced : true,
  );
  return order
    .map((p) => ({
      p,
      key: env[`${p.toUpperCase()}_API_KEY`],
      model: env.AI_MODEL ?? MODELS[p],
    }))
    .filter((x) => x.key);
}
async function llm(prompt, system) {
  for (const c of providers()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await call(c, prompt, system);
        if (text) return text;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 4000));
      } catch (e) {
        console.warn(`  [llm] ${c.p} loi: ${e.message?.slice(0, 80)}`);
      }
    }
  }
  return null;
}
async function call({ p, key, model }, prompt, system) {
  if (p === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("").trim();
  }
  if (p === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()).choices?.[0]?.message?.content?.trim();
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j.content?.map((b) => b.text ?? "").join("").trim();
}
function parseJsonArr(text) {
  if (!text) return null;
  const m = text.match(/\[[\s\S]*\]/);
  try {
    const arr = JSON.parse(m ? m[0] : text);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

// ---------- Validation mirror (src/lib/tvc/question-validate.ts) ----------
// Mirror nguyen tac referencesMissingContext() trong src/lib/tvc/question-validate.ts
const CTX_REF_RE =
  /(the\s+(passage|text|reading|dialogue|poem|advert|notice)|đoạn\s+(trích|văn|thơ|sau)\s*(sau|trên|:)|văn bản\s*(sau|trên)|bài đọc|như hình|theo hình|hình (vẽ|bên|sau)|theo (bảng|sơ đồ|đồ thị)|bảng sau|đồ thị sau|sơ đồ sau)/i;
function referencesMissingContext(stem, context) {
  if (context?.trim()) return false;
  const m = stem.match(CTX_REF_RE);
  if (!m) return false;
  if (/['"“‘][^'"”’]{120,}['"”’]/.test(stem)) return false;
  const after = stem.slice((m.index ?? 0) + m[0].length);
  if (after.length > 250) return false;
  return !/['"“‘][^'"”’]{40,}['"”’]/.test(after);
}
function validate(q) {
  const errs = [];
  if (!q.stem || q.stem.trim().length < 10) errs.push("stem ngan");
  if (referencesMissingContext(q.stem, q.context))
    errs.push("tham chieu ngu canh nhung khong co context");
  if (q.qtype === "multiple_choice") {
    if (!/(?:^|\n|\s)A[.)]/.test(q.stem) || !/(?:^|\n|\s)D[.)]/.test(q.stem))
      errs.push("MC thieu dap an A-D trong stem");
    if (!/^[A-D]$/.test(q.correct ?? "")) errs.push("MC correct phai la A-D");
  }
  if (q.qtype === "true_false_4") {
    if (!/a\)/.test(q.stem) || !/d\)/.test(q.stem)) errs.push("TF thieu a)-d)");
    if (!/^[a-d]-(Đúng|Sai|True|False)(,\s*[a-d]-(Đúng|Sai|True|False)){3}$/i.test(q.correct ?? ""))
      errs.push("TF correct phai dang 'a-Đúng, b-Sai, c-Đúng, d-Sai'");
  }
  if (q.qtype === "short_answer" && !(q.correct ?? "").trim())
    errs.push("SA thieu dap an");
  if (q.qtype === "essay" && (q.solution ?? "").trim().length < 20)
    errs.push("Essay thieu loi giai >=20 ky tu");
  if (!["biet", "hieu", "van_dung", "van_dung_cao"].includes(q.level))
    errs.push("level sai");
  if (!["multiple_choice", "true_false_4", "short_answer", "essay"].includes(q.qtype))
    errs.push("qtype sai");
  return errs;
}
const normStem = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
// LLM hay viet "A. x B. y C. z D. w" tren 1 dong - tach xuong dong truoc khi validate.
const fixMcOptions = (stem) =>
  stem.replace(/\s+([B-D])\.\s/g, "\n$1. ").replace(/(^|\n)([A-D])\.\s*/g, "$1$2. ");
const LEVEL_MAP = {
  "nhận biết": "biet", "nhan biet": "biet", biet: "biet",
  "thông hiểu": "hieu", hieu: "hieu", "hiểu": "hieu",
  "vận dụng": "van_dung", van_dung: "van_dung",
  "vận dụng linh hoạt": "van_dung_cao", "vận dụng cao": "van_dung_cao",
  van_dung_cao: "van_dung_cao",
};
function normalize(q) {
  if (q.options && q.qtype === "multiple_choice" && !/(?:^|\n)A\./.test(q.stem ?? "")) {
    const opts = ["A", "B", "C", "D"]
      .map((k) => `${k}. ${q.options[k] ?? ""}`)
      .join("\n");
    q.stem = `${(q.stem ?? "").trim()}\n${opts}`;
  }
  if (typeof q.level === "string") {
    q.level = LEVEL_MAP[q.level.trim().toLowerCase()] ?? q.level;
  }
  if (typeof q.qtype !== "string") q.qtype = "multiple_choice";
  return q;
}

const SUBJECT_NAME = { toan: "Toán", tieng_viet: "Tiếng Việt", ngu_van: "Ngữ văn", tieng_anh: "Tiếng Anh" };
const LEVEL_TH = "Nhận biết (biet) / Hiểu (hieu) / Vận dụng (van_dung) / Vận dụng linh hoạt (van_dung_cao)";

const SYS = `Ban la chuyen gia chuong trinh giao duc pho thong Viet Nam (CTGDPT 2018, TT 32/2018) va chuyen gia ra de kiem tra theo TT 22/2021/TT-BGDĐT.
Quy tac bat buoc:
- Chi tra ve JSON array hop le, KHONG markdown, KHONG giai thich.
- Ngu lieu (doan doc, hoi thoai, bai toan) PHAI tu viet moi - tuyet doi khong sao chep sach giao khoa hay de thi co ban quyen.
- Cau hoi tham chieu "doan van/doan tho/bai doc" PHAI kem truong "context" chua nguyen doan do.
- Stem trac nghiem 4 lua chon PHAI viet moi lua chon tren mot dong rieng: dong "A. ...", dong "B. ...", dong "C. ...", dong "D. ...".
- Cau Dung-Sai PHAI co 4 y a) b) c) d) trong stem va correct dang "a-Đúng, b-Sai, c-Đúng, d-Đúng".
- Tuyet doi khong dung dau gach ngang dai (em dash, en dash) - chi dung gach ngang "-".`;

// ---------- MODE: questions --from-file (LLM web: ChatGPT/Claude) ----------
async function importQuestions() {
  const raw = JSON.parse(readFileSync(resolve(root, FROM_FILE), "utf8"));
  const items = Array.isArray(raw) ? raw : raw.questions ?? [];
  if (!items.length) throw new Error("File khong co cau hoi");
  const { data: owner } = await supabase
    .from("tvc_profiles")
    .select("id")
    .eq("email", OWNER)
    .single();
  const { data: stds } = await supabase
    .from("tvc_curriculum_standards")
    .select("id, code, subject_code, grade")
    .is("school_id", null);
  const stdOf = new Map(stds.map((s) => [s.code, s]));
  const { data: exist } = await supabase
    .from("tvc_questions")
    .select("stem")
    .eq("owner_id", owner.id);
  const seen = new Set((exist ?? []).map((r) => normStem(r.stem)));
  const typeCode = { multiple_choice: "D", true_false_4: "F", short_answer: "S", essay: "E" };
  const seq = new Map();
  let ok = 0, bad = 0, dup = 0;
  for (const item of items) {
    const s = stdOf.get(item.std_code);
    if (!s) { bad++; console.warn(`  bo qua: ma ${item.std_code} khong ton tai`); continue; }
    const q = normalize({
      qtype: item.qtype, level: item.level, stem: item.stem,
      context: item.context ?? null, correct: item.correct ?? null,
      solution: item.solution ?? null, options: item.options ?? null,
    });
    if (q.qtype === "multiple_choice" && q.stem) q.stem = fixMcOptions(q.stem);
    if (q.qtype === "multiple_choice" && typeof q.correct === "string")
      q.correct = q.correct.trim().toUpperCase();
    const errs = validate(q);
    if (errs.length) { bad++; console.warn(`  ${s.code}: ${errs.join(", ")}`); continue; }
    if (seen.has(normStem(q.stem))) { dup++; continue; }
    seen.add(normStem(q.stem));
    const key = `${s.code}-${typeCode[q.qtype]}`;
    const n = (seq.get(key) ?? 0) + 1;
    seq.set(key, n);
    const row = {
      owner_id: owner.id,
      code: `${s.code}-${typeCode[q.qtype]}AI${String(n).padStart(2, "0")}`,
      stem: q.stem.trim(), context: q.context, qtype: q.qtype, level: q.level,
      points: typeof item.points === "number" ? item.points : 0.5,
      answer: q.correct ? { correct: q.correct } : {},
      solution: q.solution,
      standard_ids: [s.id], subject_code: s.subject_code, grade: s.grade,
      source: "generated", review_state: "unreviewed",
    };
    if (DRY) { ok++; continue; }
    const { error } = await supabase.from("tvc_questions").insert(row);
    if (error) { bad++; console.warn(`  ${s.code}: insert ${error.message.slice(0, 80)}`); }
    else ok++;
  }
  console.log(`Import file: them ${ok} (${DRY ? "dry" : "ghi"}), ${dup} trung, ${bad} loai.`);
}

// ---------- MODE: questions ----------
async function genQuestions() {
  let q = supabase
    .from("tvc_curriculum_standards")
    .select("id, code, subject_code, grade, strand, description")
    .is("school_id", null)
    .order("subject_code")
    .order("grade");
  if (SUBJECT) q = q.eq("subject_code", SUBJECT);
  if (GRADE) q = q.eq("grade", GRADE);
  const { data: stds } = await q;
  console.log(`Sinh cau hoi cho ${stds.length} YCCĐ (${PER_STD} cau/ma)...`);

  const { data: owner } = await supabase
    .from("tvc_profiles")
    .select("id")
    .eq("email", OWNER)
    .single();
  if (!owner) throw new Error(`owner ${OWNER} chua co tvc profile`);

  const { data: exist } = await supabase
    .from("tvc_questions")
    .select("stem")
    .eq("owner_id", owner.id);
  const seen = new Set((exist ?? []).map((r) => normStem(r.stem)));

  const typeCode = { multiple_choice: "D", true_false_4: "F", short_answer: "S", essay: "E" };
  let ok = 0, bad = 0, dup = 0;
  for (const s of stds) {
    const isTH = s.grade <= 5;
    const prompt = `Mon ${SUBJECT_NAME[s.subject_code] ?? s.subject_code} lop ${s.grade} - chuong trinh GDPT 2018.
YCCĐ ${s.code} (${s.strand}): "${s.description}"
Viet ${PER_STD} cau hoi khac nhau dung de kiem tra YCCĐ nay, da dang qtype va muc do.
Schema moi cau: {"qtype":"multiple_choice|true_false_4|short_answer|essay","level":"biet|hieu|van_dung|van_dung_cao","points":0.5,"stem":"...","context":null,"correct":"...","solution":"..."}
- level: viet dung ma tieng Anh trong schema (biet, hieu, van_dung, van_dung_cao) - KHONG viet "Nhan biet".
- multiple_choice: options nhung NGAY trong stem, moi option mot dong "A. ..." -> "D. ..."; correct = "A"|"B"|"C"|"D".
- essay: correct = null, solution = huong dan cham day du.
${isTH ? `Cap tieu hoc - muc do theo TT 22/2021: ${LEVEL_TH}.` : "Cap THCS/THPT - muc theo CV 7991: biet/hieu/van_dung."}
Tra JSON array.`;
    const arr = parseJsonArr(await llm(prompt, SYS));
    await new Promise((r) => setTimeout(r, 1500)); // tranh rate-limit
    if (!arr) { bad += PER_STD; console.warn(`  ${s.code}: LLM khong tra JSON`); continue; }
    const seq = new Map();
    for (const q of arr) {
      normalize(q);
      if (q.qtype === "multiple_choice" && q.stem) q.stem = fixMcOptions(q.stem);
      if (q.qtype === "multiple_choice" && typeof q.correct === "string")
        q.correct = q.correct.trim().toUpperCase();
      const errs = validate(q);
      const stemKey = normStem(q.stem ?? "");
      if (errs.length) { bad++; console.warn(`  ${s.code}: bo qua (${errs.join(", ")})`); continue; }
      if (seen.has(stemKey)) { dup++; continue; }
      seen.add(stemKey);
      const key = `${s.code}-${typeCode[q.qtype]}`;
      const n = (seq.get(key) ?? 0) + 1;
      seq.set(key, n);
      const row = {
        owner_id: owner.id,
        code: `${s.code}-${typeCode[q.qtype]}AI${String(n).padStart(2, "0")}`,
        stem: q.stem.trim(),
        context: q.context || null,
        qtype: q.qtype,
        level: q.level,
        points: typeof q.points === "number" ? q.points : 0.5,
        answer: q.correct ? { correct: q.correct } : {},
        solution: q.solution || null,
        standard_ids: [s.id],
        subject_code: s.subject_code,
        grade: s.grade,
        source: "generated",
        review_state: "unreviewed",
      };
      if (DRY) { ok++; continue; }
      const { error } = await supabase.from("tvc_questions").insert(row);
      if (error) { bad++; console.warn(`  ${s.code}: insert loi ${error.message.slice(0, 80)}`); }
      else ok++;
    }
    process.stdout.write(`  ${s.code}: xong\r`);
  }
  console.log(`\nKet qua: them ${ok} cau (${DRY ? "dry-run" : "da ghi"}), ${dup} trung, ${bad} loai/loi.`);
}

// ---------- MODE: yccd ----------
async function genYccd() {
  if (!SUBJECT || !GRADE) throw new Error("--mode=yccd can --subject va --grade");
  const { data: exist } = await supabase
    .from("tvc_curriculum_standards")
    .select("code, strand, description")
    .is("school_id", null)
    .eq("subject_code", SUBJECT)
    .eq("grade", GRADE);
  const prefix = { toan: "TOAN", tieng_viet: "TVIET", ngu_van: "VAN", tieng_anh: "ANH" }[SUBJECT];
  const prompt = `Mon ${SUBJECT_NAME[SUBJECT]} lop ${GRADE} - CTGDPT 2018 (TT 32/2018).
Cac ma YCCĐ da co: ${(exist ?? []).map((e) => e.code).join(", ")}.
Viet them ${COUNT} yeu cau can dat CON THIEU cho mon/lop nay, bam van ban chuong trinh (van phong "Duc/Hieu/Van dung duoc..."), khong trung noi dung ma da co.
Schema: {"code":"${prefix}${GRADE}.<mach>.<stt>","strand":"...","description":"...","competencies":["<ten nang luc dac thu chuong trinh>"]}
Toan: mach 1=So va phep tinh, 2=Hinh hoc va Do luong, 3=TK-XS, 4=TH-TN; nang luc: "Tu duy va lap luan toan hoc"|"Mo hinh hoa toan hoc"|"Giai quyet van de toan hoc"|"Giao tiep toan hoc".
Tieng Viet: mach 1=Doc, 2=Viet, 3=Noi va nghe, 4=KTTV; nang luc: "Nang luc ngon ngu"|"Nang luc van hoc".
Tieng Anh: mach 1=Nghe, 2=Noi, 3=Doc, 4=Viet, 5=Kien thuc ngon ngu; nang luc: "Nang luc giao tiep tieng Anh".
Tra JSON array.`;
  const arr = parseJsonArr(await llm(prompt, SYS));
  if (!arr) throw new Error("LLM khong tra JSON hop le");
  const codeRe = new RegExp(`^${prefix}${GRADE}\\.\\d+\\.\\d+$`);
  const existCodes = new Set((exist ?? []).map((e) => e.code));
  let ok = 0;
  for (const s of arr) {
    if (!codeRe.test(s.code ?? "") || existCodes.has(s.code) || !(s.description ?? "").length) {
      console.warn(`  bo qua ma khong hop le: ${s.code}`);
      continue;
    }
    const row = {
      code: s.code, subject_code: SUBJECT, grade: GRADE, strand: s.strand ?? "",
      lesson_ref: "", description: s.description, competencies: s.competencies ?? [],
      version: "2025-2026", status: "active", prerequisite_ids: [], school_id: null,
    };
    if (DRY) { console.log(`  [dry] ${s.code}`); ok++; continue; }
    const { error } = await supabase.from("tvc_curriculum_standards").insert(row);
    if (error) console.warn(`  ${s.code}: ${error.message.slice(0, 80)}`);
    else ok++;
  }
  console.log(`YCCĐ: them ${ok}/${arr.length} (${DRY ? "dry-run" : "da ghi"}).`);
}

(FROM_FILE ? importQuestions() : MODE === "yccd" ? genYccd() : genQuestions()).catch((e) => {
  console.error(e);
  process.exit(1);
});
