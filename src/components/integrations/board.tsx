"use client";

import { useState, useTransition } from "react";
import { saveConnector, deleteConnector, retryEvent, testEvent } from "@/app/(app)/school/integrations/actions";
import { fmtDateTimeVN } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

export type ConnRow = {
  id: string;
  type: string;
  name: string;
  endpoint_url: string | null;
  auth_type: string;
  secret_name: string | null;
  enabled: boolean;
  created_at: string;
};
export type EvRow = {
  id: string;
  connector_id: string | null;
  event_type: string;
  status: string;
  attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

const inputCls =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";

const TYPE_LABEL: Record<string, string> = {
  webhook: "Webhook",
  custom: "Custom API",
  ministry_gd: "CSDL Bộ GD",
  vnpay: "Cổng thanh toán",
  zalo_oa: "Zalo OA",
  google_classroom: "Google Classroom",
  ms_teams: "Microsoft Teams",
};
const AUTH_LABEL: Record<string, string> = {
  none: "Không xác thực",
  api_key: "API key",
  bearer: "Bearer token",
  hmac_sha256: "HMAC SHA-256",
  oauth2_client: "OAuth2 client",
};
const EV_STATUS = {
  pending: { label: "Chờ gửi", tone: "warning" as const },
  processing: { label: "Đang gửi", tone: "info" as const },
  sent: { label: "Đã gửi", tone: "success" as const },
  failed: { label: "Lỗi - sẽ thử lại", tone: "error" as const },
  dead: { label: "Chết", tone: "error" as const },
};

export default function IntegrationsBoard({
  connectors,
  events,
  loadError,
}: {
  connectors: ConnRow[];
  events: EvRow[];
  loadError: string | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(loadError);
  const [ok, setOk] = useState<string | null>(null);
  const [type, setType] = useState("webhook");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [authType, setAuthType] = useState("none");
  const [secretName, setSecretName] = useState("");

  const needEndpoint = type === "webhook" || type === "custom";
  const needSecret = authType !== "none";
  const valid = name.trim() !== "" && (!needEndpoint || endpoint.trim() !== "") && (!needSecret || secretName.trim() !== "");

  function act(fn: () => Promise<string | null>, okMsg: string) {
    setErr(null);
    setOk(null);
    start(async () => {
      const res = await fn();
      if (res) setErr(res);
      else setOk(okMsg);
    });
  }

  const stats = {
    connectors: connectors.length,
    pending: events.filter((e) => e.status === "pending" || e.status === "processing" || e.status === "failed").length,
    sent: events.filter((e) => e.status === "sent").length,
    dead: events.filter((e) => e.status === "dead").length,
  };
  const connName = (id: string | null) => connectors.find((c) => c.id === id)?.name ?? "-";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Tích hợp &amp; kết nối</h1>
        <p className="text-sm text-muted-foreground">
          Đấu nối API ngoài (CSDL Bộ, webhook, thanh toán...) qua hàng đợi outbox - retry tự động,
          secret lưu dạng tên biến môi trường.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Connectors", stats.connectors],
          ["Đang xử lý", stats.pending],
          ["Đã gửi", stats.sent],
          ["Dead-letter", stats.dead],
        ].map(([l, n]) => (
          <div key={l} className="rounded-xl border border-border bg-card p-3">
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-xs text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-medium">Thêm connector</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <input className={inputCls} placeholder="Tên connector *" value={name}
            onChange={(e) => setName(e.target.value)} />
          <input className={inputCls}
            placeholder={needEndpoint ? "Endpoint URL *" : "Endpoint URL (nếu có)"}
            value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
          <select className={inputCls} value={authType} onChange={(e) => setAuthType(e.target.value)}>
            {Object.entries(AUTH_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          {needSecret && (
            <input className={inputCls}
              placeholder="Tên biến env chứa secret * (vd VNPAY_SECRET)"
              value={secretName} onChange={(e) => setSecretName(e.target.value)} />
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" disabled={pending || !valid}
            onClick={() =>
              act(() => saveConnector({ type, name, endpoint, authType, secretName }), "Đã lưu connector.")
            }
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {pending ? "Đang lưu..." : "Lưu connector"}
          </button>
          {err && <span className="text-sm text-destructive">{err}</span>}
          {ok && <span className="text-sm text-green-600">{ok}</span>}
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3">Connector</th>
              <th className="p-3">Loại</th>
              <th className="p-3">Endpoint</th>
              <th className="p-3">Xác thực</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {connectors.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">
                Chưa có connector nào.
              </td></tr>
            )}
            {connectors.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{TYPE_LABEL[c.type] ?? c.type}</td>
                <td className="max-w-[16rem] truncate p-3">{c.endpoint_url ?? "-"}</td>
                <td className="p-3">{AUTH_LABEL[c.auth_type] ?? c.auth_type}{c.secret_name ? ` (${c.secret_name})` : ""}</td>
                <td className="p-3">
                  <StatusBadge label={c.enabled ? "Bật" : "Tắt"} tone={c.enabled ? "success" : "muted"} />
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button type="button" disabled={pending}
                      onClick={() => act(() => testEvent(c.id), "Đã xếp event test.")}
                      className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">
                      Test
                    </button>
                    <button type="button" disabled={pending}
                      onClick={() => act(() => saveConnector({ id: c.id, type: c.type, name: c.name, endpoint: c.endpoint_url ?? "", authType: c.auth_type, secretName: c.secret_name ?? "", enabled: !c.enabled }), c.enabled ? "Đã tắt." : "Đã bật.")}
                      className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">
                      {c.enabled ? "Tắt" : "Bật"}
                    </button>
                    <button type="button" disabled={pending}
                      onClick={() => { if (window.confirm(`Xóa connector "${c.name}"?`)) act(() => deleteConnector(c.id), "Đã xóa."); }}
                      className="rounded-lg px-2 py-1 text-xs text-destructive hover:bg-accent">
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Hàng đợi outbox</h2>
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3">Event</th>
                <th className="p-3">Connector</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Thử</th>
                <th className="p-3">Lỗi gần nhất</th>
                <th className="p-3">Tạo lúc</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Hàng đợi trống.
                </td></tr>
              )}
              {events.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{e.event_type}</td>
                  <td className="p-3">{connName(e.connector_id)}</td>
                  <td className="p-3">
                    <StatusBadge
                      label={(EV_STATUS[e.status as keyof typeof EV_STATUS] ?? EV_STATUS.pending).label}
                      tone={(EV_STATUS[e.status as keyof typeof EV_STATUS] ?? EV_STATUS.pending).tone}
                    />
                  </td>
                  <td className="p-3">{e.attempts}</td>
                  <td className="max-w-[14rem] truncate p-3 text-muted-foreground">
                    {e.last_error ?? ""}
                  </td>
                  <td className="p-3">{fmtDateTimeVN(e.created_at)}</td>
                  <td className="p-3">
                    {(e.status === "failed" || e.status === "dead") && (
                      <button type="button" disabled={pending}
                        onClick={() => act(() => retryEvent(e.id), "Đã đưa về hàng chờ.")}
                        className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">
                        Thử lại
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
