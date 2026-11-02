"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// CR-114 r1: the shared public demo account must never expose credential
// changes (a DB trigger hard-blocks them anyway - this hides the dead UI).
const DEMO_ACCOUNT_EMAIL = "demo.gvcn@nd.scn";

/** CR-17: self-service password change for every signed-in role. */
export function ChangePasswordButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        setIsDemo(data.session?.user?.email === DEMO_ACCOUNT_EMAIL);
      });
  }, []);

  if (isDemo) return null;

  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Đổi mật khẩu"
          title="Đổi mật khẩu"
        >
          <KeyRound className="size-5" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          <KeyRound className="size-4" />
          <span className="hidden sm:inline">Đổi mật khẩu</span>
        </button>
      )}
      {open &&
        createPortal(
          <ChangePasswordDialog onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  );
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) {
      setMessage("Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }
    if (pw !== confirm) {
      setMessage("Hai mật khẩu chưa giống nhau.");
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setMessage("Chưa đổi được mật khẩu - thử lại sau.");
    } else {
      setOk(true);
      setMessage("Đổi mật khẩu thành công.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Đổi mật khẩu"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Đổi mật khẩu</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>
        {ok ? (
          <>
            <p className="mb-4 text-sm font-medium text-emerald-400">{message}</p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              Đóng
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Mật khẩu mới"
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            {message && (
              <p className="text-sm font-medium text-rose-400">{message}</p>
            )}
            <button
              type="submit"
              disabled={busy || pw.length < 6 || confirm !== pw}
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Đang đổi..." : "Đổi mật khẩu"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
