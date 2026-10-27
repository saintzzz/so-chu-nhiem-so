import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// POST /api/admissions/apply - nop ho so tuyen sinh cong khai.
// Lop bao ve: honeypot -> Turnstile -> RPC (kiem open + module + dedupe).

const ERR_MAP: Record<string, string> = {
  campaign_not_found: "Đợt tuyển sinh không tồn tại.",
  campaign_not_open: "Đợt tuyển sinh chưa mở hoặc đã đóng.",
  module_disabled: "Nhà trường chưa mở cổng tuyển sinh trực tuyến.",
  missing_name: "Vui lòng nhập họ tên học sinh.",
};

async function verifyTurnstile(token: string | null, ip: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return true; // chua cau hinh -> fail-open nhu login
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as { success?: boolean };
  return json.success === true;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Yêu cầu không hợp lệ." }, { status: 400 });
  }

  // honeypot: bot dien -> gia thanh cong, khong ghi gi
  if (body.website) {
    return NextResponse.json({ tracking_code: "TS000000" });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ok = await verifyTurnstile(body.captcha_token ?? null, ip);
  if (!ok) {
    return NextResponse.json(
      { message: "Xác minh không thành công. Vui lòng thử lại." },
      { status: 403 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.rpc("admission_apply_public", {
    p_campaign: body.campaign_id,
    p_full_name: body.full_name,
    p_dob: body.dob,
    p_gender: body.gender,
    p_id_number: body.id_number,
    p_address: body.address,
    p_source_school: body.source_school,
    p_parent_name: body.parent_name,
    p_parent_phone: body.parent_phone,
    p_priority: Number(body.priority) || 1,
  });

  if (error) {
    const key = Object.keys(ERR_MAP).find((k) => error.message.includes(k));
    if (key) {
      return NextResponse.json({ message: ERR_MAP[key] }, { status: 400 });
    }
    if (error.message.includes("adm_app_id_number")) {
      return NextResponse.json(
        { message: "Số CCCD/định danh này đã nộp hồ sơ trong đợt tuyển." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "Không thể nộp hồ sơ. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    tracking_code: (data as { tracking_code?: string })?.tracking_code,
  });
}
