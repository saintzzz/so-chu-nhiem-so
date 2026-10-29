"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  saveChannelIntegration,
  saveCommTemplate,
  testCommChannel,
} from "@/app/(app)/school/channels/actions";

interface Tpl {
  id: string;
  channel: string;
  name: string;
  provider_template_id: string | null;
  body: string;
  enabled: boolean;
}

const CHANNEL_LABEL: Record<string, string> = {
  zalo: "Zalo ZNS",
  sms: "SMS",
  email: "Email",
};

export function ChannelsBoard({
  zaloEnabled,
  smsEnabled,
  templates,
  outboxStats,
  consentStats,
}: {
  zaloEnabled: boolean;
  smsEnabled: boolean;
  templates: Tpl[];
  outboxStats: Record<string, number>;
  consentStats: Record<string, number>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showTpl, setShowTpl] = useState(false);
  const [tplChannel, setTplChannel] = useState<"zalo" | "sms">("zalo");
  const [tplName, setTplName] = useState("");
  const [tplProvId, setTplProvId] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testChannel, setTestChannel] = useState<"zalo" | "sms">("zalo");

  function toggle(provider: "zalo_oa" | "sms", enabled: boolean) {
    setErr(null);
    start(async () => {
      const r = await saveChannelIntegration({ provider, enabled });
      if (r?.error) setErr(r.error);
    });
  }
  function saveTpl(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await saveCommTemplate({
        channel: tplChannel,
        name: tplName,
        providerTemplateId: tplProvId,
        body: tplBody,
      });
      if (r?.error) setErr(r.error);
      else { setShowTpl(false); setTplName(""); setTplProvId(""); setTplBody(""); }
    });
  }
  function test() {
    setErr(null); setMsg(null);
    start(async () => {
      const r = await testCommChannel(testChannel, testPhone);
      if (r?.error) setErr(r.error);
      else setMsg(r?.msg ?? "ok");
    });
  }

  const statLine = (ch: string) =>
    ["sent", "queued", "failed", "blocked_no_config", "dead"]
      .map((s) => `${s}: ${outboxStats[`${ch}:${s}`] ?? 0}`)
      .join(" · ");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="font-medium">Kênh bổ sung (ngoài email mặc định)</p>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={zaloEnabled}
              onChange={(e) => toggle("zalo_oa", e.target.checked)} disabled={pending} />
            Zalo OA/ZNS <span className="text-muted-foreground">({consentStats.zalo ?? 0} PH đồng ý)</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={smsEnabled}
              onChange={(e) => toggle("sms", e.target.checked)} disabled={pending} />
            SMS <span className="text-muted-foreground">({consentStats.sms ?? 0} PH đồng ý)</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Bật kênh chỉ kích hoạt enqueue - gửi thật cần credentials môi trường
          (ZALO_OA_ACCESS_TOKEN / SMS_PROVIDER_*) + template ZNS đã duyệt + consent PH.
          Môi trường không credentials: các job vào trạng thái
          <code className="mx-1 rounded bg-muted px-1">blocked_no_config</code>.
        </p>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {msg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium">Templates ({templates.length})</p>
          <Button size="sm" variant="outline" onClick={() => setShowTpl(!showTpl)}>
            {showTpl ? "Đóng" : "+ Template mới"}
          </Button>
        </div>
        {showTpl && (
          <form onSubmit={saveTpl} className="mb-4 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex flex-wrap gap-3">
              <select value={tplChannel} onChange={(e) => setTplChannel(e.target.value as "zalo" | "sms")}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="zalo">Zalo ZNS</option>
                <option value="sms">SMS</option>
              </select>
              <input value={tplName} onChange={(e) => setTplName(e.target.value)}
                placeholder="Tên (announcement, absence...)" required
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-56" />
              {tplChannel === "zalo" && (
                <input value={tplProvId} onChange={(e) => setTplProvId(e.target.value)}
                  placeholder="template_id ZNS đã duyệt *" required
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-56" />
              )}
            </div>
            <input value={tplBody} onChange={(e) => setTplBody(e.target.value)}
              placeholder="Nội dung / mô tả tham số" required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <Button type="submit" size="sm" disabled={pending}>Lưu template</Button>
          </form>
        )}
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có template - Zalo ZNS bắt buộc template đã phê duyệt từ Zalo.</p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{CHANNEL_LABEL[t.channel] ?? t.channel}</span>
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground font-mono text-xs">{t.provider_template_id ?? "-"}</span>
                <span className={`ml-auto text-xs ${t.enabled ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {t.enabled ? "aktiv" : "tắt"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="font-medium">Hàng đợi gửi (comm_outbox)</p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Zalo — {statLine("zalo")}</p>
          <p>SMS — {statLine("sms")}</p>
          <p>Email — {statLine("email")}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="font-medium">Gửi thử (trực tiếp qua adapter, không qua outbox)</p>
        <div className="flex flex-wrap gap-3">
          <select value={testChannel} onChange={(e) => setTestChannel(e.target.value as "zalo" | "sms")}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="zalo">Zalo ZNS</option>
            <option value="sms">SMS</option>
          </select>
          <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)}
            placeholder="Số điện thoại test" inputMode="tel"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-56" />
          <Button size="sm" variant="outline" onClick={test} disabled={pending || !testPhone.trim()}>
            Gửi thử
          </Button>
        </div>
      </div>
    </div>
  );
}
