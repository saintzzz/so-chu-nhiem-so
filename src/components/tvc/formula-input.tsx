"use client";

import { useRef, useState } from "react";
import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import { Check, Copy } from "lucide-react";
import { normalizeMathTex } from "./math-text";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

type KeyDef = {
  label: string;
  tex: string;
  // Vi tri con tro sau khi chen (tu cuoi tex, dem nguoc). Mac dinh: cuoi.
  caretBack?: number;
};

type KeyGroup = { name: string; keys: KeyDef[] };

const GROUPS: KeyGroup[] = [
  {
    name: "Số học",
    keys: [
      { label: "×", tex: "\\times " },
      { label: "÷", tex: "\\div " },
      { label: "±", tex: "\\pm " },
      { label: "=", tex: " = " },
      { label: "≠", tex: "\\ne " },
      { label: "<", tex: " < " },
      { label: ">", tex: " > " },
      { label: "≤", tex: "\\le " },
      { label: "≥", tex: "\\ge " },
      { label: "≈", tex: "\\approx " },
      { label: "%", tex: "\\% " },
      { label: "…", tex: "\\ldots " },
    ],
  },
  {
    name: "Phân số",
    keys: [
      { label: "a/b", tex: "\\frac{}{}", caretBack: 3 },
      { label: "½", tex: "\\frac{1}{2}" },
      { label: "¾", tex: "\\frac{3}{4}" },
      { label: "hỗn số", tex: "1\\frac{}{}", caretBack: 3 },
      { label: "a:b", tex: " : " },
    ],
  },
  {
    name: "Lũy thừa & căn",
    keys: [
      { label: "x²", tex: "^{2}" },
      { label: "x³", tex: "^{3}" },
      { label: "xⁿ", tex: "^{}" , caretBack: 1 },
      { label: "xᵢ", tex: "_{}", caretBack: 1 },
      { label: "√", tex: "\\sqrt{}", caretBack: 1 },
      { label: "∛", tex: "\\sqrt[3]{}" , caretBack: 1 },
      { label: "()", tex: "\\left(  \\right)", caretBack: 8 },
    ],
  },
  {
    name: "Hình học",
    keys: [
      { label: "°", tex: "^{\\circ}" },
      { label: "∠", tex: "\\angle " },
      { label: "△", tex: "\\triangle " },
      { label: "⊥", tex: "\\perp " },
      { label: "∥", tex: "\\parallel " },
      { label: "π", tex: "\\pi " },
      { label: "m²", tex: "\\,m^2" },
      { label: "m³", tex: "\\,m^3" },
      { label: "→", tex: "\\Rightarrow " },
    ],
  },
  {
    name: "Chữ Hy Lạp",
    keys: [
      { label: "α", tex: "\\alpha " },
      { label: "β", tex: "\\beta " },
      { label: "γ", tex: "\\gamma " },
      { label: "δ", tex: "\\delta " },
      { label: "θ", tex: "\\theta " },
      { label: "λ", tex: "\\lambda " },
      { label: "μ", tex: "\\mu " },
      { label: "φ", tex: "\\varphi " },
      { label: "ω", tex: "\\omega " },
    ],
  },
];

/**
 * T-02 - Ban phim ky hieu toan + preview KaTeX + copy LaTeX.
 * Chen TeX tai vi tri con tro cua textarea; caretBack dat con tro vao trong {}/() de go tiep.
 */
export function FormulaInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  const insert = (k: KeyDef) => {
    const el = taRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + k.tex + value.slice(end);
    onChange(next);
    const caret = start + k.tex.length - (k.caretBack ?? 0);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const previewHtml = (() => {
    const tex = value.replace(/\$/g, "").trim();
    if (!tex) return "";
    try {
      return katex.renderToString(normalizeMathTex(tex), {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return "";
    }
  })();

  const copy = async () => {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-1 space-y-2">
      <AutoGrowTextarea
        ref={taRef}
        className="w-full font-mono text-sm"
        rows={3}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="rounded-lg border bg-muted/30 p-2">
        <div className="flex flex-wrap gap-1">
          {GROUPS.map((g) => (
            <div key={g.name} className="flex flex-wrap items-center gap-1">
              <span className="mr-0.5 select-none text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {g.name}
              </span>
              {g.keys.map((k, i) => (
                <button
                  key={`${g.name}-${i}`}
                  type="button"
                  onClick={() => insert(k)}
                  title={k.tex.trim()}
                  className="min-w-7 rounded border bg-background px-1.5 py-0.5 text-sm hover:border-primary hover:bg-primary/5 active:scale-95"
                >
                  {k.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {value.trim() && (
        <div className="rounded-lg border bg-background p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Xem trước
            </span>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs hover:border-primary hover:bg-primary/5"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Đã chép" : "Chép LaTeX"}
            </button>
          </div>
          {previewHtml ? (
            <div
              className="overflow-x-auto py-1"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Chưa render được - kiểm tra lại cú pháp LaTeX.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
