// CR-069: provider-neutrale Kanal-Adapter. Jeder Adapter liefert ein
// SendResult; "no_config" markiert credential-freie Umgebungen, damit
// die Outbox den Job als blocked_no_config ablegt statt zu faken.
export interface SendInput {
  channel: "zalo" | "sms" | "email";
  recipientRef: string; // phone (E.164 bevorzugt) oder email
  templateName: string;
  providerTemplateId?: string | null; // ZNS: approved template_id
  payload: Record<string, unknown>;
}
export interface SendResult {
  ok?: boolean;
  providerMsgId?: string;
  /** temp = retry lohnt (429/5xx/timeout), perm = nicht wiederholen */
  failKind?: "temp" | "perm" | "no_config";
  errorLabel?: string;
}

// --- Zalo ZNS -------------------------------------------------------
// Env: ZALO_OA_ACCESS_TOKEN (oder per-school config spaeter via
// school_integrations). ZNS sendet NUR approved templates mit
// template_id - body ist Parameter-Mapping, kein Freitext.
export async function sendZalo(input: SendInput): Promise<SendResult> {
  const token = process.env.ZALO_OA_ACCESS_TOKEN;
  if (!token) return { failKind: "no_config", errorLabel: "no zalo token" };
  if (!input.providerTemplateId)
    return { failKind: "perm", errorLabel: "template_id missing" };
  try {
    const res = await fetch("https://business.openapi.zalo.me/message/template", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: token,
      },
      body: JSON.stringify({
        phone: input.recipientRef.replace(/\D/g, ""),
        template_id: input.providerTemplateId,
        template_data: input.payload,
        tracking_id: `scn-${Date.now()}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: number;
      data?: { msg_id?: string };
    };
    if (res.ok && json.error === 0)
      return { ok: true, providerMsgId: json.data?.msg_id };
    // Zalo error codes: -216 quota, -118 invalid token/scope...
    const perm = [-104, -118, -213].includes(json.error ?? 0);
    return {
      failKind: perm ? "perm" : "temp",
      errorLabel: `zalo err ${json.error ?? res.status}`,
    };
  } catch {
    return { failKind: "temp", errorLabel: "network" };
  }
}

// --- SMS -------------------------------------------------------------
// Kein Vendor verdrahtet - Adapter existiert, damit kanalneutrale
// Logik/Tests laufen; ohne SMS_* env immer no_config.
export async function sendSms(input: SendInput): Promise<SendResult> {
  const endpoint = process.env.SMS_PROVIDER_URL;
  const key = process.env.SMS_PROVIDER_KEY;
  if (!endpoint || !key)
    return { failKind: "no_config", errorLabel: "no sms provider" };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        to: input.recipientRef,
        text: String(input.payload.text ?? ""),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    return { failKind: res.status >= 500 ? "temp" : "perm", errorLabel: `sms ${res.status}` };
  } catch {
    return { failKind: "temp", errorLabel: "network" };
  }
}

export function adapterFor(channel: SendInput["channel"]) {
  if (channel === "zalo") return sendZalo;
  if (channel === "sms") return sendSms;
  return null; // email laeuft ueber src/lib/email.ts, nicht hier
}
