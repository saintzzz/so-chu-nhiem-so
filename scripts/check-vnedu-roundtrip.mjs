// CR-116-W3 round-trip test: VieSchool -> file mau-1 vnEdu -> parse lai.
// Assert khong mat truong quan trong khi di vong VieSchool -> vnEdu -> VieSchool.
// Chay: node --experimental-strip-types scripts/check-vnedu-roundtrip.mjs
// (Node >=22 co --experimental-strip-types; fallback dung tsx neu co.)
import { VNEDU_MAU1_HEADERS, SMAS_HEADERS, toVneduRow, toSmasRow, parseStudentTable } from "../src/lib/vnedu.ts";

const STUDENTS = [
  {
    code: "CVA00006",
    national_id: "00000000000000001234",
    full_name: "Nguyễn Văn An",
    dob: "2013-05-12",
    gender: "nam",
    address: "12 Nguyễn Trãi, Hà Nội",
    status: "active",
    parents: [
      { full_name: "Nguyễn Văn Bố", phone: "0912345678", email: "bo@example.com", relationship: "cha" },
      { full_name: "Trần Thị Mẹ", phone: "0987654321", email: null, relationship: "me" },
    ],
  },
  {
    code: "CVA00007",
    national_id: null,
    full_name: "Trần Thị Bình",
    dob: "2013-08-15",
    gender: "nu",
    address: null,
    status: "transferred",
    parents: [],
  },
];

// 1. Mo phong file export that: khoi tieu de + header + data (giong file
// vnEdu tai ve tu he thong).
const table = [
  ["PHÒNG GIÁO DỤC VÀ ĐÀO TẠO THÀNH PHỐ X"],
  ["TRƯỜNG THCS Y"],
  ["DANH SÁCH HỌC SINH LỚP 1A1 - NĂM HỌC 2025-2026"],
  [],
  [...VNEDU_MAU1_HEADERS],
  ...STUDENTS.map((s, i) => toVneduRow(s, i + 1)),
];

if (VNEDU_MAU1_HEADERS.length !== 26) {
  console.error(`FAIL: mau-1 phai co 26 cot, co ${VNEDU_MAU1_HEADERS.length}`);
  process.exit(1);
}

const parsed = parseStudentTable(table);
let fail = 0;
const check = (ok, msg) => {
  if (!ok) {
    fail++;
    console.error(`FAIL: ${msg}`);
  }
};

check(parsed.length === 2, `parse duoc 2 HS, duoc ${parsed.length}`);
const [a, b] = parsed;
check(a.errors.length === 0, `HS1 khong loi: ${a.errors.join(";")}`);
check(a.code === "CVA00006", `code round-trip (${a.code})`);
check(a.nationalId === "00000000000000001234", `ma VEMIS round-trip (${a.nationalId})`);
check(a.fullName === "Nguyễn Văn An", `ho ten (${a.fullName})`);
check(a.dob === "12/05/2013", `ngay sinh DD/MM/YYYY (${a.dob})`);
check(a.gender === "Nam", `gioi tinh (${a.gender})`);
check(a.address === "12 Nguyễn Trãi, Hà Nội", `dia chi (${a.address})`);
check(a.tenCha === "Nguyễn Văn Bố", `ten cha (${a.tenCha})`);
check(a.tenMe === "Trần Thị Mẹ", `ten me (${a.tenMe})`);
check(a.sdtPH === "0912345678", `sdt PH (${a.sdtPH})`);
check(a.emailPH === "bo@example.com", `email PH (${a.emailPH})`);
check(b.code === "CVA00007", `HS2 code (${b.code})`);
check(b.nationalId === "", `HS2 khong ma VEMIS giu trong (${b.nationalId})`);
check(b.errors.length === 0, `HS2 khong loi: ${b.errors.join(";")}`);

// 2. Truong hop file SMAS goc (khong title block, header khac).
const smas = [
  ["Mã học sinh", "Họ đệm", "Tên", "Ngày sinh", "Giới tính", "Chỗ ở hiện nay"],
  ["SMAS0001", "Lê Văn", "Cường", "2014-01-20", "Nam", "3 Lê Lợi"],
];
const ps = parseStudentTable(smas);
check(ps.length === 1 && ps[0].errors.length === 0, "file SMAS parse duoc");
check(ps[0]?.code === "SMAS0001", `SMAS ma hs -> code (${ps[0]?.code})`);
check(ps[0]?.fullName === "Lê Văn Cường", `SMAS ho dem + ten (${ps[0]?.fullName})`);

// 3. Round-trip SMAS: export -> parse lai (Ho dem + Ten tach cot).
const smasTable = [
  ["TRƯỜNG THCS Y"],
  ["DANH SÁCH HỌC SINH"],
  [],
  [...SMAS_HEADERS],
  ...STUDENTS.map((s, i) => toSmasRow(s, i + 1)),
];
check(SMAS_HEADERS.length === 19, `SMAS co 19 cot, co ${SMAS_HEADERS.length}`);
const smasParsed = parseStudentTable(smasTable);
check(smasParsed.length === 2, `SMAS parse 2 HS, duoc ${smasParsed.length}`);
check(smasParsed[0].errors.length === 0, `SMAS HS1 khong loi: ${smasParsed[0]?.errors}`);
check(smasParsed[0].code === "CVA00006", `SMAS code (${smasParsed[0]?.code})`);
check(smasParsed[0].nationalId === "00000000000000001234", `SMAS VEMIS (${smasParsed[0]?.nationalId})`);
check(smasParsed[0].fullName === "Nguyễn Văn An", `SMAS gop ten (${smasParsed[0]?.fullName})`);
check(smasParsed[0].tenCha === "Nguyễn Văn Bố", `SMAS ten cha (${smasParsed[0]?.tenCha})`);
check(smasParsed[0].sdtPH === "0912345678", `SMAS sdt (${smasParsed[0]?.sdtPH})`);

// 4. Kiem tra truong bi mat trong round-trip (bao cao ro, khong im lang).
const exported = toVneduRow(STUDENTS[1], 2);
const LOST = ["sdt PH khi khong co cha/me (contact trong)", "status chi hien o Ghi chu khi khac active"];
console.log(`\nINFO: truong khong round-trip duoc do mau-1 khong ho tro: ${LOST.join(", ")}`);
check(exported[25] === "Chuyển đi", `status -> Ghi chu (${exported[25]})`);

if (fail === 0) {
  console.log("\nPASS: round-trip VieSchool -> mau-1 vnEdu -> VieSchool khong mat du lieu dinh danh/ho ten/ngay sinh/gioi tinh/dia chi/phu huynh.");
} else {
  console.error(`\n${fail} check that bai.`);
  process.exit(1);
}
