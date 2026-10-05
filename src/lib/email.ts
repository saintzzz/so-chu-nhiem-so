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
  skipped?: boolean;
  error?: string;
}

function parseFrom(raw: string): { name: string; email: string } {
  const m = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim() || "VieSchool", email: m[2].trim() };
  return { name: "VieSchool", email: raw.trim() };
}

export async function sendEmail(input: {
  to: string[];
  subject: string;
  text: string;
}): Promise<EmailResult> {
  const provider =
    (process.env.EMAIL_PROVIDER ?? "").toLowerCase() ||
    (process.env.BREVO_API_KEY ? "brevo" : "resend");
  const key =
    provider === "brevo"
      ? process.env.BREVO_API_KEY
      : process.env.RESEND_API_KEY;
  const to = [...new Set(input.to.filter((a) => a && !DEMO_EMAIL_RE.test(a)))];
  if (!to.length) return { sent: 0, skipped: true };
  if (!key) return { sent: 0, skipped: true };

  const fromRaw =
    process.env.EMAIL_FROM ?? "Sổ Chủ Nhiệm Số <no-reply@aal.vn>";
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
  return { sent, error: sent ? undefined : lastError };
}
