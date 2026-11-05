"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTurnstileToken } from "@/lib/turnstile";
import { Button } from "@/components/ui/button";

// CR-114: public one-click demo on the seeded `nd` school (THCS Nguyen Du).
// demo.gvcn@nd.scn is GVCN of 7A1 with full seeded operational data -
// standard public-demo pattern; the tenant is demo data only and the
// account's blast radius is a single filler class, so shared visitors
// cannot disturb the QA trio (anhptl/minhtv/hainv).
const DEMO_EMAIL = "demo.gvcn@nd.scn";
const DEMO_PASSWORD = "demo1234";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [slowLogin, setSlowLogin] = useState(false);

  async function signIn(e: string, p: string): Promise<boolean> {
    const supabase = createClient();
    // Turnstile can hold the sign-in ~30s on strict networks - staged copy
    // after 4s says "security check" instead of looking hung.
    const slowTimer = setTimeout(() => setSlowLogin(true), 4000);
    let captchaToken: string | null = null;
    try {
      captchaToken = await getTurnstileToken();
    } finally {
      clearTimeout(slowTimer);
      setSlowLogin(false);
    }
    const { error: err } = await supabase.auth.signInWithPassword({
      email: e,
      password: p,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (err) return false;
    router.push("/");
    router.refresh();
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!(await signIn(email, password))) {
      setError("Đăng nhập thất bại. Kiểm tra lại tên đăng nhập và mật khẩu.");
      setLoading(false);
    }
  }

  async function onDemo() {
    setDemoLoading(true);
    setError(null);
    if (!(await signIn(DEMO_EMAIL, DEMO_PASSWORD))) {
      setError("Không vào được bản demo lúc này - vui lòng thử lại.");
      setDemoLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium"
        >
          Email
        </label>
        <input
          id="email"
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          placeholder="vd: anhptl@nd.scn"
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
      {error && (
        <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="h-11 w-full text-[15px]"
        disabled={loading || demoLoading}
      >
        {loading ? (slowLogin ? "Đang kiểm tra bảo mật..." : "Đang đăng nhập...") : "Đăng nhập"}
      </Button>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">hoặc</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full text-[15px]"
        disabled={loading || demoLoading}
        onClick={onDemo}
      >
        {demoLoading ? (slowLogin ? "Đang kiểm tra bảo mật..." : "Đang vào bản demo...") : "Vào trải nghiệm demo"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Trường demo THCS Nguyễn Du - dữ liệu mẫu sẵn sàng, không cần tài khoản
      </p>
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        Bằng việc đăng nhập, anh chị đồng ý với{' '}
        <a
          href="https://vieschool.com/dieu-khoan"
          className="font-medium text-primary hover:underline"
        >
          Điều khoản sử dụng
        </a>{' '}
        và{' '}
        <a
          href="https://vieschool.com/chinh-sach-bao-mat"
          className="font-medium text-primary hover:underline"
        >
          Chính sách bảo mật
        </a>
        . VieSchool xử lý dữ liệu học sinh theo ủy quyền của nhà trường.
      </p>
    </form>
  );
}
