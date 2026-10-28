"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addBook, addCopies } from "@/app/(app)/library/actions";
import { formatMoney } from "@/lib/utils";

export type LibBookRow = {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  pub_year: number | null;
  isbn: string | null;
  category: string | null;
  price: number | null;
  stats: { total: number; available: number; on_loan: number; other: number };
};

const CATEGORY_SUGGEST = [
  "Sách giáo khoa",
  "Sách tham khảo",
  "Truyện & thiếu nhi",
  "Kỹ năng sống",
  "Khoa học & khám phá",
  "Tạp chí",
  "Khác",
];

const inputCls =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";

export function BooksBoard({ books, openLoans }: { books: LibBookRow[]; openLoans: number }) {
  const [showForm, setShowForm] = useState(false);
  const [copiesFor, setCopiesFor] = useState<LibBookRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [form, setForm] = useState({
    title: "", author: "", publisher: "", pub_year: "", isbn: "",
    category: "", price: "", copies: "1", source: "mua",
  });
  const [extraCopies, setExtraCopies] = useState("1");

  const totals = books.reduce(
    (a, b) => ({
      total: a.total + b.stats.total,
      available: a.available + b.stats.available,
      on_loan: a.on_loan + b.stats.on_loan,
    }),
    { total: 0, available: 0, on_loan: 0 },
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    start(async () => {
      const res = await addBook({
        title: form.title,
        author: form.author || undefined,
        publisher: form.publisher || undefined,
        pub_year: form.pub_year ? Number(form.pub_year) : null,
        isbn: form.isbn || undefined,
        category: form.category || undefined,
        price: form.price ? Number(form.price) : null,
        copies: Number(form.copies) || 0,
        source: form.source || undefined,
      });
      if (res?.error) return setErr(res.error);
      setMsg(`Đã thêm "${form.title}" (${res.copies} bản sao).`);
      setShowForm(false);
      setForm({ title: "", author: "", publisher: "", pub_year: "", isbn: "", category: "", price: "", copies: "1", source: "mua" });
    });
  }

  function submitCopies(e: React.FormEvent) {
    e.preventDefault();
    if (!copiesFor) return;
    setErr(null); setMsg(null);
    start(async () => {
      const res = await addCopies(copiesFor.id, Number(extraCopies) || 1);
      if (res?.error) return setErr(res.error);
      setMsg(`Đã thêm ${res.added} bản sao cho "${copiesFor.title}" (ĐKCB từ ${res.firstNo}).`);
      setCopiesFor(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ấn phẩm" value={books.length} />
        <Stat label="Bản sao" value={totals.total} />
        <Stat label="Sẵn sàng" value={totals.available} />
        <Stat label="Đang mượn" value={openLoans} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setShowForm((v) => !v); setCopiesFor(null); }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {showForm ? "Đóng" : "Thêm sách"}
        </button>
        <Link href="/library/loans" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
          Mượn & trả
        </Link>
        <Link href="/library/register" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
          Sổ đăng ký cá biệt
        </Link>
      </div>

      {showForm && (
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)] grid gap-3 sm:grid-cols-3">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Tên sách *</span>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls + " w-full"} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Tác giả</span>
            <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className={inputCls + " w-full"} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">NXB</span>
            <input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} className={inputCls + " w-full"} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Năm XB</span>
            <input type="number" min={1900} max={2100} value={form.pub_year} onChange={(e) => setForm({ ...form, pub_year: e.target.value })} className={inputCls + " w-full"} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">ISBN</span>
            <input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} className={inputCls + " w-full"} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Phân loại</span>
            <input list="lib-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls + " w-full"} />
            <datalist id="lib-cat">
              {CATEGORY_SUGGEST.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Giá (đ)</span>
            <input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls + " w-full"} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Số bản sao</span>
            <input type="number" min={0} max={200} value={form.copies} onChange={(e) => setForm({ ...form, copies: e.target.value })} className={inputCls + " w-full"} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Nguồn nhập</span>
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inputCls + " w-full"}>
              <option value="mua">Mua</option>
              <option value="tang">Quà tặng</option>
              <option value="tai_tro">Tài trợ</option>
              <option value="khac">Khác</option>
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={busy || !form.title.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy ? "..." : "Lưu sách"}
            </button>
          </div>
        </form>
      )}

      {copiesFor && (
        <form onSubmit={submitCopies} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)] flex flex-wrap items-end gap-3">
          <p className="w-full text-sm font-medium">Thêm bản sao - {copiesFor.title}</p>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Số lượng</span>
            <input type="number" min={1} max={200} value={extraCopies} onChange={(e) => setExtraCopies(e.target.value)} className={inputCls + " w-24"} />
          </label>
          <button type="submit" disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy ? "..." : "Thêm"}
          </button>
          <button type="button" onClick={() => setCopiesFor(null)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
            Hủy
          </button>
        </form>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}

      <div className="overflow-x-auto relative rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Tên sách</th>
              <th className="px-4 py-3 font-medium">Tác giả</th>
              <th className="px-4 py-3 font-medium">Phân loại</th>
              <th className="px-4 py-3 font-medium">Giá</th>
              <th className="px-4 py-3 font-medium">Bản sao</th>
              <th className="px-4 py-3 font-medium">Sẵn sàng / Đang mượn</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{b.title}</td>
                <td className="px-4 py-3">{b.author ?? "-"}</td>
                <td className="px-4 py-3">{b.category ?? "-"}</td>
                <td className="px-4 py-3">{b.price != null ? formatMoney(b.price) : "-"}</td>
                <td className="px-4 py-3 tabular-nums">{b.stats.total}</td>
                <td className="px-4 py-3 tabular-nums">{b.stats.available} / {b.stats.on_loan}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { setCopiesFor(b); setShowForm(false); setExtraCopies("1"); }}
                    className="text-primary hover:underline">
                    Thêm bản sao
                  </button>
                </td>
              </tr>
            ))}
            {books.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Chưa có sách nào (0) - bấm &quot;Thêm sách&quot; để bắt đầu danh mục.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
