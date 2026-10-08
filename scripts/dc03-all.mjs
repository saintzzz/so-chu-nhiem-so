import { chromium } from "playwright";
const IDS = {
  "TOÁN L1": "30ffc81e-87ae-43dc-90b7-4ab6f644cb66",
  "TOÁN L5": "ca2f597a-54af-4636-9867-29f202f86e84",
  "TIẾNG VIỆT L3": "63640928-d04b-4faf-993c-72d15665a84d",
  "TIẾNG ANH L4": "9bbca92e-57b0-40a9-b621-1e3f127feb7b",
};
const b = await chromium.launch();
const p = await b.newPage();
await p.goto("http://localhost:3000/login");
await p.fill("#email", "anhptl@nd.scn");
await p.fill("#password", "demo1234");
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.includes("login"), { timeout: 15000 });
for (const [name, id] of Object.entries(IDS)) {
  const res = await p.evaluate(async (mid) => {
    const r = await fetch("/api/studio/tools/DC-03/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matrix_id: mid }),
    });
    return { s: r.status, b: await r.json() };
  }, id);
  const doc = JSON.stringify(res.b);
  const n = doc.match(/Câu \d+:/g)?.length ?? 0;
  const thieu = (doc.match(/THIẾU/g) ?? []).length;
  console.log(`${name}: status=${res.s} cau=${n} THIEU=${thieu} missing=${res.b?.doc?.meta?.find(m=>m[0]==="Số câu")?.[1]}`);
  const firstItems = res.b?.doc?.sections?.[0]?.blocks?.[1]?.items?.slice(0,2) ?? [];
  for (const it of firstItems) console.log("   ", it.slice(0, 90).replace(/\n/g," | "));
}
await b.close();
