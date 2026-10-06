"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";

/**
 * Render text co công thức LaTeX inline (Toan/Ly/Hoa - \ce{} qua mhchem).
 * Cu phap: $...$ (inline), $$...$$ (display), \(...\) (inline).
 * Dung cho stem cau hoi, loi giai, dap an - che do "math type" cua ngan hang.
 */
const TOKEN_SOURCE = "\\$\\$([^$]+)\\$\\$|\\$([^$]+)\\$|\\\\\\((.+?)\\\\\\)";

/** Sua loi engine/AI escape kep: "\\vec" -> "\vec", "\\," -> "\,". */
export function normalizeMathTex(tex: string): string {
  return tex.replace(/\\\\(?=[a-zA-Z{(\[,;:])/g, "\\");
}

export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const out: { key: number; html?: string; text?: string }[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    const re = new RegExp(TOKEN_SOURCE, "g");
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ key: i++, text: text.slice(last, m.index) });
      const tex = normalizeMathTex(m[1] ?? m[2] ?? m[3] ?? "");
      const display = m[1] !== undefined;
      try {
        out.push({
          key: i++,
          html: katex.renderToString(tex, { throwOnError: false, displayMode: display }),
        });
      } catch {
        out.push({ key: i++, text: m[0] });
      }
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ key: i, text: text.slice(last) });
    return out;
  }, [text]);

  return (
    <span className={`whitespace-pre-line ${className ?? ""}`}>
      {parts.map((p) =>
        p.html ? (
          <span key={p.key} dangerouslySetInnerHTML={{ __html: p.html }} />
        ) : (
          <span key={p.key}>{p.text}</span>
        ),
      )}
    </span>
  );
}
