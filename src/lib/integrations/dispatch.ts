// CR-072: dispatch outbox event theo connector type.
// secret_name = TEN bien env chua secret; gia tri secret khong bao gio vao DB/log.
import { createHmac } from "node:crypto";

export type Connector = {
  id: string;
  type: string;
  name: string;
  endpoint_url: string | null;
  auth_type: string;
  secret_name: string | null;
  config: Record<string, unknown>;
};
export type OutboxEvent = {
  id: string;
  school_id: string;
  connector_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key: string | null;
};

function envSecret(name: string | null): string | null {
  if (!name) return null;
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : null;
}

// SSRF guard: chi https cong khai; chan localhost/private/link-local/metadata.
// Kiem tra lai khi dispatch du endpoint da duoc validate luc luu connector.
function safeEndpoint(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (h.startsWith("[")) return false; // ipv6 literal
    if (/^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return false; // cgnat
    return true;
  } catch {
    return false;
  }
}

async function postJson(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "fetch_error" };
  }
}

export async function dispatchEvent(
  conn: Connector,
  ev: OutboxEvent,
): Promise<{ ok: boolean; error?: string }> {
  const body = JSON.stringify({
    event: ev.event_type,
    school_id: ev.school_id,
    idempotency_key: ev.idempotency_key,
    payload: ev.payload,
    sent_at: new Date().toISOString(),
  });
  const headers: Record<string, string> = {
    "x-scn-event": ev.event_type,
    "x-scn-school": ev.school_id,
  };

  switch (conn.type) {
    case "webhook":
    case "custom": {
      if (!conn.endpoint_url) return { ok: false, error: "endpoint_required" };
      if (!safeEndpoint(conn.endpoint_url)) return { ok: false, error: "invalid_endpoint" };
      if (conn.auth_type === "hmac_sha256") {
        const secret = envSecret(conn.secret_name);
        if (!secret) return { ok: false, error: "secret_env_missing" };
        headers["x-scn-signature"] =
          "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
      } else if (conn.auth_type === "api_key") {
        const secret = envSecret(conn.secret_name);
        if (!secret) return { ok: false, error: "secret_env_missing" };
        const h = typeof conn.config.header_name === "string" ? conn.config.header_name : "x-api-key";
        headers[h] = secret;
      } else if (conn.auth_type === "bearer") {
        const secret = envSecret(conn.secret_name);
        if (!secret) return { ok: false, error: "secret_env_missing" };
        headers.authorization = `Bearer ${secret}`;
      }
      return postJson(conn.endpoint_url, body, headers);
    }
    case "ministry_gd": {
      // Skeleton theo QD 3016: XML envelope + token/SHA256 - can credentials
      // + API spec chinh thuc tu So/Bo (BACKLOG-CREDENTIALS #2).
      const endpoint = conn.endpoint_url ?? (conn.config.endpoint as string | undefined);
      const secret = envSecret(conn.secret_name);
      if (!endpoint || !secret) {
        return { ok: false, error: "credentials_required" };
      }
      if (!safeEndpoint(endpoint)) return { ok: false, error: "invalid_endpoint" };
      const envelope = `<Envelope><Header><SchoolCode>${conn.config.school_code ?? ""}</SchoolCode><Token>${createHmac("sha256", secret).update(ev.idempotency_key ?? ev.id).digest("hex")}</Token></Header><Body>${body.replace(/</g, "&lt;")}</Body></Envelope>`;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/xml" },
          body: envelope,
          signal: AbortSignal.timeout(15_000),
        });
        return res.ok ? { ok: true } : { ok: false, error: `http_${res.status}` };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "fetch_error" };
      }
    }
    case "vnpay":
    case "zalo_oa":
    case "google_classroom":
    case "ms_teams":
      return { ok: false, error: "connector_not_implemented" };
    default:
      return { ok: false, error: "unknown_connector_type" };
  }
}
