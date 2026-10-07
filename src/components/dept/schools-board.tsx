"use client";

import { useState, useTransition } from "react";
import { Building2, PlusCircle } from "lucide-react";
import { createSchool } from "@/app/(app)/dept/actions";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import type { School } from "@/types";

const LEVEL_LABELS: Record<string, string> = {
  th: "Tiểu học",
  thcs: "THCS",
  thpt: "THPT",
};

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export function SchoolsBoard({
  schools,
  userCounts,
}: {
  schools: Pick<School, "id" | "name" | "code" | "level">[];
  userCounts: Record<string, number>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [level, setLevel] = useState("th");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [seedDemo, setSeedDemo] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim());
  const valid =
    name.trim() && code.trim() && adminName.trim() &&
    emailOk && adminPassword.length >= 8;

  function submit() {
    setMessage(null);
    start(async () => {
      const r = await createSchool({
        name, code, level, adminEmail: adminEmail.trim(), adminPassword, adminName, seedDemo,
      });
      setMessage(r.error ?? `Đã tạo trường "${name.trim()}" và tài khoản admin ${adminEmail.trim()}.`);
      if (!r.error) {
        setName(""); setCode(""); setAdminName(""); setAdminEmail(""); setAdminPassword("");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <PlusCircle className="h-4 w-4" /> Tạo trường mới
        </h3>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Cấp học:</span>
          {Object.entries(LEVEL_LABELS).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setLevel(v)}
              className={
                level === v
                  ? "rounded-full border border-primary bg-primary px-3 py-1 text-sm text-primary-foreground"
                  : "rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground hover:bg-muted"
              }
            >
              {l}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Tên trường *" className={inputCls} />
          <input value={code} onChange={(e) => setCode(e.target.value)}
            placeholder="Mã trường (vd: TH-ABC) *" className={inputCls} />
          <input value={adminName} onChange={(e) => setAdminName(e.target.value)}
            placeholder="Họ tên admin trường (BGH) *" className={inputCls} />
          <div>
            <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
              type="email" placeholder="Email đăng nhập admin *" className={inputCls} />
            {adminEmail && !emailOk && (
              <p className="mt-1 text-xs text-error">Email admin không hợp lệ.</p>
            )}
          </div>
          <div>
            <input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)}
              type="password" placeholder="Mật khẩu (tối thiểu 8 ký tự) *" className={inputCls} />
            {adminPassword && adminPassword.length < 8 && (
              <p className="mt-1 text-xs text-error">Mật khẩu tối thiểu 8 ký tự.</p>
            )}
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={seedDemo}
            onChange={(e) => setSeedDemo(e.target.checked)} />
          Seed dữ liệu mẫu (lớp + học sinh tối thiểu) - bật cho trường demo
        </label>
        {message && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm">{message}</p>
        )}
        <div className="mt-3">
          <Button size="sm" onClick={submit} disabled={pending || !valid}>
            <PlusCircle /> Tạo trường
          </Button>
        </div>
      </div>

      <DataTable
        columns={["Trường", "Mã", "Cấp", "Tài khoản"]}
        footer={<span>{schools.length} trường</span>}
      >
        {schools.map((s) => (
          <tr key={s.id}>
            <td className="font-medium">
              <span className="inline-flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {s.name}
              </span>
            </td>
            <td className="text-muted-foreground">{s.code}</td>
            <td>{LEVEL_LABELS[s.level ?? ""] ?? s.level ?? "-"}</td>
            <td>{userCounts[s.id] ?? 0}</td>
          </tr>
        ))}
        {schools.length === 0 && (
          <tr>
            <td colSpan={4} className="py-8 text-center text-muted-foreground">
              Chưa có trường nào.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
