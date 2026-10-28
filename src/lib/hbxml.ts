// CR-069: hoc ba XML (SCN-QD3016-v1) - pure builder + signature helpers.
import "server-only";
import { createHmac } from "node:crypto";
import type { YearEndBundle } from "@/lib/hocba";

const esc = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const num = (n: number | null) => (n == null ? "" : String(Math.round(n * 10) / 10));

/** XML base khong chua chu ky - chu ky gop khi download. */
export function buildHocBaXml(b: YearEndBundle, schoolName: string, yearName: string): string {
  const s = b.student;
  const mon = b.subjectRows
    .map((r) => {
      if (r.isComment) {
        return `    <Mon ten="${esc(r.name)}" hinhThuc="nhan_xet" hk1="${esc(r.resultHk1)}" hk2="${esc(r.resultHk2)}" caNam="${esc(r.resultYear)}"${r.isExempt ? ' mien="true"' : ""}/>`;
      }
      return `    <Mon ten="${esc(r.name)}" hk1="${num(r.hk1)}" hk2="${num(r.hk2)}" caNam="${num(r.cn)}"${r.isExempt ? ' mien="true"' : ""}/>`;
    })
    .join("\n");
  const nlpc = b.nlpcEvals
    .map((e) => `    <NangLuc ma="${esc(e.attribute_code)}" muc="${esc(e.level)}"/>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<HocBaDienTu version="1.0" schema="SCN-QD3016-v1">
  <HocSinh ma="${esc(s.code)}" ten="${esc(s.full_name)}" ngaySinh="${esc(s.dob)}" gioiTinh="${esc(s.gender)}" maDinhDanh="${esc(s.national_id)}"/>
  <Truong ten="${esc(schoolName)}" namHoc="${esc(yearName)}"/>
  <DiemHocTap>
${mon}
  </DiemHocTap>
  <RenLuyen hk1="${esc(b.conductHk1)}" hk2="${esc(b.conductHk2)}" nhanXet="${esc(b.conductComment)}"/>
  <NangLucPhamChat>
${nlpc}
  </NangLucPhamChat>
  <ChuyenCan vangCoPhep="${b.absentExcused}" vangKhongPhep="${b.absentUnexcused}" tongSoTiet="${b.absentTotal}"/>
  <KetQuaNam kqht="${esc(b.computed.kqht.value)}" kqrl="${esc(b.computed.kqrl.value)}" danhHieu="${esc(b.computed.danhHieu)}" xetLenLop="${esc(b.computed.promotion.value)}"/>
</HocBaDienTu>`;
}

/** Gop block ChuKy vao truoc </HocBaDienTu> khi download. */
export function withSignatures(
  xml: string,
  sigs: { gvcn?: { sig: string; by: string; at: string }; bgh?: { sig: string; by: string; at: string } },
): string {
  const parts: string[] = [];
  if (sigs.gvcn) parts.push(`    <GVCN sig="${sigs.gvcn.sig}" by="${esc(sigs.gvcn.by)}" at="${sigs.gvcn.at}"/>`);
  if (sigs.bgh) parts.push(`    <BGH sig="${sigs.bgh.sig}" by="${esc(sigs.bgh.by)}" at="${sigs.bgh.at}"/>`);
  if (!parts.length) return xml;
  return xml.replace("</HocBaDienTu>", `  <ChuKy>\n${parts.join("\n")}\n  </ChuKy>\n</HocBaDienTu>`);
}

const SECRET = () => process.env.HB_SIGNING_SECRET ?? "scn-hb-dev-secret";

/** Chu ky he thong HMAC-SHA256 tren (export_id|role|sha256_xml). */
export function signHash(exportId: string, role: "gvcn" | "bgh", sha: string): string {
  return createHmac("sha256", SECRET()).update(`${exportId}|${role}|${sha}`).digest("hex");
}
