// Email delivery via HTTP API (no SDK dependency).
// Provider is env-driven so all VieSchool products share one key:
//   EMAIL_PROVIDER   - 'brevo' | 'resend' (default: brevo when
//                      BREVO_API_KEY is set, else resend)
//   BREVO_API_KEY    - Brevo transactional API key (primary)
//   RESEND_API_KEY   - Resend fallback
//   EMAIL_FROM       - 'Name <addr@domain>' or bare addr
// If no key is set, sendEmail no-ops and reports { skipped: true }
// so callers can surface "chưa cấu hình email" instead of fake success.

const RESEND_URL = "https://api.resend.com/emails";
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

// Demo/seeded parent accounts use @demo.scn addresses that cannot receive
// mail. Sending to them burns the daily quota and produces bounce
// events that hurt sender reputation - block them centrally for every
// caller (digest cron, announcements).
const DEMO_EMAIL_RE = /@demo\.scn$/i;

export interface EmailResult {
  sent: number;
  // So dia chi da thu gui nhung that bai (to.length - sent). error chi la
  // tin hieu that-bai-toan-bo (sent===0) - partial failure doc qua `failed`.
  failed: number;
  skipped?: boolean;
  error?: string;
}

function parseFrom(raw: string): { name: string; email: string } {
  const m = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim() || "VieSchool", email: m[2].trim() };
  return { name: "VieSchool", email: raw.trim() };
}

interface EmailConfig {
  provider: string;
  key: string | undefined;
  from: string;
}

let cachedConfig: EmailConfig | null = null;

// Single source of truth: email config lives in Supabase Vault so every
// VieSchool product on this project reads the same provider/key/from.
// An explicit EMAIL_PROVIDER env forces the env path (local dev override);
// otherwise vault wins so production always follows the shared config -
// no Vercel env changes needed to rotate providers.
async function getEmailConfig(): Promise<EmailConfig> {
  const envProvider = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
  if (envProvider) {
    return {
      provider: envProvider,
      key:
        envProvider === "resend"
          ? process.env.RESEND_API_KEY
          : process.env.BREVO_API_KEY,
      from: process.env.EMAIL_FROM ?? "VieSchool <no-reply@vieschool.com>",
    };
  }
  if (!cachedConfig) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { data } = await createAdminClient().rpc("get_email_config");
      const cfg = data as
        | { provider?: string; api_key?: string; from?: string }
        | null;
      cachedConfig = {
        provider: (cfg?.provider ?? "brevo").toLowerCase(),
        key: cfg?.api_key ?? undefined,
        from: cfg?.from ?? "VieSchool <no-reply@vieschool.com>",
      };
    } catch {
      cachedConfig = {
        provider: "brevo",
        key: undefined,
        from: "VieSchool <no-reply@vieschool.com>",
      };
    }
  }
  if (cachedConfig.key) return cachedConfig;
  // Vault unreachable/unconfigured - last-resort env keys.
  const key = process.env.BREVO_API_KEY ?? process.env.RESEND_API_KEY;
  return {
    provider: process.env.BREVO_API_KEY ? "brevo" : "resend",
    key,
    from: process.env.EMAIL_FROM ?? cachedConfig.from,
  };
}

export async function sendEmail(input: {
  to: string[];
  subject: string;
  text: string;
}): Promise<EmailResult> {
  const { provider, key, from: fromRaw } = await getEmailConfig();
  const to = [...new Set(input.to.filter((a) => a && !DEMO_EMAIL_RE.test(a)))];
  if (!to.length) return { sent: 0, failed: 0, skipped: true };
  if (!key) return { sent: 0, failed: 0, skipped: true };

  const from = parseFrom(fromRaw);
  let sent = 0;
  let lastError: string | undefined;
  // Send individually so one bad address doesn't block others.
  for (const addr of to) {
    try {
      const res = await fetch(provider === "brevo" ? BREVO_URL : RESEND_URL, {
        method: "POST",
        headers:
          provider === "brevo"
            ? { "api-key": key, "Content-Type": "application/json" }
            : {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
              },
        body: JSON.stringify(
          provider === "brevo"
            ? {
                sender: { name: from.name, email: from.email },
                to: [{ email: addr }],
                subject: input.subject,
                textContent: input.text,
              }
            : {
                from: fromRaw,
                to: addr,
                subject: input.subject,
                text: input.text,
              },
        ),
      });
      if (res.ok) sent++;
      else
        lastError = `${provider} ${res.status}: ${(await res.text()).slice(0, 200)}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { sent, failed: to.length - sent, error: sent ? undefined : lastError };
}
