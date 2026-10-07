"use client";

// CR-035: editor + viewer KHBD co cau truc (CV 5512/CTGDPT 2018).
// Editor: cac section theo bieu mau - Muc tieu (KT/NL/PC), Thiet bi
// (GV/HS), Tien trinh 4 hoat dong, Dieu chinh. Viewer: render theo
// section thay vi 1 khoi text.

import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import {
  KHBD_ACTIVITIES,
  KHBD_ACTIVITY_FIELDS,
  type KhbdActivity,
  type KhbdContent,
} from "@/lib/khbd";

const fieldCls =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring";

function Edit({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <AutoGrowTextarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
    </label>
  );
}

export function KhbdEditor({
  value,
  onChange,
}: {
  value: KhbdContent;
  onChange: (k: KhbdContent) => void;
}) {
  const set = (patch: Partial<KhbdContent>) => onChange({ ...value, ...patch });
  const setAct = (key: string, patch: Partial<KhbdActivity>) =>
    onChange({
      ...value,
      [key]: { ...(value[key as keyof KhbdContent] as KhbdActivity), ...patch },
    });

  return (
    <div className="mt-3 space-y-4">
      <fieldset className="rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold">I. Mục tiêu</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Edit
            label="1. Kiến thức"
            value={value.muc_tieu_kien_thuc}
            onChange={(v) => set({ muc_tieu_kien_thuc: v })}
            placeholder="HS nắm được..."
          />
          <Edit
            label="2. Năng lực"
            value={value.muc_tieu_nang_luc}
            onChange={(v) => set({ muc_tieu_nang_luc: v })}
            placeholder="Năng lực chung, năng lực đặc thù môn..."
          />
          <Edit
            label="3. Phẩm chất"
            value={value.muc_tieu_pham_chat}
            onChange={(v) => set({ muc_tieu_pham_chat: v })}
            placeholder="Trách nhiệm, chăm chỉ, trung thực..."
          />
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold">
          II. Thiết bị dạy học và học liệu
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Edit
            label="1. Giáo viên"
            value={value.thiet_bi_gv}
            onChange={(v) => set({ thiet_bi_gv: v })}
            placeholder="Slide, bảng phụ, phiếu học tập..."
          />
          <Edit
            label="2. Học sinh"
            value={value.thiet_bi_hs}
            onChange={(v) => set({ thiet_bi_hs: v })}
            placeholder="SGK, vở ghi, đồ dùng..."
          />
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold">
          III. Tiến trình dạy học
        </legend>
        <div className="space-y-4">
          {KHBD_ACTIVITIES.map(({ key, label }) => {
            const a = value[key];
            return (
              <div
                key={key}
                className="rounded-lg border border-border/70 bg-muted/30 p-3"
              >
                <p className="mb-2 text-sm font-medium">{label}</p>
                <div className="grid gap-3">
                  <Edit
                    label="a) Mục tiêu"
                    value={a.muc_tieu}
                    onChange={(v) => setAct(key, { muc_tieu: v })}
                  />
                  <Edit
                    label="b) Tổ chức thực hiện (hoạt động của GV - HS)"
                    value={a.to_chuc}
                    onChange={(v) => setAct(key, { to_chuc: v })}
                    rows={3}
                    placeholder="- GV giao nhiệm vụ...&#10;- HS thực hiện...&#10;- GV chốt..."
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Edit
                      label="c) Sản phẩm"
                      value={a.san_pham}
                      onChange={(v) => setAct(key, { san_pham: v })}
                    />
                    <Edit
                      label="d) Đánh giá"
                      value={a.danh_gia}
                      onChange={(v) => setAct(key, { danh_gia: v })}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      <Edit
        label="IV. Điều chỉnh sau bài dạy (nếu có)"
        value={value.dieu_chinh}
        onChange={(v) => set({ dieu_chinh: v })}
      />
    </div>
  );
}

/** Render KHBD co cau truc cho man hinh duyet/xem chi tiet. */
export function KhbdView({ content }: { content: KhbdContent }) {
  const row = (label: string, v: string) =>
    v.trim() ? (
      <div key={label} className="grid gap-0.5 sm:grid-cols-[11rem_1fr]">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="whitespace-pre-wrap">{v}</dd>
      </div>
    ) : null;

  return (
    <div className="space-y-4 text-sm">
      <section>
        <h4 className="mb-1 font-semibold">I. Mục tiêu</h4>
        <dl className="grid gap-1">
          {row("1. Kiến thức", content.muc_tieu_kien_thuc)}
          {row("2. Năng lực", content.muc_tieu_nang_luc)}
          {row("3. Phẩm chất", content.muc_tieu_pham_chat)}
        </dl>
      </section>
      <section>
        <h4 className="mb-1 font-semibold">II. Thiết bị dạy học và học liệu</h4>
        <dl className="grid gap-1">
          {row("1. Giáo viên", content.thiet_bi_gv)}
          {row("2. Học sinh", content.thiet_bi_hs)}
        </dl>
      </section>
      <section>
        <h4 className="mb-1 font-semibold">III. Tiến trình dạy học</h4>
        <div className="space-y-3">
          {KHBD_ACTIVITIES.map(({ key, label }) => {
            const a = content[key];
            if (!Object.values(a).some((v) => v.trim())) return null;
            return (
              <div key={key}>
                <h5 className="font-medium">{label}</h5>
                <dl className="mt-1 grid gap-1 pl-3">
                  {KHBD_ACTIVITY_FIELDS.map(({ key: fk, label: fl }) =>
                    row(`${fl}`, a[fk]),
                  )}
                </dl>
              </div>
            );
          })}
        </div>
      </section>
      {content.dieu_chinh.trim() ? (
        <section>
          <h4 className="mb-1 font-semibold">IV. Điều chỉnh sau bài dạy</h4>
          <p className="whitespace-pre-wrap">{content.dieu_chinh}</p>
        </section>
      ) : null}
    </div>
  );
}
