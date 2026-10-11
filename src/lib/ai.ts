import { redactPiiText } from "@/lib/ai-privacy";

export type AiProvider = "gemini" | "openai" | "anthropic";

interface AiConfig {
  provider: AiProvider;
  key: string;
  model: string;
}

const DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
};

export function getAiConfig(): AiConfig | null {
  return getAiConfigs()[0] ?? null;
}

/**
 * R16: allowlist processor (DPIA) dung chung cho moi transport AI -
 * text (getAiConfigs), TTS, Devin fallback. Dat AI_ALLOWED_PROVIDERS
 * (vd "gemini,openai,devin") de khoa ngoai y muon; rong = cho phep het.
 */
export function aiAllowedSet(): Set<string> | null {
  const allowed = (process.env.AI_ALLOWED_PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.length ? new Set(allowed) : null;
}

export function aiProviderAllowed(name: string): boolean {
  const s = aiAllowedSet();
  return !s || s.has(name);
}

/**
 * R3: check host destination co nam trong AI_ALLOWED_ENDPOINTS khong.
 * Danh sach rong = khong rang buoc (default-open nhu truoc khi co bien).
 * Dung cho cac processor goi endpoint co dinh ngoai duong openaiBaseUrl()
 * (vd TTS) - khong check thi van gui key + du lieu ra host bi cam.
 */
export function aiEndpointAllowed(url: string): boolean {
  const allow = (process.env.AI_ALLOWED_ENDPOINTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  // R4: HTTPS bat buoc ngoai localhost - http://allowed.example tuong lai
  // giu nguyen hostname nhung gui bearer key cleartext.
  const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !isLocal) return false;
  if (!allow.length) return true;
  return allow.includes(u.hostname);
}

/** R4: endpoint co dinh cua tung provider - tat ca transports deu qua
 * AI_ALLOWED_ENDPOINTS, khong chi slot openai. */
export function providerEndpointAllowed(provider: AiProvider): boolean {
  const host =
    provider === "gemini"
      ? "https://generativelanguage.googleapis.com"
      : provider === "openai"
        ? null // openai di qua openaiBaseUrl() - da fail-closed
        : "https://api.anthropic.com";
  return host === null || aiEndpointAllowed(host);
}

/**
 * Base URL cho slot openai (OpenAI-compatible endpoints vd OpenRouter).
 * Fail-closed: endpoint bi tu choi thi NEM LOI (khong lang le quay ve
 * api.openai.com roi leak bearer key + prompt ra host ngoai allowlist).
 * AI_ALLOWED_ENDPOINTS (hostnames, comma-sep) khi dat se rang buoc ca
 * endpoint mac dinh. HTTPS bat buoc tru localhost (dev).
 */
export function openaiBaseUrl(): string {
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1")
    .replace(/\/$/, "");
  const allow = (process.env.AI_ALLOWED_ENDPOINTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    throw new Error("ai_endpoint_invalid");
  }
  const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !isLocal) {
    throw new Error("ai_endpoint_not_https");
  }
  if (allow.length && !allow.includes(u.hostname)) {
    throw new Error("ai_endpoint_not_allowed");
  }
  return base;
}

/**
 * Gom tat ca key cua 1 provider thanh nhieu config. Ho tro:
 * - GEMINI_API_KEY="k1,k2,k3" (comma-separated)
 * - GEMINI_API_KEY_2, _3... (bien phu bo sung)
 * Moi key = 1 config -> caller thu lan luot, key quota/loi thi nhay key tiep.
 */
export function expandKeys(provider: AiProvider): string[] {
  const envName = `${provider.toUpperCase()}_API_KEY`;
  const primary = (process.env[envName] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const extras: string[] = [];
  for (let i = 2; i <= 9; i++) {
    const k = process.env[`${envName}_${i}`]?.trim();
    if (k) extras.push(k);
  }
  return [...new Set([...primary, ...extras])];
}

/**
 * Danh sách provider có key, theo thứ tự ưu tiên.
 * AI_PROVIDER ép 1 provider; không ép thì thử hết theo chuỗi
 * Gemini -> OpenAI -> Anthropic trước khi fallback Devin.
 */
export function getAiConfigs(): AiConfig[] {
  const forced = process.env.AI_PROVIDER as AiProvider | undefined;
  // Allowlist processor duoc phep nhan du lieu truong (DPIA): chi provider
  // nam trong AI_ALLOWED_PROVIDERS moi duoc goi, ke ca khi co key san.
  // Mac dinh mo het de khong pha cau hinh hien tai.
  const allowedSet = aiAllowedSet();
  const model = process.env.AI_MODEL;
  const providerModel: Record<AiProvider, string | undefined> = {
    gemini: process.env.GEMINI_MODEL,
    openai: process.env.OPENAI_MODEL,
    anthropic: process.env.ANTHROPIC_MODEL,
  };
  const pick = (
    provider: AiProvider,
    key?: string,
    modelOverride?: string,
  ): AiConfig | null =>
    key && (!allowedSet || allowedSet.has(provider))
      ? {
          provider,
          key,
          model:
            modelOverride ??
            model ??
            providerModel[provider] ??
            DEFAULT_MODELS[provider],
        }
      : null;

  const providers: AiProvider[] = forced
    ? [forced]
    : ["gemini", "openai", "anthropic"];

  return providers.flatMap((p) => {
    const keys = expandKeys(p);
    // Gemini: key khac nhau ho tro model khac nhau (key OAuth-style chi chay
    // duoc gemini-flash-latest). Thu theo (model x key): model uu tien qua
    // tat ca key truoc, roi moi xuong model du phong. GEMINI_MODELS cho phep
    // ghi de toan bo chuoi model.
    if (p === "gemini") {
      // flash-latest la alias universal - chay tren ca key OAuth-style lan
      // key chuan, nen uu tien truoc de tranh mat 1 vong 404 tren 2.5-flash.
      // GEMINI_MODEL/AI_MODEL van duoc thu dau tien neu user dat tuong minh.
      const envModel = model ?? providerModel.gemini;
      const models = (
        process.env.GEMINI_MODELS ??
        [
          ...(envModel ? [envModel] : []),
          "gemini-flash-latest",
          "gemini-2.5-flash",
          "gemini-2.5-flash-lite",
        ].join(",")
      )
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return [...new Set(models)].flatMap((m) =>
        keys.map((k) => pick(p, k, m)),
      );
    }
    return keys.map((key) => pick(p, key));
  }).filter((c): c is AiConfig => c !== null);
}

interface GenerateOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** File đính kèm (ảnh/PDF base64) - hiện chỉ Gemini hỗ trợ. */
  inline?: { data: string; mimeType: string };
  /** Timeout ms cho 1 lan goi provider (mac dinh 25s; doc dai dung 55s). */
  timeoutMs?: number;
  /**
   * So config dau tien chay SONG SONG (hedged race) - config nao xong truoc
   * thi lay, phan con lai thu tuan tu. Mac dinh 1 (tuan tu nhu cu). Dung cho
   * doc dai (generateDoc) de bo het do tre khi config dau chay cham/loi.
   * R16: racer thua bi abort (huy request that, khong doi quota vo ich).
   */
  race?: number;
  /**
   * Delay (ms) giua cac racer trong race - mac dinh 1200. Config 1 ban ngay;
   * config 2..N chi ban sau stagger neu config truoc chua xong, giam quota
   * dot tren duong happy-path.
   */
  staggerMs?: number;
  /**
   * Nguoi goi validate text tho (vd JSON parse duoc) truoc khi nhan thang
   * race - ngan "malformed output nhanh nhat thang" (r16 finding 17).
   */
  validate?: (text: string) => boolean;
  /**
   * Tong budget ms cho toan bo race + thu tuan tu (cac lan goi van co
   * timeoutMs rieng). Vuot deadline -> dung thu tiep.
   */
  maxTotalMs?: number;
  /**
   * CR-049 P3b: bo qua redactPiiText trung tam - CHI dung khi PII la
   * muc tieu cua chinh request (vd extract-records dan text ho so HS).
   * Moi route khac de mac dinh (redact).
   */
  skipPiiRedact?: boolean;
  /** Internal: signal huy request (race abort racers thua). */
  signal?: AbortSignal;
}

export type AiErrorKind = "no_key" | "quota" | "error";

export interface AiResult {
  text: string | null;
  error: AiErrorKind | null;
  provider: AiProvider | null;
}

/** Timeout + external cancel gop chung cho 1 fetch. */
function callSignal(opts: GenerateOptions): AbortSignal {
  const t = AbortSignal.timeout(opts.timeoutMs ?? 25000);
  return opts.signal ? AbortSignal.any([t, opts.signal]) : t;
}

function classifyStatus(status: number, body: string): AiErrorKind {
  if (status === 429) return "quota";
  const b = body.toLowerCase();
  if (
    b.includes("quota") ||
    b.includes("resource_exhausted") ||
    b.includes("rate limit")
  ) {
    return "quota";
  }
  // CR-042: 503 "high demand"/UNAVAILABLE cung la loi dung luong tam thoi -
  // cho di duong engine du phong thay vi roi thang vao ban khung rule-based.
  if (
    status === 503 ||
    status === 529 ||
    b.includes("unavailable") ||
    b.includes("overloaded") ||
    b.includes("high demand")
  ) {
    return "quota";
  }
  return "error";
}

async function callGemini(
  cfg: AiConfig,
  prompt: string,
  opts: GenerateOptions,
): Promise<{ text: string | null; error: AiErrorKind | null }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.key}`,
    {
      method: "POST",
      // R4: khong follow redirect - endpoint duoc phep co the 307 sang host
      // ngoai allowlist, mang theo key trong query/body.
      redirect: "error",
      signal: callSignal(opts),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(opts.system
          ? { system_instruction: { parts: [{ text: opts.system }] } }
          : {}),
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...(opts.inline
                ? [
                    {
                      inline_data: {
                        mime_type: opts.inline.mimeType,
                        data: opts.inline.data,
                      },
                    },
                  ]
                : []),
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 2048,
          temperature: opts.temperature ?? 0.7,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!res.ok) {
    return { text: null, error: classifyStatus(res.status, await res.text()) };
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  return { text: text || null, error: null };
}

async function callOpenAI(
  cfg: AiConfig,
  prompt: string,
  opts: GenerateOptions,
): Promise<{ text: string | null; error: AiErrorKind | null }> {
  // OPENAI_BASE_URL cho phep tro sang endpoint OpenAI-compatible
  // (vd OpenRouter https://openrouter.ai/api/v1) ma van giu slot provider.
  const base = openaiBaseUrl();
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    redirect: "error",
    signal: callSignal(opts),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    return { text: null, error: classifyStatus(res.status, await res.text()) };
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return {
    text: json.choices?.[0]?.message?.content?.trim() || null,
    error: null,
  };
}

async function callAnthropic(
  cfg: AiConfig,
  prompt: string,
  opts: GenerateOptions,
): Promise<{ text: string | null; error: AiErrorKind | null }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    redirect: "error",
    signal: callSignal(opts),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    return { text: null, error: classifyStatus(res.status, await res.text()) };
  }
  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text =
    json.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim() || null;
  return { text, error: null };
}

/**
 * Gọi LLM theo provider được detect từ env, trả về kết quả kèm loại lỗi.
 * error="quota" nghĩa là provider hết hạn mức - caller có thể fallback Devin.
 */
export async function generateTextDetailed(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<AiResult> {
  const configs = getAiConfigs();
  if (configs.length === 0) {
    return { text: null, error: "no_key", provider: null };
  }
  // CR-049 P3b: tang cuoi cung truoc provider - cat PII cau truc
  // (email/SDT/so dinh danh) khoi moi prompt, ke ca caller khong qua
  // respondWithAi. Ten rieng xu ly bang pseudonymizeNames o tren.
  const safePrompt = opts.skipPiiRedact ? prompt : redactPiiText(prompt);
  if (opts.system && !opts.skipPiiRedact) {
    opts = { ...opts, system: redactPiiText(opts.system) };
  }
  // Test hook: AI_FORCE_ERROR=quota để mô phỏng hết hạn mức khi test fallback
  if (process.env.AI_FORCE_ERROR === "quota") {
    return { text: null, error: "quota", provider: configs[0].provider };
  }

  // Thử lần lượt tất cả provider có key - provider đầu lỗi quota thì
  // provider sau vẫn được thử trước khi rơi vào fallback Devin.
  // R16: ghi nhan da co "quota" de tra loi deterministic - loi error
  // generic khong duoc che mat quota (caller can quota de fallback).
  let lastError: AiErrorKind = "error";
  let lastProvider: AiProvider | null = null;
  let sawQuota = false;

  const deadline = opts.maxTotalMs ? Date.now() + opts.maxTotalMs : null;
  const overDeadline = () => deadline !== null && Date.now() >= deadline;

  const callOne = async (
    cfg: AiConfig,
    signal?: AbortSignal,
  ): Promise<{ text: string | null; error: AiErrorKind | null }> => {
    try {
      const o: GenerateOptions = signal ? { ...opts, signal } : { ...opts };
      // R2: budget tong ap vao tung lan goi - timeout cua call khong vuot
      // phan con lai cua deadline (fix "deadline chi check truoc khi ban").
      if (deadline !== null) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return { text: null, error: "error" };
        o.timeoutMs = Math.min(o.timeoutMs ?? 25000, remaining);
      }
      // R4: endpoint co dinh cua provider cung phai nam trong allowlist -
      // truoc day chi slot openai bi kiem tra (gemini/anthropic bypass).
      if (!providerEndpointAllowed(cfg.provider)) {
        return { text: null, error: "error" };
      }
      return cfg.provider === "gemini"
        ? await callGemini(cfg, safePrompt, o)
        : cfg.provider === "openai"
          ? await callOpenAI(cfg, safePrompt, o)
          : await callAnthropic(cfg, safePrompt, o);
    } catch (e) {
      // CR-042: AbortSignal timeout khi doc sinh dai -> nhu "quota" (qua tai
      // tam thoi) de route day sang engine du phong thay vi ban khung.
      // R16: AbortError (race abort racer thua) cung la ket thuc som.
      const d = e instanceof DOMException ? e.name : "";
      return { text: null, error: d === "TimeoutError" || d === "AbortError" ? "quota" : "error" };
    }
  };

  const noteError = (cfg: AiConfig, err: AiErrorKind | null) => {
    if (err === "quota") sawQuota = true;
    lastError = err ?? "error";
    lastProvider = cfg.provider;
  };

  const acceptable = (text: string | null): text is string => {
    if (!text) return false;
    // R3: validator nem loi cung tinh la "reject" - neu de throw trong
    // race callback thi promise rejection khong ai bat va pending khong
    // giam -> race treo toi deadline.
    try {
      return opts.validate?.(text) ?? true;
    } catch {
      return false;
    }
  };

  let idx = 0;
  const raceN = Math.min(Math.max(opts.race ?? 1, 1), configs.length);
  if (raceN > 1) {
    // Hedged race: ban song song N config dau (staggered de tiet kiem quota)
    // - config nao tra text HOP LE (qua validate) truoc thi dung, racers con
    // lai bi abort de huy request that chu khong de chay tiep doi quota.
    const group = configs.slice(0, raceN);
    const stagger = Math.max(opts.staggerMs ?? 1200, 0);
    const winner = await new Promise<{
      cfg: AiConfig;
      r: { text: string | null; error: AiErrorKind | null };
    } | null>((resolve) => {
      let pending = group.length;
      let done = false;
      const ctrls = group.map(() => new AbortController());
      const finish = (v: { cfg: AiConfig; r: { text: string | null; error: AiErrorKind | null } } | null) => {
        if (done) return;
        done = true;
        ctrls.forEach((c) => c.abort());
        resolve(v);
      };
      const miss = () => {
        if (--pending === 0) finish(null);
      };
      group.forEach((cfg, i) => {
        const launch = () => {
          if (done) { miss(); return; } // stagger slot den khi da co ket qua
          if (overDeadline()) { miss(); return; }
          callOne(cfg, ctrls[i].signal).then((r) => {
            if (done) { miss(); return; }
            // Ket qua ve sau deadline khong duoc nhan (rejected-late).
            if (r.text && overDeadline()) { miss(); return; }
            if (acceptable(r.text)) {
              finish({ cfg, r });
            } else {
              noteError(cfg, r.text ? "error" : (r.error ?? "error"));
              miss();
            }
          });
        };
        if (i === 0 || stagger === 0) launch();
        else setTimeout(launch, i * stagger);
      });
      // Deadline tong: het gio van chua co winner -> bo race, khong treo.
      if (deadline) {
        const t = deadline - Date.now();
        if (t <= 0) finish(null);
        else setTimeout(() => finish(null), t);
      }
    });
    if (winner) return { ...winner.r, provider: winner.cfg.provider };
    idx = raceN;
  }

  for (; idx < configs.length; idx++) {
    if (overDeadline()) break;
    const cfg = configs[idx];
    const r = await callOne(cfg);
    if (r.text && overDeadline()) { noteError(cfg, "error"); break; }
    if (acceptable(r.text)) return { text: r.text, error: null, provider: cfg.provider };
    noteError(cfg, r.text ? "error" : (r.error ?? "error"));
  }
  // Precedence deterministic: co bat ky quota nao -> quota (fallback Devin).
  return {
    text: null,
    error: sawQuota ? "quota" : lastError,
    provider: lastProvider,
  };
}

/**
 * Gọi LLM theo provider được detect từ env. Trả về null khi chưa cấu hình key
 * hoặc khi API lỗi - caller nên fallback về logic rule-based.
 */
export async function generateText(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<string | null> {
  return (await generateTextDetailed(prompt, opts)).text;
}

export function aiProvider(): AiProvider | null {
  return getAiConfig()?.provider ?? null;
}
