import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getProfile, ROLE_HOME } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const profile = await getProfile();
  if (profile) redirect(ROLE_HOME[profile.role]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-md-token)]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span className="text-xl font-semibold">Sổ Chủ Nhiệm Số</span>
        </div>
        <h1 className="text-center text-lg font-semibold">Đăng nhập hệ thống</h1>
        <p className="mt-1 mb-6 text-center text-sm text-muted-foreground">
          Nền tảng số hóa công tác chủ nhiệm cho trường học
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
