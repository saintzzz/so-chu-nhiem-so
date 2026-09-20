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
 * Danh sách provider có key, theo thứ tự ưu tiên.
 * AI_PROVIDER ép 1 provider; không ép thì thử hết theo chuỗi
 * Gemini -> OpenAI -> Anthropic trước khi fallback Devin.
 */
export function getAiConfigs(): AiConfig[] {
  const forced = process.env.AI_PROVIDER as AiProvider | undefined;
  const model = process.env.AI_MODEL;
  const pick = (provider: AiProvider, key?: string): AiConfig | null =>
    key ? { provider, key, model: model ?? DEFAULT_MODELS[provider] } : null;

  if (forced) {
    const key =
      forced === "gemini"
        ? process.env.GEMINI_API_KEY
        : forced === "openai"
          ? process.env.OPENAI_API_KEY
          : process.env.ANTHROPIC_API_KEY;
    const cfg = pick(forced, key);
    return cfg ? [cfg] : [];
  }
  return [
    pick("gemini", process.env.GEMINI_API_KEY),
    pick("openai", process.env.OPENAI_API_KEY),
    pick("anthropic", process.env.ANTHROPIC_API_KEY),
  ].filter((c): c is AiConfig => c !== null);
}

interface GenerateOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export type AiErrorKind = "no_key" | "quota" | "error";

export interface AiResult {
  text: string | null;
  error: AiErrorKind | null;
  provider: AiProvider | null;
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
      signal: AbortSignal.timeout(25000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(opts.system
          ? { system_instruction: { parts: [{ text: opts.system }] } }
          : {}),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
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
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(25000),
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
    signal: AbortSignal.timeout(25000),
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
  // Test hook: AI_FORCE_ERROR=quota để mô phỏng hết hạn mức khi test fallback
  if (process.env.AI_FORCE_ERROR === "quota") {
    return { text: null, error: "quota", provider: configs[0].provider };
  }

  // Thử lần lượt tất cả provider có key - provider đầu lỗi quota thì
  // provider sau vẫn được thử trước khi rơi vào fallback Devin.
  let lastError: AiErrorKind = "error";
  let lastProvider: AiProvider | null = null;
  for (const cfg of configs) {
    try {
      const r =
        cfg.provider === "gemini"
          ? await callGemini(cfg, prompt, opts)
          : cfg.provider === "openai"
            ? await callOpenAI(cfg, prompt, opts)
            : await callAnthropic(cfg, prompt, opts);
      if (r.text) return { ...r, provider: cfg.provider };
      lastError = r.error ?? "error";
      lastProvider = cfg.provider;
      if (r.error === "error") continue; // lỗi mạng/500 - thử provider khác
      if (r.error === "quota") continue; // hết quota - thử provider khác
      break;
    } catch {
      lastError = "error";
      lastProvider = cfg.provider;
      continue;
    }
  }
  return { text: null, error: lastError, provider: lastProvider };
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
