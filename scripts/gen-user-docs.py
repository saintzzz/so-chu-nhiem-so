#!/usr/bin/env python3
"""Generate DOCX + PPTX user documentation for So Chu Nhiem So.

Inputs (relative to repo docs/user-guide/):
  - MO-TA-CHUC-NANG.md   -> full content, section 1 of DOCX
  - HUONG-DAN-SU-DUNG.md -> full content, section 2 of DOCX (with screenshots)
Outputs:
  - SO-CHU-NHIEM-SO-TAI-LIEU.docx
  - SO-CHU-NHIEM-SO-GIOI-THIEU.pptx
"""
import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor
from pptx import Presentation
from pptx.dml.color import RGBColor as PRGB
from pptx.util import Emu, Inches, Pt as PPt

ROOT = Path(__file__).resolve().parent.parent
UG = ROOT / "docs" / "user-guide"
IMG = UG / "images"

PRIMARY = RGBColor(0x1D, 0x4E, 0xD8)
ACCENT = PRGB(0x1D, 0x4E, 0xD8)
DARK = PRGB(0x1F, 0x29, 0x37)
GREY = PRGB(0x6B, 0x72, 0x80)

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
        "Hệ thống: https://so-chu-nhiem-so-theta.vercel.app\n"
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


# ---------- PPTX ----------
SW, SH = Inches(13.333), Inches(7.5)


def txbox(slide, l, t, w, h):
    tb = slide.shapes.add_textbox(l, t, w, h)
    tb.text_frame.word_wrap = True
    return tb


def add_text(tf, text, size=18, bold=False, color=DARK, bullet=False):
    p = tf.add_paragraph() if tf.paragraphs[0].text or len(tf.paragraphs) > 1 else tf.paragraphs[0]
    p.level = 0
    r = p.add_run()
    r.text = ("- " if bullet else "") + text
    r.font.size = PPt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    return p


def content_slide(prs, title, bullets, img=None, img_caption=""):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bar = s.shapes.add_shape(1, 0, 0, SW, Inches(0.12))
    bar.fill.solid(); bar.fill.fore_color.rgb = ACCENT; bar.line.fill.background()
    t = txbox(s, Inches(0.5), Inches(0.3), SW - Inches(1), Inches(0.9))
    add_text(t.text_frame, title, size=28, bold=True, color=ACCENT)
    tw = Inches(5.6) if img else SW - Inches(1)
    body = txbox(s, Inches(0.6), Inches(1.35), tw, SH - Inches(1.7))
    for b in bullets:
        add_text(body.text_frame, b, size=15, bullet=True)
    if img:
        p = IMG / img
        if p.exists():
            iw = Inches(6.6)
            pic = s.shapes.add_picture(str(p), SW - iw - Inches(0.5), Inches(1.35), width=iw)
            pic.line.color.rgb = PRGB(0xD1, 0xD5, 0xDB)
            if img_caption:
                c = txbox(s, SW - iw - Inches(0.5), Inches(1.35) + pic.height + Inches(0.05), iw, Inches(0.4))
                add_text(c.text_frame, img_caption, size=11, color=GREY)
    return s


def build_pptx():
    prs = Presentation()
    prs.slide_width = SW
    prs.slide_height = SH

    # Title
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.shapes.add_shape(1, 0, 0, SW, SH)
    bg.fill.solid(); bg.fill.fore_color.rgb = ACCENT; bg.line.fill.background()
    t = txbox(s, Inches(1), Inches(2.4), SW - Inches(2), Inches(2))
    add_text(t.text_frame, "SỔ CHỦ NHIỆM SỐ", size=44, bold=True, color=PRGB(0xFF, 0xFF, 0xFF))
    add_text(t.text_frame, "Nền tảng số hóa công tác chủ nhiệm & quản lý trường học", size=20, color=PRGB(0xDB, 0xEA, 0xFE))
    m = txbox(s, Inches(1), Inches(5.6), SW - Inches(2), Inches(1))
    add_text(m.text_frame, "https://so-chu-nhiem-so-theta.vercel.app - Demo: chọn vai trò, mật khẩu demo1234", size=14, color=PRGB(0xBF, 0xDB, 0xFE))

    content_slide(prs, "Tổng quan hệ thống", [
        "Số hóa toàn bộ sổ chủ nhiệm giấy: điểm danh, sổ đầu bài, sổ điểm, rèn luyện, tư vấn, liên lạc phụ huynh, hoạt động giáo dục, an toàn, thi đua, báo cáo",
        "Một dữ liệu nghiệp vụ - đồng bộ nhiều màn hình (vắng tiết học tự cập nhật điểm danh ngày)",
        "Phân quyền theo vai trò ở cả UI, route và Row-Level-Security",
        "Hỗ trợ Tiểu học / THCS / THPT, nhiều cơ sở (phân hiệu)",
        "AI 3 tuyến: LLM cấu hình được - Devin async - rule-based fallback",
        "Chuẩn TT22/2021: điểm thành phần hệ số 1-2-3, ĐTBm HK1/HK2/cả năm",
    ], img="02-gvcn-dashboard.png", img_caption="Dashboard giáo viên chủ nhiệm")

    # Roles table
    s = prs.slides.add_slide(prs.slide_layouts[6])
    t = txbox(s, Inches(0.5), Inches(0.3), SW - Inches(1), Inches(0.8))
    add_text(t.text_frame, "11 vai trò - phạm vi dữ liệu", size=28, bold=True, color=ACCENT)
    roles = [
        ("GVCN", "Lớp chủ nhiệm + lịch dạy cá nhân"), ("GVBM", "Điểm/sổ đầu bài đúng lớp-môn được phân công"),
        ("Tổ trưởng", "Duyệt giáo án, đánh giá năng lực"), ("BGH", "Toàn trường: ký sổ, phân công, duyệt, radar"),
        ("PHT", "Vận hành trường - không ký sổ/phân công"), ("Kế toán", "Nhân sự, CSVC, NQ37 - không xem hồ sơ HS"),
        ("Sở GD&ĐT", "Tổng hợp nhiều trường, quản trị"), ("Phòng GD/UBND", "Dashboard địa bàn"),
        ("Phụ huynh", "Con mình (nhiều con): tin nhắn, lịch hẹn, đăng ký"), ("Học sinh", "TKB, điểm, hạnh kiểu của mình"),
    ]
    tb = s.shapes.add_table(5, 4, Inches(0.6), Inches(1.3), SW - Inches(1.2), Inches(5.2)).table
    for i, (role, scope) in enumerate(roles):
        r, c = divmod(i, 2)
        tb.cell(r, c * 2).text = role
        tb.cell(r, c * 2 + 1).text = scope
        for cell in (tb.cell(r, c * 2), tb.cell(r, c * 2 + 1)):
            for p in cell.text_frame.paragraphs:
                for run in p.runs:
                    run.font.size = PPt(14)

    content_slide(prs, "Chuyên cần - điểm danh số", [
        "4 trạng thái/em: Có mặt, Vắng CP, Vắng KP, Đi muộn + ghi chú lý do ngay trên dòng",
        "Chọn ngày bất kỳ để xem lại / sửa điểm danh ngày cũ",
        "Sổ vắng-muộn và lịch sử theo khoảng ngày (from - to)",
        "Ma trận HS x ngày phát hiện vắng liên tục",
        "Thông báo phụ huynh tự động (email + in-app)",
        "Đồng bộ 2 chiều với sổ đầu bài tiết học",
    ], img="03-attendance-daily.png", img_caption="Điểm danh hàng ngày - 6 thẻ tổng + ghi chú vắng")

    content_slide(prs, "Sổ điểm giáo viên - chuẩn TT22", [
        "Cột điểm động: Miệng / 15 phút / 1 tiết (hệ số 1), Giữa kỳ (x2), Cuối kỳ (x3)",
        "Thêm/xóa cột tự do - mỗi GV tự cấu trúc sổ điểm của mình",
        "GV chỉ ghi điểm lớp + môn mình được phân công (RLS kiểm tra ở DB)",
        "Lưu điểm nguyên tử qua transaction - không mất dữ liệu khi lỗi giữa chừng",
        "ĐTBm tự tính đúng hệ số TT22, hiển thị HK1 / HK2 / cả năm",
        "Import/export Excel, tải template mẫu; môn nhận xét hiển thị Đạt / Chưa đạt",
    ], img="07-grades.png", img_caption="Sổ điểm cột động theo Thông tư 22")

    content_slide(prs, "Thời khóa biểu & Sổ đầu bài", [
        "2 chế độ: lịch cá nhân (mọi GV) + theo lớp (GVCN xem lớp CN, BGH toàn trường)",
        "Ô tiết cá nhân: lớp - môn - phòng; slot xung đột hiển thị đủ và cảnh báo",
        "Sổ đầu bài: chỉ GV được phân công tiết đó mới ghi - tiết người khác chỉ đọc",
        "Điểm danh theo tiết đồng bộ sang chuyên cần ngày",
        "Cộng/trừ điểm rèn luyện ngay trong sổ đầu bài",
        "BGH import TKB hàng loạt từ Excel",
    ], img="08-timetable-me.png", img_caption="Lịch dạy cá nhân")

    content_slide(prs, "Sơ đồ lớp & hồ sơ học sinh", [
        "Sơ đồ chỗ ngồi kéo-thả, thêm/bớt hàng cột linh hoạt",
        "Import danh sách HS Excel (mã HS quốc gia, dân tộc, hoàn cảnh)",
        "Chia tổ, ban cán sự, liên kết phụ huynh ngay trên danh sách",
        "Hồ sơ từng em: định danh, gia đình, sức khỏe - audit mọi thay đổi",
        "AI tổng hợp báo cáo hồ sơ lớp",
    ], img="11-seating.png", img_caption="Sơ đồ chỗ ngồi - resize hàng/cột")

    content_slide(prs, "Rèn luyện - Tư vấn - An toàn", [
        "Sổ rèn luyện: cộng/trừ điểm theo tiêu chí, nguồn từ sổ đầu bài / sự cố",
        "Tư vấn học sinh: hồ sơ phiên tư vấn, phân loại, theo dõi tiến triển",
        "Sự cố an toàn: 6 loại, 4 mức độ, báo cáo lên BGH, audit đầy đủ",
        "Thi đua tuần: chấm tiêu chí xếp hạng lớp",
        "AI đề xuất can thiệp theo hồ sơ",
    ], img="15-safety.png", img_caption="Sổ sự cố an toàn")

    content_slide(prs, "BGH - điều hành trường", [
        "Trung tâm phê duyệt: kế hoạch HĐ, giáo án, đánh giá - một nơi xử lý",
        "Radar cảnh báo sớm: lớp/HS rủi ro theo chuyên cần + điểm + sự cố",
        "Soạn + import TKB toàn trường, xem theo lớp",
        "Ký sổ chủ nhiệm: tạo đợt ký - duyệt/từ chối kèm lý do - ký hàng loạt; GVCN không tự ký",
        "Chỉ BGH phân công GVCN & lớp năm học",
        "Trợ lý AI điều hành hỏi-đáp trên dữ liệu thật",
    ], img="23-bgh-radar.png", img_caption="Radar cảnh báo sớm toàn trường")

    content_slide(prs, "Phụ huynh & Học sinh", [
        "Phụ huynh nhiều con: bộ chọn con trên đầu portal, dữ liệu tách theo từng em",
        "Nhắn tin 2 chiều với GVCN: soạn mới + trả lời, thấy cả tin đã gửi",
        "Đặt lịch hẹn trực tuyến - GVCN xác nhận",
        "Đăng ký / báo vắng hoạt động giáo dục cho con",
        "Học sinh: TKB, điểm số, hạnh kiểu, thông báo",
        "Mọi thao tác kiểm tra quyền sở hữu con ở server - không ghi được hồ sơ em khác",
    ], img="30-parent-portal.png", img_caption="Portal phụ huynh")

    content_slide(prs, "AI hỗ trợ - 3 tuyến dự phòng", [
        "Tuyến 1: LLM cấu hình qua env - Gemini / OpenAI / Anthropic, đổi provider bằng AI_PROVIDER + AI_MODEL",
        "Tuyến 2: Devin async - hết quota LLM thì tạo session xử lý, callback trả kết quả",
        "Tuyến 3: rule-based fallback - luôn có câu trả lời hữu ích kể cả khi mọi backend chết",
        "Ứng dụng: báo cáo hồ sơ lớp, nhận xét giáo án, gợi ý cảnh báo, trợ lý điều hành, phân tích sổ đầu bài, biên bản sinh hoạt, báo cáo Sở",
    ], img="25-bgh-ai.png", img_caption="Trợ lý AI điều hành của BGH")

    content_slide(prs, "Báo cáo & bảo mật", [
        "Xuất sổ chủ nhiệm, báo cáo Sở/Phòng (CSV/Excel), sổ cá nhân GV",
        "RBAC 3 tầng: UI - route guard - Postgres RLS theo vai trò + quan hệ (lớp CN, tiết dạy, con mình)",
        "Audit log mọi hành động quan trọng, trang xem cho BGH",
        "Trang Thông báo chung cho mọi vai trò - chuông trên topbar, đánh dấu đã đọc, link nhảy tới màn hình liên quan",
        "Responsive mobile, sắp xếp tên theo quy tắc Việt Nam",
    ], img="20-export.png", img_caption="Xuất sổ & báo cáo")

    # Closing
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.shapes.add_shape(1, 0, 0, SW, SH)
    bg.fill.solid(); bg.fill.fore_color.rgb = DARK; bg.line.fill.background()
    t = txbox(s, Inches(1), Inches(2.6), SW - Inches(2), Inches(2.5))
    add_text(t.text_frame, "Bắt đầu sử dụng", size=36, bold=True, color=PRGB(0xFF, 0xFF, 0xFF))
    add_text(t.text_frame, "https://so-chu-nhiem-so-theta.vercel.app", size=20, color=PRGB(0x93, 0xC5, 0xFD))
    add_text(t.text_frame, "Chọn vai trò demo tại màn hình đăng nhập - mật khẩu: demo1234", size=16, color=PRGB(0xD1, 0xD5, 0xDB))
    add_text(t.text_frame, "Tài liệu đầy đủ: docs/user-guide/SO-CHU-NHIEM-SO-TAI-LIEU.docx", size=14, color=PRGB(0x9C, 0xA3, 0xAF))

    out = UG / "SO-CHU-NHIEM-SO-GIOI-THIEU.pptx"
    prs.save(out)
    return out


if __name__ == "__main__":
    d = build_docx()
    p = build_pptx()
    print(f"DOCX: {d} ({d.stat().st_size // 1024} KB)")
    print(f"PPTX: {p} ({p.stat().st_size // 1024} KB)")
