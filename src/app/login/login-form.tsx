"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const DEMO_ACCOUNTS = [
  { role: "GVCN - lớp 6A1, 6A2", email: "gvcn@demo.scn" },
  { role: "GVCN - lớp 7A1", email: "gvcn3@school.scn" },
  { role: "GVCN - lớp 7A2", email: "gvcn4@school.scn" },
  { role: "GVCN - lớp 8A1", email: "gvcn5@school.scn" },
  { role: "GVCN - lớp 8A2", email: "gvcn6@school.scn" },
  { role: "GVCN - lớp 9A1", email: "gvcn7@school.scn" },
  { role: "GVCN - lớp 9A2", email: "gvcn8@school.scn" },
  { role: "GVBM (Giáo viên bộ môn)", email: "gvbm@demo.scn" },
  { role: "Tổ trưởng chuyên môn - Tổ Tự nhiên", email: "totruong@demo.scn" },
  { role: "Tổ trưởng chuyên môn - Tổ Xã hội", email: "totruong2@demo.scn" },
  { role: "Hiệu trưởng / BGH", email: "bgh@demo.scn" },
  { role: "PHT - Phân hiệu Bản Mới", email: "pht@demo.scn" },
  { role: "PHT - Cơ sở Trung tâm", email: "pht2@demo.scn" },
  { role: "Kế toán", email: "ketoan@demo.scn" },
  { role: "Quản trị viên Sở GD&ĐT", email: "sogd@demo.scn" },
  { role: "Phòng GD&ĐT", email: "phonggd@demo.scn" },
  { role: "UBND địa bàn", email: "ubnd@demo.scn" },
  { role: "Phụ huynh", email: "phuhuynh@demo.scn" },
  { role: "Phụ huynh 2 (mẹ - cùng con với TK trên)", email: "phuhuynh2@demo.scn" },
  { role: "Học sinh", email: "hocsinh@demo.scn" },
  { role: "[TH] GVCN - lớp 3A (Tiểu học Chu Văn An)", email: "gvcn-th@demo.scn" },
  { role: "[TH] BGH - Tiểu học Chu Văn An", email: "bgh-th@demo.scn" },
  { role: "[TH] Phụ huynh (Tiểu học)", email: "phuhuynh-th@demo.scn" },
  { role: "[TH] Học sinh (Tiểu học)", email: "hocsinh-th@demo.scn" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("gvcn@demo.scn");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (err) {
      setError("Đăng nhập thất bại. Kiểm tra lại tên đăng nhập và mật khẩu.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium"
        >
          Tên đăng nhập
        </label>
        <input
          id="email"
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          autoComplete="username"
          required
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-medium"
        >
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <label
          htmlFor="demo-role"
          className="mb-1.5 block text-sm font-medium"
        >
          Đăng nhập với vai trò (demo)
        </label>
        <select
          id="demo-role"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        >
          {DEMO_ACCOUNTS.map((a) => (
            <option key={a.email} value={a.email}>
              {a.role}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Tài khoản demo - mật khẩu mặc định: demo1234
        </p>
      </div>
      {error && (
        <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="h-11 w-full text-[15px]"
        disabled={loading}
      >
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}
