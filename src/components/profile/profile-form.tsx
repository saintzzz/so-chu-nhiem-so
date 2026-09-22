"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateMyProfile } from "@/app/(app)/school/actions";

export function ProfileForm({ phone }: { phone: string }) {
  const [value, setValue] = useState(phone);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      setErr(null);
      setMsg(null);
      const r = await updateMyProfile({ phone: value });
      if (r.error) setErr(r.error);
      else setMsg("Đã lưu thông tin liên hệ.");
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <h2 className="mb-3 text-sm font-semibold">Thông tin liên hệ</h2>
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Số điện thoại</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="VD: 0912 345 678"
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring"
        />
      </label>
      <Button
        onClick={save}
        disabled={pending}
        className="mt-3"
        size="sm"
      >
        Lưu thay đổi
      </Button>
      {err && <p className="mt-2 text-sm text-error">{err}</p>}
      {msg && <p className="mt-2 text-sm text-success">{msg}</p>}
      <p className="mt-4 text-xs text-muted-foreground">
        Họ tên, email và vai trò do Ban Giám Hiệu quản lý - liên hệ BGH nếu
        cần thay đổi.
      </p>
    </div>
  );
}
