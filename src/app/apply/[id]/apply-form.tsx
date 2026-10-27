"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { getTurnstileToken } from "@/lib/turnstile";

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export function ApplyForm({
  campaignId,
  level,
}: {
  campaignId: string;
  level: string;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current || busy) return;
    setErr(null);
    setBusy(true);
    const captcha = await getTurnstileToken();
    const fd = new FormData(formRef.current);
    const res = await fetch("/api/admissions/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: campaignId,
        full_name: fd.get("full_name"),
        dob: fd.get("dob") || null,
        gender: fd.get("gender") || null,
        id_number: fd.get("id_number") || null,
        address: fd.get("address") || null,
        source_school: fd.get("source_school") || null,
        parent_name: fd.get("parent_name") || null,
        parent_phone: fd.get("parent_phone") || null,
        priority: fd.get("priority") || 1,
        website: fd.get("website"), // honeypot
        captcha_token: captcha,
      }),
    });
    setBusy(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(json.message ?? "Nộp hồ sơ không thành công. Vui lòng thử lại.");
      return;
    }
    setDone(json.tracking_code);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-lg font-semibold text-success">
          Nộp hồ sơ thành công
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Mã tra cứu hồ sơ của bạn:
        </p>
        <p className="mt-2 select-all rounded-lg bg-muted px-4 py-3 font-mono text-xl font-bold tracking-widest">
          {done}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Lưu lại mã này để tra cứu trạng thái tại{" "}
          <Link href="/apply/tra-cuu" className="underline">
            trang tra cứu
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="font-semibold">Đăng ký hồ sơ trực tuyến</h2>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Họ và tên học sinh <span className="text-error">*</span>
        </label>
        <input name="full_name" required maxLength={120} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Ngày sinh</label>
          <input name="dob" type="date" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Giới tính</label>
          <select name="gender" className={inputCls}>
            <option value="">-</option>
            <option value="nam">Nam</option>
            <option value="nu">Nữ</option>
            <option value="khac">Khác</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Số CCCD / mã định danh
        </label>
        <input name="id_number" maxLength={20} className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Địa chỉ</label>
        <input name="address" maxLength={300} className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          {level === "khoi_10" ? "Trường THCS đang học" : "Trường tiểu học"}
        </label>
        <input name="source_school" maxLength={200} className={inputCls} />
      </div>
      {level === "khoi_10" && (
        <div>
          <label className="mb-1 block text-sm font-medium">
            Nguyện vọng vào trường này
          </label>
          <select name="priority" className={inputCls}>
            <option value="1">Nguyện vọng 1</option>
            <option value="2">Nguyện vọng 2</option>
            <option value="3">Nguyện vọng 3</option>
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Họ tên phụ huynh
          </label>
          <input name="parent_name" maxLength={120} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Số điện thoại liên hệ
          </label>
          <input
            name="parent_phone"
            maxLength={20}
            inputMode="tel"
            className={inputCls}
          />
        </div>
      </div>
      {/* honeypot - bot dien, nguoi that khong thay */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      {err && (
        <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error">
          {err}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-lg bg-brand text-sm font-semibold text-brand-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Đang gửi..." : "Nộp hồ sơ"}
      </button>
    </form>
  );
}
