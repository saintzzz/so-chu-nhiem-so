// Email delivery via Resend REST API (no SDK dependency).
// Env: RESEND_API_KEY (required), EMAIL_FROM (optional, defaults to Resend's
// shared test domain which only delivers to the account owner's address).
// If RESEND_API_KEY is unset, sendEmail no-ops and reports { skipped: true }
// so callers can surface "chưa cấu hình email" instead of fake success.

const RESEND_URL = "https://api.resend.com/emails";

export interface EmailResult {
  sent: number;
  skipped?: boolean;
  error?: string;
}

export async function sendEmail(input: {
  to: string[];
  subject: string;
  text: string;
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const to = [...new Set(input.to.filter(Boolean))];
  if (!to.length) return { sent: 0 };
  if (!key) return { sent: 0, skipped: true };

  const from =
    process.env.EMAIL_FROM ?? "Sổ Chủ Nhiệm Số <onboarding@resend.dev>";
  let sent = 0;
  let lastError: string | undefined;
  // Resend batch: send individually so one bad address doesn't block others.
  for (const addr of to) {
    try {
      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: addr,
          subject: input.subject,
          text: input.text,
        }),
      });
      if (res.ok) sent++;
      else lastError = `Resend ${res.status}: ${(await res.text()).slice(0, 200)}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { sent, error: sent ? undefined : lastError };
}
