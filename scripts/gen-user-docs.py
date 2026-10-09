#!/usr/bin/env python3
"""Generate DOCX + PPTX user documentation for So Chu Nhiem So.

Inputs (relative to repo docs/user-guide/):
  - MO-TA-CHUC-NANG.md   -> full content, section 1 of DOCX
  - HUONG-DAN-SU-DUNG.md -> full content, section 2 of DOCX (with screenshots)
Outputs:
  - SO-CHU-NHIEM-SO-TAI-LIEU.docx

Note: deck "gioi thieu chuc nang + huong dan" da gop vao
scripts/gen-user-guide-pptx.mjs -> docs/user-guide/USER-GUIDE-vieschool.pptx
"""
import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
UG = ROOT / "docs" / "user-guide"
IMG = UG / "images"

PRIMARY = RGBColor(0x1D, 0x4E, 0xD8)

INLINE = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]*\]\([^)]*\))")
IMG_RE = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$")


def add_runs(par, text):
    """Render **bold**, `code`, [text](url) inline into a docx paragraph."""
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith("**"):
            r = par.add_run(part[2:-2])
            r.bold = True
        elif part.startswith("`"):
            r = par.add_run(part[1:-1])
            r.font.name = "Consolas"
            r.font.size = Pt(9)
        elif part.startswith("["):
            m = re.match(r"\[([^\]]*)\]\(([^)]*)\)", part)
            par.add_run(m.group(1) if m else part)
        else:
            par.add_run(part)


def md_to_docx(doc, md_path, start_level_offset=0):
    lines = md_path.read_text(encoding="utf-8").splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip() or line.strip() == "---":
            i += 1
            continue

        # Headings
        m = re.match(r"^(#{1,4})\s+(.*)$", line)
        if m:
            lvl = min(len(m.group(1)) + start_level_offset, 4)
            h = doc.add_heading(level=lvl)
            add_runs(h, m.group(2))
            i += 1
            continue

        # Image
        m = IMG_RE.match(line.strip())
        if m:
            alt, rel = m.group(1), m.group(2)
            p = IMG.parent / rel if not rel.startswith("images/") else UG / rel
            if p.exists():
                doc.add_picture(str(p), width=Cm(15.5))
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
                cap = doc.add_paragraph()
                cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r = cap.add_run(alt or p.stem)
                r.italic = True
                r.font.size = Pt(9)
                r.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)
            else:
                doc.add_paragraph(f"[Thiếu ảnh: {rel}]")
            i += 1
            continue

        # Table block
        if line.lstrip().startswith("|"):
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{3,}:?", c or "---") for c in cells):
                    rows.append(cells)
                i += 1
            if rows:
                t = doc.add_table(rows=len(rows), cols=max(len(r) for r in rows))
                t.style = "Light Grid Accent 1"
                for ri, row in enumerate(rows):
                    for ci, cell in enumerate(row):
                        if ci < len(t.columns):
                            par = t.cell(ri, ci).paragraphs[0]
                            add_runs(par, cell)
                            for r in par.runs:
                                r.font.size = Pt(9)
                                if ri == 0:
                                    r.bold = True
            continue

        # Bullet / numbered list
        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", line)
        if m:
            style = "List Bullet" if m.group(2) in "-*" else "List Number"
            par = doc.add_paragraph(style=style)
            add_runs(par, m.group(3))
            i += 1
            continue

        # Quote
        if line.startswith(">"):
            par = doc.add_paragraph(style="Intense Quote")
            add_runs(par, line.lstrip("> "))
            i += 1
            continue

        par = doc.add_paragraph()
        add_runs(par, line)
        i += 1


def build_docx():
    doc = Document()
    # Page + base style
    for s in doc.sections:
        s.top_margin = s.bottom_margin = Cm(2)
        s.left_margin = s.right_margin = Cm(2)
    st = doc.styles["Normal"]
    st.font.name = "Calibri"
    st.font.size = Pt(10.5)
    for lvl in range(1, 5):
        hs = doc.styles[f"Heading {lvl}"]
        hs.font.color.rgb = PRIMARY
        hs.font.name = "Calibri"

    # Cover
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title.add_run("SỔ CHỦ NHIỆM SỐ")
    r.bold = True
    r.font.size = Pt(28)
    r.font.color.rgb = PRIMARY
    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run("Mô tả chức năng & Hướng dẫn sử dụng")
    r.font.size = Pt(16)
    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.add_run(
        "Phiên bản 1.0 - 21/09/2026\n"
        "Hệ thống: https://sochunhiem.vieschool.com\n"
        "Tài khoản demo: chọn vai trò tại màn hình đăng nhập - mật khẩu demo1234"
    )
    doc.add_page_break()

    doc.add_heading("Phần 1 - Mô tả chức năng", level=1)
    md_to_docx(doc, UG / "MO-TA-CHUC-NANG.md")
    doc.add_page_break()
    doc.add_heading("Phần 2 - Hướng dẫn sử dụng", level=1)
    md_to_docx(doc, UG / "HUONG-DAN-SU-DUNG.md")

    out = UG / "SO-CHU-NHIEM-SO-TAI-LIEU.docx"
    doc.save(out)
    return out


if __name__ == "__main__":
    d = build_docx()
    print(f"DOCX: {d} ({d.stat().st_size // 1024} KB)")
