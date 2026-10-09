"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import { MathText, normalizeMathTex } from "@/components/tvc/math-text";
import type { DocContent, DocBlock, DocSection } from "@/types/tvc";

function Formula({ tex }: { tex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(normalizeMathTex(tex), {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return null;
    }
  }, [tex]);
  if (!html) return <code className="block rounded bg-muted px-3 py-2 font-mono text-sm">{tex}</code>;
  return <div className="relative my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Block({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case "heading":
      if (block.level === 1) return <h2><MathText text={block.text} /></h2>;
      if (block.level === 2) return <h3><MathText text={block.text} /></h3>;
      return <h4 className="mt-3 font-semibold"><MathText text={block.text} /></h4>;
    case "para":
      return <p><MathText text={block.text} /></p>;
    case "list":
      return block.ordered ? (
        <ol>{block.items.map((it, i) => <li key={i}><MathText text={it} /></li>)}</ol>
      ) : (
        <ul>{block.items.map((it, i) => <li key={i}><MathText text={it} /></li>)}</ul>
      );
    case "table":
      return (
        <table>
          <thead>
            <tr>{block.header.map((h, i) => <th key={i}><MathText text={h} /></th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j}><MathText text={c} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      );
    case "formula":
      return <Formula tex={block.tex} />;
    case "kv":
      return (
        <div className="a4-meta">
          {block.pairs.map(([k, v], i) => (
            <p key={i}>
              <strong>{k}:</strong> <MathText text={v} />
            </p>
          ))}
        </div>
      );
    case "audio": {
      const src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tvc-media/${block.path}`;
      return (
        <figure className="my-3">
          <audio controls preload="none" src={src} className="w-full" />
          {block.caption && (
            <figcaption className="mt-1 text-xs text-muted-foreground">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "divider":
      return <hr className="my-4 border-t" />;
    case "note":
      return <div className="a4-note"><MathText text={block.text} /></div>;
    case "image": {
      // svg inline (figure spec da render) hoac anh storage public
      const src = block.path
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tvc-media/${block.path}`
        : undefined;
      return (
        <figure className="my-3 text-center">
          {block.svg ? (
            // img data-URI: svg tu DB khong the chay script (tranh stored XSS)
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(block.svg)}`}
              alt={block.caption ?? "hình minh họa"}
              className="mx-auto inline-block max-h-56"
            />
          ) : src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={block.caption ?? "hình minh họa"} className="mx-auto max-h-56" />
          ) : null}
          {block.caption && (
            <figcaption className="mt-1 text-xs text-muted-foreground">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
  }
}

function Section({ section }: { section: DocSection }) {
  return (
    <section>
      {section.title && <h2><MathText text={section.title} /></h2>}
      {section.blocks.map((b, i) => <Block key={i} block={b} />)}
    </section>
  );
}

/** Render DocContent vào khổ A4 (preview khớp bản xuất). */
export function DocRender({ doc, showAppendix = true }: { doc: DocContent; showAppendix?: boolean }) {
  return (
    <div className="a4-sheet text-[15px]">
      <h1><MathText text={doc.title} /></h1>
      {doc.meta && doc.meta.length > 0 && (
        <div className="a4-meta">
          {doc.meta.map(([k, v], i) => (
            <p key={i}>
              <strong>{k}:</strong> <MathText text={v} />
            </p>
          ))}
        </div>
      )}
      {doc.sections.map((s, i) => <Section key={i} section={s} />)}
      {showAppendix && doc.appendix?.map((s, i) => (
        <div key={i} className="mt-6 border-t-2 border-dashed pt-4">
          <Section section={s} />
        </div>
      ))}
    </div>
  );
}
