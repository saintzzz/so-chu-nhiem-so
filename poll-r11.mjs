import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('chatgpt.com'));
for (let i = 0; i < 80; i++) {
  await page.waitForTimeout(15000);
  const st = await page.evaluate(() => {
    const t = document.body.innerText;
    const all = t.match(/VERDICT: (CLEAN|NOT-CLEAN)/g) ?? [];
    const working = /Working for \d+[ms]/i.test(t);
    return { len: t.length, n: all.length, last: all[all.length-1] ?? null, working, url: location.href };
  });
  console.log(`[${i}] len=${st.len} verdict_count=${st.n} last=${st.last} working=${st.working}`);
  // prompt chua dung 2 chuoi verdict trong instruction; verdict that la occurrence thu 3+
  if (st.n > 2 && !st.working) { console.log('DONE:', st.last); break; }
}
await browser.close();
