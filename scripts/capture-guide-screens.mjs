// Chup lai toan bo anh man hinh cho user guide tu he thong that.
// Chay: npm run dev (terminal khac) -> node scripts/capture-guide-screens.mjs
// Ket qua: docs/user-guide/images/*.png - anh trong guide + deck luon la ban moi nhat.

import { chromium } from "playwright";
import { createBrowserClient } from "@supabase/ssr";
import { config } from "dotenv";
import { mkdirSync, existsSync } from "node:fs";

config({ path: ".env.local", quiet: true });
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "docs/user-guide/images";
const VW = 1440, VH = 900;

// url: route can chup; text: text cho xuat hien (optional); click: text nut bam truoc khi chup (optional)
const PUBLIC_SHOTS = [
  { file: "01-login.png", url: "/login" },
  { file: "47-apply-tracuu.png", url: "/apply/tra-cuu", text: "Tra c" },
  { file: "48-legal-privacy.png", url: "/legal/privacy", text: "Ch" },
];

const ROLES = {
  gvcn: {
    user: "anhptl@nd.scn",
    pass: "demo1234",
    shots: [
      { file: "02-gvcn-dashboard.png", url: "/dashboard" },
      { file: "03-attendance-daily.png", url: "/attendance/daily" },
      { file: "43-daily-report.png", url: "/attendance/daily-report" },
      { file: "04-attendance-tracking.png", url: "/attendance/tracking" },
      { file: "05-attendance-leaves.png", url: "/attendance/leaves" },
      { file: "06-attendance-history.png", url: "/attendance/history" },
      { file: "07-grades.png", url: "/academics/grades" },
      { file: "08-timetable-me.png", url: "/schedule/timetable?view=me" },
      { file: "08b-timetable-class.png", url: "/schedule/timetable?view=class" },
      { file: "09-period-log.png", url: "/schedule/period-log" },
      { file: "11-seating.png", url: "/register/seating" },
      { file: "12-roster.png", url: "/register/roster" },
      { file: "42-records-students.png", url: "/records/students" },
      { file: "13-conduct.png", url: "/conduct/records" },
      { file: "14-parents-compose.png", url: "/parents/compose" },
      { file: "33-activities-plan.png", url: "/activities/plan" },
      { file: "34-activities-announce.png", url: "/activities/announce" },
      { file: "35-activities-attendance.png", url: "/activities/attendance" },
      { file: "15-safety.png", url: "/safety/report" },
      { file: "18-counseling.png", url: "/counseling/intake" },
      { file: "17-exams.png", url: "/academics/exams" },
      { file: "16-emulation.png", url: "/emulation/ranking" },
      { file: "19-plans.png", url: "/register/plans" },
      { file: "44-lms.png", url: "/lms" },
      { file: "45-studio-questions.png", url: "/studio/questions" },
      { file: "46-signoff.png", url: "/register/signoff" },
      { file: "20-export.png", url: "/register/export" },
      { file: "32-hoc-ba-so.png", url: "/records/hoc-ba" },
      { file: "49-movements.png", url: "/movements" },
      { file: "50-meals.png", url: "/meals" },
      { file: "51-health.png", url: "/school/health" },
    ],
  },
  bgh: {
    user: "hainv@nd.scn",
    pass: "demo1234",
    shots: [
      { file: "21-bgh-dashboard.png", url: "/school/dashboard" },
      { file: "22-bgh-approvals.png", url: "/school/approvals" },
      { file: "36-daily-reports.png", url: "/school/daily-reports" },
      { file: "23-bgh-radar.png", url: "/school/radar" },
      { file: "24-bgh-timetable.png", url: "/schedule/manage" },
      { file: "52-substitutes.png", url: "/school/substitutes" },
      { file: "25-bgh-ai.png", url: "/school/ai-assistant" },
      { file: "37-admissions.png", url: "/school/admissions" },
      { file: "38-documents.png", url: "/school/documents" },
      { file: "40-privacy.png", url: "/school/privacy" },
      { file: "39-library.png", url: "/library" },
      { file: "53-journals.png", url: "/school/journals" },
      { file: "54-exam-analytics.png", url: "/school/exam-analytics" },
      { file: "55-graduation.png", url: "/school/graduation" },
      { file: "56-integrations.png", url: "/school/integrations" },
    ],
  },
  totruong: {
    user: "hanhlth@nd.scn",
    pass: "demo1234",
    shots: [
      { file: "26-team-lesson-plans.png", url: "/team/lesson-plans" },
      { file: "27-team-meetings.png", url: "/team/meetings" },
    ],
  },
  ketoan: {
    user: "trangpt@nd.scn",
    pass: "demo1234",
    shots: [{ file: "41-finance-invoices.png", url: "/finance/invoices" }],
  },
  sogd: {
    user: "sovqt@demo.scn",
    pass: "demo1234",
    shots: [
      { file: "28-dept-dashboard.png", url: "/dept/dashboard" },
      { file: "29-dept-data.png", url: "/dept/data" },
      { file: "57-dept-modules.png", url: "/dept/modules" },
    ],
  },
  phuhuynh: {
    user: "annv@nd.scn",
    pass: "demo1234",
    shots: [{ file: "30-parent-portal.png", url: "/portal/parent" }],
  },
  hocsinh: {
    user: "baong@nd.scn",
    pass: "demo1234",
    shots: [
      { file: "31-student-portal.png", url: "/portal/student" },
      { file: "58-student-hocba.png", url: "/portal/student/hoc-ba" },
    ],
  },
};

// Turnstile treo trong headless Chrome - sign-in qua node roi inject
// dung cookie ssr (sb-<ref>-auth-token, chunked) vao context.
async function login(context, user, pass) {
  const written = [];
  const sb = createBrowserClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => written.push(...cookies),
    },
  });
  const { error } = await sb.auth.signInWithPassword({ email: user, password: pass });
  if (error) throw new Error(`signIn: ${error.message}`);
  const host = new URL(BASE).hostname;
  await context.addCookies(
    written.map((c) => ({
      name: c.name,
      value: c.value,
      domain: host,
      path: c.options?.path || "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    })),
  );
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main, nav, aside", { timeout: 30000 });
  await page.waitForTimeout(1500);
  return page;
}

async function shoot(page, shot) {
  const res = await page.goto(`${BASE}${shot.url}`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector("main", { timeout: 20000 });
  } catch { /* mot so trang public khong co main */ }
  if (shot.text) {
    try { await page.getByText(new RegExp(shot.text), { exact: false }).first().waitFor({ timeout: 15000 }); } catch {}
  }
  if (shot.click) {
    try { await page.getByText(shot.click, { exact: false }).first().click({ timeout: 5000 }); } catch {}
  }
  await page.waitForTimeout(2200); // cho hydration + data settle
  const finalUrl = page.url().replace(BASE, "");
  await page.screenshot({ path: `${OUT}/${shot.file}` });
  console.log(`${res?.status() ?? "?"} ${shot.file} <- ${shot.url} => ${finalUrl}`);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  // Public shots
  {
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    for (const shot of PUBLIC_SHOTS) await shoot(page, shot);
    await ctx.close();
  }
  // Per-role
  for (const [role, cfg] of Object.entries(ROLES)) {
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
    try {
      const page = await login(ctx, cfg.user, cfg.pass);
      console.log(`== ${role} (${cfg.user}) logged in, landed ${page.url().replace(BASE, "")}`);
      for (const shot of cfg.shots) await shoot(page, shot);
    } catch (e) {
      console.log(`!! ${role} login failed: ${e.message.split("\n")[0]}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log("Done ->", OUT);
