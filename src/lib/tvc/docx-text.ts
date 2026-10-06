import JSZip from "jszip";
import { ommlToLatex } from "@/lib/tvc/omml";

const M = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function walkText(node: Node, out: string[]): void {
  if (node.nodeType !== 1) return;
  const el = node as Element;
  if (el.namespaceURI === M && (el.localName === "oMath" || el.localName === "oMathPara")) {
    const tex = ommlToLatex(el);
    if (tex) out.push(`$${tex}$`);
    return;
  }
  if (el.namespaceURI === W) {
    if (el.localName === "t") {
      out.push(el.textContent ?? "");
      return;
    }
    if (el.localName === "tab") {
      out.push(" ");
      return;
    }
    if (el.localName === "br") {
      out.push("\n");
      return;
    }
  }
  node.childNodes.forEach((c) => walkText(c, out));
}

/**
 * Trích text từ file .docx, giữ công thức OMML dưới dạng LaTeX $...$.
 * Trả về plain text theo đoạn (mỗi w:p một dòng).
 */
export async function docxToText(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xmlFile = zip.file("word/document.xml");
  if (!xmlFile) throw new Error("File docx không hợp lệ.");
  const xml = await xmlFile.async("text");
  // MathType cu nhung cong thuc dang OLE object (khong phai OMML) - khong
  // trich duoc LaTeX; huong user xuat PDF de AI doc bang vision.
  if (/OLEObject|w:object\b/.test(xml) && !xml.includes("oMath")) {
    throw new Error(
      "File này chứa công thức MathType dạng OLE (không đọc được trực tiếp). Trong Word: File > Save As > PDF, rồi upload file PDF - AI sẽ đọc được đầy đủ công thức.",
    );
  }
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const paras = Array.from(doc.getElementsByTagNameNS(W, "p"));
  return paras
    .map((p) => {
      const out: string[] = [];
      walkText(p, out);
      return out.join("").trim();
    })
    .filter(Boolean)
    .join("\n");
}
