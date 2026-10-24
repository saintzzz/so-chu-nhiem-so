/**
 * CR-054 - Cloudflare Turnstile cho auth surface.
 *
 * Chay invisible (`appearance: "interaction-only"`): nguoi thuong khong
 * thay gi, chi client dang ngo moi phai tick 1 o. Token duoc truyen vao
 * `captchaToken` cua supabase-js - Supabase Auth verify server-side khi
 * captcha duoc bat trong Auth settings; chua bat thi token bi bo qua,
 * nen loi script cung chi tra null (fail-open phia client).
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      execute: (el: HTMLElement | string) => void;
      remove: (el: HTMLElement | string) => void;
    };
  }
}

const SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ??
  "0x4AAAAAAFisJ_RLESi1cfgw";

const TIMEOUT_MS = 15_000;

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      const timer = setTimeout(() => {
        s.remove();
        scriptPromise = null;
        reject(new Error("turnstile_unavailable"));
      }, TIMEOUT_MS);
      s.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      s.onerror = () => {
        clearTimeout(timer);
        s.remove();
        scriptPromise = null;
        reject(new Error("turnstile_unavailable"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Lay 1 captcha token cho auth call. Tra null khi widget khong chay
 * duoc - caller van submit (Supabase se tu choi neu captcha dang bat).
 */
export async function getTurnstileToken(): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    return await new Promise<string>((resolve, reject) => {
      void (async () => {
        await loadScript();
        const holder = document.createElement("div");
        holder.style.position = "fixed";
        holder.style.bottom = "0";
        holder.style.right = "0";
        holder.style.zIndex = "2147483647";
        document.body.appendChild(holder);
        let widgetId: string | null = null;
        const cleanup = () => {
          if (widgetId !== null) {
            try {
              window.turnstile?.remove(widgetId);
            } catch {
              /* holder removal below is enough */
            }
          }
          holder.remove();
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("turnstile_failed"));
        }, TIMEOUT_MS);
        widgetId =
          window.turnstile?.render(holder, {
            sitekey: SITE_KEY,
            appearance: "interaction-only",
            execution: "execute",
            callback: (token: string) => {
              clearTimeout(timer);
              cleanup();
              resolve(token);
            },
            "error-callback": () => {
              clearTimeout(timer);
              cleanup();
              reject(new Error("turnstile_failed"));
            },
          }) ?? null;
        if (widgetId === null) {
          clearTimeout(timer);
          cleanup();
          reject(new Error("turnstile_failed"));
          return;
        }
        window.turnstile?.execute(holder);
      })().catch(reject);
    });
  } catch {
    return null;
  }
}
