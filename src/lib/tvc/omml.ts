/**
 * Chuyển OMML (m:oMath trong docx) -> LaTeX cho các cấu trúc toán phổ thông:
 * phân số, căn, mũ/chỉ số, tích phân-tổng (nary), ngoặc, ma trận, hàm, giới hạn.
 */

const M = "http://schemas.openxmlformats.org/officeDocument/2006/math";

function kids(el: Element, name: string): Element[] {
  return Array.from(el.children).filter(
    (c) => c.localName === name && c.namespaceURI === M,
  );
}
function kid(el: Element, name: string): Element | null {
  return kids(el, name)[0] ?? null;
}
function prop(el: Element | null, name: string): string | null {
  const p = el ? kid(el, name) : null;
  return p?.getAttributeNS(M, "val") ?? p?.getAttribute("m:val") ?? null;
}
function arg(el: Element | null): string {
  return el ? ommlChildren(el) : "";
}

function ommlEl(el: Element): string {
  const name = el.localName;
  switch (name) {
    case "r":
    case "e":
    case "num":
    case "den":
    case "deg":
    case "sub":
    case "sup":
    case "lim":
    case "fName":
    case "mr":
      return ommlChildren(el);
    case "t":
      return el.textContent ?? "";
    case "f": {
      const num = arg(kid(el, "num"));
      const den = arg(kid(el, "den"));
      return `\\frac{${num}}{${den}}`;
    }
    case "sSup":
      return `${arg(kid(el, "e"))}^{${arg(kid(el, "sup"))}}`;
    case "sSub":
      return `${arg(kid(el, "e"))}_{${arg(kid(el, "sub"))}}`;
    case "sSubSup":
      return `${arg(kid(el, "e"))}_{${arg(kid(el, "sub"))}}^{${arg(kid(el, "sup"))}}`;
    case "rad": {
      const deg = arg(kid(el, "deg"));
      const e = arg(kid(el, "e"));
      return deg ? `\\sqrt[${deg}]{${e}}` : `\\sqrt{${e}}`;
    }
    case "nary": {
      const pr = kid(el, "naryPr");
      const chr = prop(pr, "chr") ?? "∫";
      const op =
        { "∫": "\\int", "∑": "\\sum", "∏": "\\prod", "∮": "\\oint" }[chr] ?? chr;
      const sub = arg(kid(el, "sub"));
      const sup = arg(kid(el, "sup"));
      const e = arg(kid(el, "e"));
      return `${op}${sub ? `_{${sub}}` : ""}${sup ? `^{${sup}}` : ""} ${e}`;
    }
    case "d": {
      const pr = kid(el, "dPr");
      const beg = prop(pr, "begChr") ?? "(";
      const end = prop(pr, "endChr") ?? ")";
      return `\\left${beg} ${arg(kid(el, "e"))} \\right${end}`;
    }
    case "m": {
      const rows = kids(el, "mr").map((r) =>
        kids(r, "e").map(arg).join(" & "),
      );
      return `\\begin{pmatrix} ${rows.join(" \\\\ ")} \\end{pmatrix}`;
    }
    case "eqArr":
      return kids(el, "e").map(arg).join(" \\\\ ");
    case "func": {
      const fn = arg(kid(el, "fName")).trim() || "f";
      return `\\${fn.replace(/^\\/, "")} ${arg(kid(el, "e"))}`;
    }
    case "limLow":
      return `\\mathop{${arg(kid(el, "e"))}}\\limits_{${arg(kid(el, "lim"))}}`;
    case "limUpp":
      return `\\mathop{${arg(kid(el, "e"))}}\\limits^{${arg(kid(el, "lim"))}}`;
    case "bar":
      return `\\overline{${arg(kid(el, "e"))}}`;
    case "groupChr": {
      const chr = prop(kid(el, "groupChrPr"), "chr") ?? "⏞";
      const e = arg(kid(el, "e"));
      return chr === "⏟" ? `\\underbrace{${e}}` : `\\overbrace{${e}}`;
    }
    case "acc": {
      const chr = prop(kid(el, "accPr"), "chr") ?? "^";
      const map: Record<string, string> = {
        "^": "\\hat", "→": "\\vec", "⃗": "\\vec", "̂": "\\hat", "̃": "\\tilde",
      };
      return `${map[chr] ?? "\\hat"}{${arg(kid(el, "e"))}}`;
    }
    default:
      return ommlChildren(el);
  }
}

function ommlChildren(el: Element): string {
  return Array.from(el.childNodes)
    .map((n) => (n.nodeType === 1 ? ommlEl(n as Element) : ""))
    .join("");
}

/** oMath element -> chuỗi LaTeX. */
export function ommlToLatex(oMath: Element): string {
  return ommlChildren(oMath).trim();
}
