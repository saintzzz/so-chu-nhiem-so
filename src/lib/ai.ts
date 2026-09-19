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
    return pick(forced, key);
  }
  return (
    pick("gemini", process.env.GEMINI_API_KEY) ??
    pick("openai", process.env.OPENAI_API_KEY) ??
    pick("anthropic", process.env.ANTHROPIC_API_KEY)
  );
}

interface GenerateOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

async function callGemini(
  cfg: AiConfig,
  prompt: string,
  opts: GenerateOptions,
): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.key}`,
    {
      method: "POST",
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
  if (!res.ok) return null;
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  return text || null;
}

async function callOpenAI(
  cfg: AiConfig,
  prompt: string,
  opts: GenerateOptions,
): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
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
  if (!res.ok) return null;
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content?.trim() || null;
}

async function callAnthropic(
  cfg: AiConfig,
  prompt: string,
  opts: GenerateOptions,
): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
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
  if (!res.ok) return null;
  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  return (
    json.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim() || null
  );
}

/**
 * Gọi LLM theo provider được detect từ env. Trả về null khi chưa cấu hình key
 * hoặc khi API lỗi - caller nên fallback về logic rule-based.
 */
export async function generateText(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<string | null> {
  const cfg = getAiConfig();
  if (!cfg) return null;
  try {
    if (cfg.provider === "gemini") return await callGemini(cfg, prompt, opts);
    if (cfg.provider === "openai") return await callOpenAI(cfg, prompt, opts);
    return await callAnthropic(cfg, prompt, opts);
  } catch {
    return null;
  }
}

export function aiProviderLabel(): string | null {
  const cfg = getAiConfig();
  return cfg ? `${cfg.provider}/${cfg.model}` : null;
}
