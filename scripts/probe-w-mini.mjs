import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const BASE = "https://sochunhiem.vieschool.com";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim().replace(/^"|"$/g,"")]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const browser = await chromium.launch();
async function loginCtx(email) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill("#email", email);
  await p.fill("input[type=password]", "demo1234");
  await p.click("button[type=submit]");
  await p.waitForTimeout(5000);
  return { ctx, p };
}
// W29 seed + flow
{
  const { data: ttProf } = await db.from("profiles").select("id,school_id").eq("email","hanhlth@nd.scn").single();
  const { data: lp0 } = await db.from("lesson_plans").select("id").eq("school_id",ttProf.school_id).eq("status","submitted").limit(1);
  let w29Id = lp0?.[0]?.id ?? null;
  if (!w29Id) {
    const { data: teacher } = await db.from("profiles").select("id").eq("school_id",ttProf.school_id).eq("role","gvbm").limit(1);
    const { data: cls } = await db.from("classes").select("id").eq("school_id",ttProf.school_id).eq("status","active").limit(1);
    const { data: sub } = await db.from("subjects").select("id").eq("school_id",ttProf.school_id).limit(1);
    const { data: ins, error: ie } = await db.from("lesson_plans").insert({
      school_id: ttProf.school_id, teacher_id: teacher[0].id, class_id: cls[0].id, subject_id: sub[0].id,
      title: "QA-W29 deterministic plan", content: "Noi dung giao an QA", week: 9, status: "submitted",
    }).select("id").single();
    if (ie) console.log("[W29 seed]", ie.message);
    w29Id = ins?.id ?? null;
  }
  console.log("W29 target:", w29Id);
  const { ctx, p } = await loginCtx("hanhlth@nd.scn");
  await p.goto(`${BASE}/team/lesson-plans`); await p.waitForTimeout(2000);
  const approveBtn = p.locator('button[title*="Duyệt"]').first();
  console.log("  approve btn:", await approveBtn.count());
  if ((await approveBtn.count()) > 0) {
    await approveBtn.click(); await p.waitForTimeout(800);
    const confirmBtn = p.locator('button:has-text("Duyệt")').first();
    console.log("  confirm btn:", await confirmBtn.count());
    if ((await confirmBtn.count()) > 0) await confirmBtn.click();
    await p.waitForTimeout(2500);
    const { data: after } = await db.from("lesson_plans").select("id,status,team_reviewed_by").eq("id",w29Id).single();
    console.log("  W29:", after?.status, "by_tt:", after?.team_reviewed_by === ttProf.id);
  }
  await ctx.close();
}
// W31 seed + flow
{
  const anhptlId = "bb42e98d-f6ca-40ff-98c9-4440beda01a7";
  const { data: ap0 } = await db.from("appointments").select("id").eq("teacher_id",anhptlId).eq("status","proposed").limit(1);
  let w31Id = ap0?.[0]?.id ?? null;
  if (!w31Id) {
    const { data: cls } = await db.from("classes").select("id").eq("gvcn_id",anhptlId).eq("status","active").limit(1);
    const { data: st } = cls?.length ? await db.from("students").select("id").eq("class_id",cls[0].id).limit(1) : { data: [] };
    const { data: ps } = st?.length ? await db.from("parent_students").select("parent_id").eq("student_id",st[0].id).limit(1) : { data: [] };
    if (cls?.length && st?.length && ps?.length) {
      const { data: ins, error: ie } = await db.from("appointments").insert({
        parent_id: ps[0].parent_id, teacher_id: anhptlId, student_id: st[0].id,
        scheduled_at: new Date(Date.now()+7*86400000).toISOString(),
        purpose: "QA-W31 deterministic appointment", status: "proposed",
      }).select("id").single();
      if (ie) console.log("[W31 seed]", ie.message);
      w31Id = ins?.id ?? null;
    }
  }
  console.log("W31 target:", w31Id);
  const { ctx, p } = await loginCtx("anhptl@nd.scn");
  await p.goto(`${BASE}/parents/appointments`); await p.waitForTimeout(2000);
  const confirmBtn = p.locator('button:has-text("Xác nhận"), button:has-text("Nhận lịch")').first();
  console.log("  confirm btn:", await confirmBtn.count());
  if ((await confirmBtn.count()) > 0) {
    await confirmBtn.click(); await p.waitForTimeout(2500);
    const { data: after } = await db.from("appointments").select("id,status").eq("id",w31Id).single();
    console.log("  W31:", after?.status);
  } else {
    console.log("  page text:", (await p.locator("body").innerText()).slice(0,400));
  }
  await ctx.close();
}
await browser.close();
