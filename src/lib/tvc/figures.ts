// CR-031: figure-spec library - sinh SVG deterministic cho hinh hoc tieu hoc.
// LLM/GV chi chon template + params; khong dung AI sinh anh raster (sai goc/ty le).

export type FigureKind =
  | "triangle"
  | "rectangle"
  | "circle"
  | "segment"
  | "angle"
  | "clock";

export interface FigureSpec {
  kind: FigureKind;
  labels?: string[]; // nhan dinh canh/diem
  sides?: string[]; // nhan do dai canh
  angle?: string; // nhan goc (vd "90°", "x°")
  radius?: string; // nhan ban kinh
  time?: string; // "h:mm" cho dong ho
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const ST = 'stroke="#222" stroke-width="1.6" fill="none"';
const TX = 'font-family="Arial" font-size="14" fill="#222"';

/** figure -> chuoi SVG hoan chinh (nen trang, duong den, in A4 dep) */
export function renderFigure(spec: FigureSpec): string {
  switch (spec.kind) {
    case "triangle": {
      const [A, B, C] = spec.labels ?? ["A", "B", "C"];
      const [ab, bc, ca] = spec.sides ?? [];
      return `<svg ${NS} width="220" height="180" viewBox="0 0 220 180">
<rect width="220" height="180" fill="#fff"/>
<polygon points="30,150 190,150 110,40" ${ST}/>
<text x="18" y="162" ${TX}>${esc(A)}</text>
<text x="195" y="162" ${TX}>${esc(B)}</text>
<text x="106" y="32" ${TX}>${esc(C)}</text>
${ab ? `<text x="58" y="162" ${TX}>${esc(ab)}</text>` : ""}
${bc ? `<text x="158" y="92" ${TX}>${esc(bc)}</text>` : ""}
${ca ? `<text x="52" y="92" ${TX}>${esc(ca)}</text>` : ""}
${spec.angle ? `<path d="M175 150 A18 18 0 0 0 168 132" ${ST}/><text x="152" y="146" ${TX}>${esc(spec.angle)}</text>` : ""}
</svg>`;
    }
    case "rectangle": {
      const [l, w] = spec.labels ?? ["a", "b"];
      return `<svg ${NS} width="220" height="150" viewBox="0 0 220 150">
<rect width="220" height="150" fill="#fff"/>
<rect x="30" y="30" width="160" height="90" ${ST}/>
<text x="105" y="140" ${TX}>${esc(l)}</text>
<text x="8" y="80" ${TX}>${esc(w)}</text>
</svg>`;
    }
    case "circle": {
      const r = spec.radius ?? "r";
      const c = spec.labels?.[0] ?? "O";
      return `<svg ${NS} width="180" height="170" viewBox="0 0 180 170">
<rect width="180" height="170" fill="#fff"/>
<circle cx="90" cy="80" r="60" ${ST}/>
<line x1="90" y1="80" x2="150" y2="80" ${ST}/>
<circle cx="90" cy="80" r="3" fill="#222"/>
<text x="82" y="72" ${TX}>${esc(c)}</text>
<text x="112" y="70" ${TX}>${esc(r)}</text>
</svg>`;
    }
    case "segment": {
      const [a, b] = spec.labels ?? ["A", "B"];
      const len = spec.sides?.[0] ?? "";
      return `<svg ${NS} width="220" height="70" viewBox="0 0 220 70">
<rect width="220" height="70" fill="#fff"/>
<line x1="25" y1="40" x2="195" y2="40" ${ST}/>
<circle cx="25" cy="40" r="3" fill="#222"/><circle cx="195" cy="40" r="3" fill="#222"/>
<text x="12" y="34" ${TX}>${esc(a)}</text><text x="197" y="34" ${TX}>${esc(b)}</text>
${len ? `<text x="95" y="30" ${TX}>${esc(len)}</text>` : ""}
</svg>`;
    }
    case "angle": {
      const deg = spec.angle ?? "x°";
      const [o, a, b] = spec.labels ?? ["O", "A", "B"];
      return `<svg ${NS} width="180" height="140" viewBox="0 0 180 140">
<rect width="180" height="140" fill="#fff"/>
<line x1="40" y1="110" x2="160" y2="110" ${ST}/>
<line x1="40" y1="110" x2="120" y2="35" ${ST}/>
<path d="M85 110 A45 45 0 0 0 72 78" ${ST}/>
<text x="80" y="100" ${TX}>${esc(deg)}</text>
<text x="24" y="122" ${TX}>${esc(o)}</text>
<text x="160" y="122" ${TX}>${esc(a)}</text>
<text x="118" y="30" ${TX}>${esc(b)}</text>
</svg>`;
    }
    case "clock": {
      const [hh, mm] = (spec.time ?? "3:00").split(":").map(Number);
      const hDeg = ((hh % 12) + (mm || 0) / 60) * 30;
      const mDeg = (mm || 0) * 6;
      const tick = (i: number) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = 90 + Math.sin(a) * 62, y1 = 90 - Math.cos(a) * 62;
        const x2 = 90 + Math.sin(a) * 70, y2 = 90 - Math.cos(a) * 70;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${ST} stroke-width="${i % 3 === 0 ? 3 : 1.2}"/>`;
      };
      const hand = (deg: number, len: number, w: number) => {
        const a = (deg * Math.PI) / 180;
        return `<line x1="90" y1="90" x2="${90 + Math.sin(a) * len}" y2="${90 - Math.cos(a) * len}" stroke="#222" stroke-width="${w}" stroke-linecap="round"/>`;
      };
      return `<svg ${NS} width="180" height="180" viewBox="0 0 180 180">
<rect width="180" height="180" fill="#fff"/>
<circle cx="90" cy="90" r="78" ${ST}/>
${Array.from({ length: 12 }, (_, i) => tick(i)).join("")}
${hand(hDeg, 40, 4)}${hand(mDeg, 58, 2.5)}
<circle cx="90" cy="90" r="4" fill="#222"/>
</svg>`;
    }
  }
}

/** Parse mo ta figure tu media entry hoac null */
export function parseFigure(v: unknown): FigureSpec | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.kind !== "string") return null;
  return o as unknown as FigureSpec;
}
