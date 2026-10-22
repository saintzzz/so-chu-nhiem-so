// CR-050: hoan vi thu tu cau hoi trong de -> "ma de" thu 2.
// - Shuffle trong tung phan (qtype) theo thu tu phan cua de thi
//   (multiple_choice -> true_false_4 -> short_answer -> essay) de giu
//   cau truc TT22/CV 7991.
// - Cau cung `context` (doan doc) giu cum - khong bao gio tach cau hoi
//   khoi doan doc cua no.
// - Dung chung cho buildExamDoc (doc) va mkQs (luu DB): pickedB =
//   shufflePicked(pickedCT) -> ca doc va position trong tvc_exam_questions
//   di theo cung mot thu tu.

const PART_ORDER = ["multiple_choice", "true_false_4", "short_answer", "essay"];

function fy<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shufflePicked<T extends { q: { qtype: string; context: string | null } }>(
  picked: T[],
  rand: () => number = Math.random,
): T[] {
  const byQtype = new Map<string, T[]>();
  for (const p of picked) {
    const k = p.q.qtype;
    byQtype.set(k, [...(byQtype.get(k) ?? []), p]);
  }
  const out: T[] = [];
  const orderedTypes = [
    ...PART_ORDER.filter((t) => byQtype.has(t)),
    ...[...byQtype.keys()].filter((t) => !PART_ORDER.includes(t)),
  ];
  for (const qt of orderedTypes) {
    const rows = byQtype.get(qt)!;
    // Cum theo context: cau khong context tu la 1 cum.
    const clusters: T[][] = [];
    const ctxCluster = new Map<string, T[]>();
    for (const p of rows) {
      const c = p.q.context?.trim();
      if (!c) {
        clusters.push([p]);
        continue;
      }
      let cl = ctxCluster.get(c);
      if (!cl) {
        cl = [];
        ctxCluster.set(c, cl);
        clusters.push(cl);
      }
      cl.push(p);
    }
    fy(clusters, rand);
    for (const cl of clusters) out.push(...cl);
  }
  return out;
}
