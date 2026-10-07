"use client";

import { MathText, normalizeMathTex } from "@/components/tvc/math-text";
import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import type { DocContent, DocBlock, DocSection } from "@/types/tvc";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

const HAS_TEX = /\$[^$]+\$|\\\(|\\vec|\\frac|\\int|\\ce\{/;

/** Preview KaTeX nho duoi o nhap khi noi dung co cong thuc LaTeX. */
function TexPreview({ text, display = false }: { text: string; display?: boolean }) {
  if (!HAS_TEX.test(text)) return null;
  if (display) {
    let html = "";
    try {
      html = katex.renderToString(normalizeMathTex(text.replace(/\$/g, "")), {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      html = "";
    }
    if (!html) return null;
    return (
      <div
        className="relative mt-0.5 overflow-x-auto rounded bg-muted/40 px-2 py-1"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <div className="mt-0.5 rounded bg-muted/40 px-2 py-1 text-sm text-muted-foreground">
      <MathText text={text} />
    </div>
  );
}

/**
 * Editor có cấu trúc cho DocContent: sửa trực tiếp từng block trên khổ A4.
 * Preview khớp bố cục bản xuất (cùng class a4-sheet).
 */
export function DocEditor({
  doc,
  onChange,
  showAppendix = true,
}: {
  doc: DocContent;
  onChange: (d: DocContent) => void;
  showAppendix?: boolean;
}) {
  const setDoc = (patch: Partial<DocContent>) => onChange({ ...doc, ...patch });

  const setSection = (listKey: "sections" | "appendix", si: number, patch: Partial<DocSection>) => {
    const list = [...(doc[listKey] ?? [])];
    list[si] = { ...list[si], ...patch };
    setDoc({ [listKey]: list });
  };

  const setBlock = (listKey: "sections" | "appendix", si: number, bi: number, patch: Partial<DocBlock>) => {
    const list = [...(doc[listKey] ?? [])];
    const blocks = [...list[si].blocks];
    blocks[bi] = { ...blocks[bi], ...patch } as DocBlock;
    list[si] = { ...list[si], blocks };
    setDoc({ [listKey]: list });
  };

  const inp =
    "w-full rounded border border-transparent bg-transparent px-1 py-0.5 outline-none hover:border-border focus:border-primary focus:bg-background";
  const ta = `${inp} resize-y leading-relaxed`;

  const renderBlock = (listKey: "sections" | "appendix", si: number, b: DocBlock, bi: number) => {
    switch (b.kind) {
      case "heading":
        return (
          <>
            <input
              className={`${inp} font-semibold ${b.level === 1 ? "text-lg" : ""}`}
              value={b.text}
              onChange={(e) => setBlock(listKey, si, bi, { text: e.target.value })}
            />
            <TexPreview text={b.text} />
          </>
        );
      case "para":
        return (
          <>
            <AutoGrowTextarea
              className={ta}
              rows={Math.max(2, Math.ceil(b.text.length / 90))}
              value={b.text}
              onChange={(e) => setBlock(listKey, si, bi, { text: e.target.value })}
            />
            <TexPreview text={b.text} />
          </>
        );
      case "note":
        return (
          <>
            <AutoGrowTextarea
              className={`${ta} a4-note`}
              rows={2}
              value={b.text}
              onChange={(e) => setBlock(listKey, si, bi, { text: e.target.value })}
            />
            <TexPreview text={b.text} />
          </>
        );
      case "formula":
        return (
          <>
            <input
              className={`${inp} font-mono text-sm`}
              value={b.tex}
              onChange={(e) => setBlock(listKey, si, bi, { tex: e.target.value })}
            />
            <TexPreview text={b.tex} display />
          </>
        );
      case "list":
        return (
          <>
            <AutoGrowTextarea
              className={ta}
              rows={Math.max(3, b.items.length + 1)}
              value={b.items.join("\n")}
              onChange={(e) =>
                setBlock(listKey, si, bi, { items: e.target.value.split("\n") })
              }
            />
            {b.items.filter((it) => HAS_TEX.test(it)).length > 0 && (
              <div className="mt-0.5 rounded bg-muted/40 px-2 py-1 text-sm text-muted-foreground">
                <ul className="list-disc pl-5">
                  {b.items.map((it, i) => (
                    <li key={i}>
                      <MathText text={it} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        );
      case "table":
        return (
          <table>
            <thead>
              <tr>
                {b.header.map((h, j) => (
                  <th key={j} className="p-0">
                    <input
                      className={`${inp} font-semibold`}
                      value={h}
                      onChange={(e) => {
                        const header = [...b.header];
                        header[j] = e.target.value;
                        setBlock(listKey, si, bi, { header });
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="p-0">
                      <input
                        className={inp}
                        value={c}
                        onChange={(e) => {
                          const rows = b.rows.map((row) => [...row]);
                          rows[i][j] = e.target.value;
                          setBlock(listKey, si, bi, { rows });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "kv":
        return (
          <div className="a4-meta">
            {b.pairs.map(([k, v], i) => (
              <p key={i}>
                <strong>{k}:</strong>{" "}
                <input
                  className={inp}
                  value={v}
                  onChange={(e) => {
                    const pairs = b.pairs.map((p) => [...p] as [string, string]);
                    pairs[i][1] = e.target.value;
                    setBlock(listKey, si, bi, { pairs });
                  }}
                />
              </p>
            ))}
          </div>
        );
      case "divider":
        return <hr className="my-4 border-t" />;
    }
  };

  const renderSections = (listKey: "sections" | "appendix") =>
    (doc[listKey] ?? []).map((s, si) => (
      <section key={si} className={listKey === "appendix" ? "mt-6 border-t-2 border-dashed pt-4" : ""}>
        <input
          className={`${inp} text-base font-bold`}
          value={s.title}
          onChange={(e) => setSection(listKey, si, { title: e.target.value })}
        />
        {s.blocks.map((b, bi) => (
          <div key={bi} className="my-1">
            {renderBlock(listKey, si, b, bi)}
          </div>
        ))}
      </section>
    ));

  return (
    <div className="a4-sheet text-[15px]">
      <input
        className={`${inp} text-center text-2xl font-bold`}
        value={doc.title}
        onChange={(e) => setDoc({ title: e.target.value })}
      />
      {doc.meta && doc.meta.length > 0 && (
        <div className="a4-meta">
          {doc.meta.map(([k, v], i) => (
            <p key={i}>
              <strong>{k}:</strong>{" "}
              <input
                className={inp}
                value={v}
                onChange={(e) => {
                  const meta = doc.meta!.map((m) => [...m] as [string, string]);
                  meta[i][1] = e.target.value;
                  setDoc({ meta });
                }}
              />
            </p>
          ))}
        </div>
      )}
      {renderSections("sections")}
      {showAppendix && renderSections("appendix")}
    </div>
  );
}
