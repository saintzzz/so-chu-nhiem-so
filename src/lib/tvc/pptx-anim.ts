// CR-052: tuong tac trong .pptx - reveal dap an khi click (interactiveSeq)
// + fade transition. Port pattern da verify tu slideforge worker/build.mjs
// (ARMED/oneSeq golden XML) - khong dung macro, chi animation timeline.
import JSZip from "jszip";

export interface RevealPair {
  trigger: string; // objectName shape cau hoi (scn:q:n)
  target: string; // objectName shape dap an (scn:ans:n)
}

export interface SlideJob {
  slideNo: number; // 1-based theo thu tu ppt/slides/slideN.xml
  reveals: RevealPair[];
}

const TRANSITION = '<p:transition spd="med"><p:fade/></p:transition>';

function shapeIds(xml: string): { id: string; name: string }[] {
  const ids: { id: string; name: string }[] = [];
  const re = /<p:cNvPr id="(\d+)" name="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) ids.push({ id: m[1], name: m[2] });
  return ids.filter((x) => x.name);
}

// interactiveSeq: click vao trigger -> target fade-in. Wrapper par co
// delay="indefinite" la buoc bat buoc - clickEffect delay=0 tran trong
// mainSeq se TU CHAY khi slide mo (khong can click).
function oneSeq(triggerSpid: string, targetSpid: string, base: number): string {
  const a = base, b = base + 1, c = base + 2, d = base + 3;
  return (
    `<p:par><p:cTn id="${a}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek"><p:cTn id="${b}" dur="indefinite" nodeType="interactiveSeq">` +
    `<p:stCondLst><p:cond delay="indefinite"><p:tgtEl><p:spTgt spid="${triggerSpid}"/></p:tgtEl></p:cond></p:stCondLst><p:childTnLst>` +
    `<p:par><p:cTn id="${c}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="clickEffect">` +
    `<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
    `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${d}" dur="350"/><p:tgtEl><p:spTgt spid="${targetSpid}"/></p:tgtEl></p:cBhvr></p:animEffect>` +
    `</p:childTnLst></p:cTn></p:par>` +
    `</p:childTnLst></p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq></p:childTnLst></p:cTn></p:par>`
  );
}

// Patch buffer .pptx: them fade transition (moi slide) + timing interactive
// cho cac slide co reveal pair. Tra buffer moi - caller giu nguyen flow cu
// khi khong co jobs.
export async function injectInteractions(
  buf: Buffer,
  slideJobs: SlideJob[],
): Promise<Buffer> {
  const z = await JSZip.loadAsync(buf);
  const jobsByNo = new Map(slideJobs.map((j) => [j.slideNo, j]));
  for (const name of Object.keys(z.files)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue;
    const slideNo = Number(name.match(/slide(\d+)\.xml/)?.[1]);
    let xml = await z.file(name)!.async("string");
    // Fade transition - sau clrMapOvr, truoc timing (schema order).
    if (!xml.includes("<p:transition")) {
      if (xml.includes("</p:clrMapOvr>")) {
        xml = xml.replace("</p:clrMapOvr>", `</p:clrMapOvr>${TRANSITION}`);
      } else {
        xml = xml.replace("</p:cSld>", `</p:cSld>${TRANSITION}`);
      }
    }
    const job = jobsByNo.get(slideNo);
    if (job?.reveals.length) {
      const byName = new Map(shapeIds(xml).map((x) => [x.name, x.id]));
      let seqs = "";
      let base = 10;
      for (const r of job.reveals) {
        const t = byName.get(r.trigger);
        const g = byName.get(r.target);
        if (!t || !g) continue;
        seqs += oneSeq(t, g, base);
        base += 10;
      }
      if (seqs && !xml.includes("<p:timing>")) {
        const timing =
          `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
          `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
          seqs +
          `</p:childTnLst></p:cTn>` +
          `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
          `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
          `</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
        xml = xml.replace("</p:sld>", timing + "</p:sld>");
      }
    }
    z.file(name, xml);
  }
  const out = await z.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
