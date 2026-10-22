---
name: doc-artifacts
description: Produce polished document deliverables - .docx reports, .pptx decks, .xlsx workbooks, .pdf exports - that look professionally templated, not raw dumps. Use whenever the user asks for a report, deck, proposal, invoice, handbook, or any Office/PDF file as a deliverable. Not for reading/parsing existing files (use markitdown/pandoc for that).
---

# Doc Artifacts - templated document deliverables

An agent-generated .docx/.pptx/.pdf that "renders" is not the bar. The bar is:
a document a designer would accept - consistent type scale, spacing rhythm,
brand tokens, correct tables, page numbers, and a title page when the doc is
a formal deliverable.

## Which library for which task

| Output | Library | Why |
|---|---|---|
| .docx new doc | `docx` (npm) | full control: sections, styles, TOC, headers/footers |
| .docx edit existing | unzip -> edit `word/document.xml` -> zip | docx-js cannot open existing files |
| .pptx new deck | `pptxgenjs` | layout + masters + notes; the de facto choice |
| .xlsx workbook | `exceljs` | styles, merges, formulas, conditional formats |
| .pdf | **Playwright: HTML -> `page.pdf()`** | design freedom = full CSS; far better than pdf-lib for anything visual |

Golden rule: **for visually rich PDFs, design in HTML/CSS and print via
Playwright** - do not fight pdf-lib's absolute positioning.

## Template-first workflow (mandatory)

1. **Read `DESIGN_SYSTEM.md` + `docs/MEMORY.md`** - brand tokens (colors,
   type, spacing) carry over. No design system yet? Establish a minimal one
   first (primary/secondary/neutral, 2 typefaces, type scale) - never emit
   unstyled default-template output.
2. **Build a template, not a one-off**: a `templates/` dir in the project
   with reusable builders (`build-report.mjs`, `build-deck.mjs`) so the NEXT
   document reuses it. One-off throwaway scripts are a defect.
3. **Content contract before render**: sections/data must come from real
   project artifacts (PRD, QA report, metrics) - never fabricate numbers.

## Footguns (learned the hard way upstream)

- docx-js: page size defaults to A4; tables need BOTH `columnWidths` and
  cell `width`; bullets need `bullet: { level }`, not unicode "•".
- pptxgenjs: define a `slideMaster` once (fonts, colors, footer) then use
  `layout: 'MASTER'` - re-styling every slide inline drifts.
- exceljs: set column widths explicitly or every column collapses.
- Playwright pdf: `printBackground: true` or your colors vanish;
  `format: 'A4'` + margins via `@page` CSS, not the API margins.

## Verification gate (same bar as code)

- Re-open the artifact: `pandoc`/`markitdown` for docx, unzip pptx and check
  slide count, or screenshot PDF pages via Playwright.
- Check: page numbers present, no text overflow/clipping on any page/slide,
  tables not split across page breaks mid-row, fonts embedded/rendered.
- Vietnamese copy rules apply (no em-dash/en-dash).
