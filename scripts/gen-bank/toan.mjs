// ============================================================
// gen-bank/toan.mjs - Toan cap TH (lop 1-5), dap an deterministic.
// Map: ma YCCD -> ham gen(rng, stdId) -> [questions]
// ============================================================

export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const ri = (r, min, max) => min + Math.floor(r() * (max - min + 1));
const LET = ["A", "B", "C", "D"];

function mc(stem, opts, correctIdx) {
  return {
    stem: `${stem} ${opts.map((o, i) => `${LET[i]}. ${o}`).join(" ")}`,
    qtype: "multiple_choice",
    answer: { correct: LET[correctIdx] },
  };
}
function mcAuto(r, stem, correct, wrongs) {
  const opts = [correct, ...wrongs.slice(0, 3)];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return mc(stem, opts, opts.indexOf(correct));
}
function tf4(intro, items) {
  const lab = ["a", "b", "c", "d"];
  return {
    stem: `${intro}\n${items.map((x, i) => `${lab[i]}) ${x.t}`).join("\n")}`,
    qtype: "true_false_4",
    answer: { correct: items.map((x, i) => `${lab[i]}-${x.ok ? "Đúng" : "Sai"}`).join(", ") },
  };
}
const sa = (stem, correct, solution) => ({ stem, qtype: "short_answer", answer: { correct }, solution });
const tl = (stem, solution) => ({ stem, qtype: "essay", answer: {}, solution });

const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const frac = (a, b) => `$\\frac{${a}}{${b}}$`;
const dec = (n) => String(n).replace(".", ",");
const NAMES = ["Lan", "Nam", "Hoa", "Minh", "An", "Mai", "Hùng", "Linh", "Tuấn", "Hà", "Vy", "Đức"];
const OBJ = ["quyển vở", "cái kẹo", "quả táo", "bông hoa", "viên bi", "nhãn vở", "quyển sách", "cái bánh"];

const PTS = { multiple_choice: 0.5, true_false_4: 1, short_answer: 0.5, essay: 3 };
const Q = (stdId, grade, level, q) => ({
  ...q, standard_ids: [stdId], subject_code: "toan", grade, level, points: PTS[q.qtype],
});

function near(r, correct, n = 3) {
  const set = new Set();
  let g = 0;
  while (set.size < n && g++ < 80) {
    const d = correct + (r() < 0.5 ? -1 : 1) * ri(r, 1, Math.max(2, Math.round(Math.abs(correct) * 0.2) + 1));
    if (d !== correct && d > 0) set.add(d);
  }
  return [...set];
}
const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

// ============================================================
// LOP 1
// ============================================================
function* g111(r) {
  // TOAN1.1.1 so trong pham vi 10 / so 2 chu so
  for (let i = 0; i < 12; i++) {
    const n = ri(r, 2, 20);
    yield ["biet", sa(`Số liền sau của ${n} là số nào?`, `${n + 1}`, `Số liền sau của ${n} là ${n + 1}.`)];
    yield ["biet", sa(`Số liền trước của ${n} là số nào?`, `${n - 1}`, `Số liền trước của ${n} là ${n - 1}.`)];
  }
  for (let i = 0; i < 12; i++) {
    const a = ri(r, 1, 9), b = ri(r, 0, 9);
    yield ["hieu", mcAuto(r, `Số gồm ${a} chục và ${b} đơn vị là:`,
      `${a * 10 + b}`, [`${b * 10 + a}`, `${a * 10}`, `${a * 10 + b + 1}`])];
  }
  for (let i = 0; i < 12; i++) {
    const arr = [...new Set([ri(r, 3, 20), ri(r, 3, 20), ri(r, 3, 20), ri(r, 3, 20)])];
    if (arr.length < 4) continue;
    const mx = Math.max(...arr), mn = Math.min(...arr);
    yield ["hieu", mcAuto(r, `Số lớn nhất trong các số ${arr.join(", ")} là:`, `${mx}`, arr.filter((x) => x !== mx).map(String))];
    yield ["hieu", mcAuto(r, `Số bé nhất trong các số ${arr.join(", ")} là:`, `${mn}`, arr.filter((x) => x !== mn).map(String))];
  }
  for (let i = 0; i < 6; i++) {
    const a = ri(r, 3, 15), b = a + ri(r, 1, 4);
    yield ["van_dung", tf4(`Cho hai số ${a} và ${b}. Nhận định nào đúng, nhận định nào sai?`, [
      { t: `${b} lớn hơn ${a}`, ok: true },
      { t: `${a} lớn hơn ${b}`, ok: false },
      { t: `Hiệu của ${b} và ${a} là ${b - a}`, ok: true },
      { t: `Số liền sau của ${a} là ${a + 2}`, ok: false },
    ])];
  }
}
function* g112(r) {
  // TOAN1.1.2 cong tru pham vi 10, khong nho <=100
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 1, 9), b = ri(r, 1, 10 - a);
    yield ["biet", sa(`Tính: ${a} + ${b} = ?`, `${a + b}`, `${a} + ${b} = ${a + b}`)];
    const c = ri(r, 4, 10), d = ri(r, 1, c - 1);
    yield ["biet", sa(`Tính: ${c} - ${d} = ?`, `${c - d}`, `${c} - ${d} = ${c - d}`)];
  }
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 11, 69), b = ri(r, 1, 8);
    if ((a % 10) + b < 10) yield ["hieu", mcAuto(r, `${a} + ${b} = ?`, `${a + b}`, near(r, a + b).map(String))];
    const c = ri(r, 15, 89), d = ri(r, 1, 8);
    if (c % 10 >= d) yield ["hieu", mcAuto(r, `${c} - ${d} = ?`, `${c - d}`, near(r, c - d).map(String))];
  }
  for (let i = 0; i < 10; i++) {
    const a = ri(r, 2, 7), b = ri(r, 1, 8 - a), c = ri(r, 1, 9);
    yield ["van_dung", sa(`Điền số thích hợp vào chỗ chấm: ${a} + ${b} + ${c} = ...`, `${a + b + c}`,
      `${a} + ${b} + ${c} = ${a + b} + ${c} = ${a + b + c}`)];
  }
}
function* g113(r) {
  // TOAN1.1.3 y nghia phep cong tru - toan loi
  for (let i = 0; i < 15; i++) {
    const n = pick(r, NAMES), o = pick(r, OBJ), a = ri(r, 2, 8), b = ri(r, 1, 7);
    yield ["van_dung", tl(`${n} có ${a} ${o}. Mẹ mua thêm ${b} ${o} nữa. Hỏi ${n} có tất cả bao nhiêu ${o}?`,
      `Phép tính: ${a} + ${b} = ${a + b}. Đáp số: ${a + b} ${o}.`)];
    if (a > b)
      yield ["van_dung", tl(`${n} có ${a} ${o}, cho bạn ${b} ${o}. Hỏi ${n} còn lại bao nhiêu ${o}?`,
        `Phép tính: ${a} - ${b} = ${a - b}. Đáp số: ${a - b} ${o}.`)];
  }
}
function* g121(r) {
  // TOAN1.2.1 nhan biet hinh
  const map = {
    "hình vuông": ["viên gạch lát nền hình vuông", "khung ảnh hình vuông"],
    "hình tròn": ["cái đĩa", "đồng xu", "mặt đồng hồ tròn"],
    "hình tam giác": ["thước ê ke", "biển báo tam giác"],
    "hình chữ nhật": ["quyển vở", "mặt bàn học", "cửa sổ"],
  };
  for (let i = 0; i < 12; i++) {
    const h = pick(r, Object.keys(map));
    yield ["biet", mcAuto(r, `Đồ vật nào sau đây có dạng ${h}?`,
      pick(r, map[h]), Object.keys(map).filter((x) => x !== h).map((x) => pick(r, map[x])))];
  }
  yield ["hieu", tf4(`Nhận định nào sau đây đúng, nhận định nào sai?`, [
    { t: "Hình tam giác có 3 đỉnh", ok: true },
    { t: "Hình tròn có 4 cạnh", ok: false },
    { t: "Hình vuông có 4 cạnh bằng nhau", ok: true },
    { t: "Hình chữ nhật có 4 góc vuông", ok: true },
  ])];
  yield ["hieu", tf4(`Nhận định nào sau đây đúng, nhận định nào sai?`, [
    { t: "Hình vuông có 3 góc", ok: false },
    { t: "Quả bóng có dạng hình tròn", ok: true },
    { t: "Hình tam giác có 3 cạnh", ok: true },
    { t: "Quyển vở có dạng hình tam giác", ok: false },
  ])];
}
function* g122(r) {
  // TOAN1.2.2 do dai cm
  for (let i = 0; i < 12; i++) {
    const a = ri(r, 3, 15), b = ri(r, 3, 15);
    if (a === b) continue;
    yield ["hieu", mcAuto(r, `Đoạn dây thứ nhất dài ${a} cm, đoạn dây thứ hai dài ${b} cm. Đoạn dây nào dài hơn?`,
      a > b ? "Đoạn dây thứ nhất" : "Đoạn dây thứ hai",
      [a > b ? "Đoạn dây thứ hai" : "Đoạn dây thứ nhất", "Hai đoạn bằng nhau", "Không so sánh được"])];
  }
  for (let i = 0; i < 8; i++) {
    const a = ri(r, 2, 9);
    yield ["biet", sa(`Gang tay của em dài khoảng ${a} cm. Hai gang tay dài khoảng bao nhiêu xăng-ti-mét?`,
      `${a * 2}`, `${a} + ${a} = ${a * 2} cm`)];
  }
}
function* g131(r) {
  // TOAN1.3.1 van dung thuc te
  for (let i = 0; i < 12; i++) {
    const n = pick(r, NAMES), o = pick(r, OBJ), a = ri(r, 5, 10), b = ri(r, 1, a - 2);
    yield ["van_dung", sa(`${n} có ${a} ${o}, ${n} cho bạn ${b} ${o}. Hỏi ${n} còn lại bao nhiêu ${o}?`,
      `${a - b}`, `${a} - ${b} = ${a - b}. Còn lại ${a - b} ${o}.`)];
  }
  for (let i = 0; i < 8; i++) {
    const a = ri(r, 2, 8), b = ri(r, 2, 8);
    yield ["van_dung_cao", tl(`Trên cành cây có ${a + b} con chim. Bay đi ${b} con. Hỏi còn lại bao nhiêu con chim trên cành?`,
      `Phép tính: ${a + b} - ${b} = ${a}. Đáp số: ${a} con chim.`)];
  }
}

// ============================================================
// LOP 2
// ============================================================
function* g211(r) {
  // TOAN2.1.1 so den 1000
  for (let i = 0; i < 15; i++) {
    const n = ri(r, 100, 999);
    const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
    yield ["biet", sa(`Viết số gồm ${h} trăm, ${t} chục và ${u} đơn vị.`, `${n}`,
      `${h} trăm + ${t} chục + ${u} đơn vị = ${n}`)];
    const m = ri(r, 100, 999);
    if (m !== n) yield ["biet", sa(`So sánh hai số: ${n} và ${m} (điền dấu >, < hoặc =).`, n > m ? ">" : "<",
      `${n} ${n > m ? ">" : "<"} ${m}`)];
  }
  for (let i = 0; i < 12; i++) {
    const arr = [...new Set([ri(r, 100, 999), ri(r, 100, 999), ri(r, 100, 999), ri(r, 100, 999)])];
    if (arr.length < 4) continue;
    const sorted = [...arr].sort((x, y) => x - y);
    yield ["hieu", mcAuto(r, `Số lớn nhất trong các số ${arr.join(", ")} là:`,
      `${sorted[3]}`, arr.filter((x) => x !== sorted[3]).map(String))];
    yield ["hieu", sa(`Sắp xếp các số ${arr.join(", ")} theo thứ tự từ bé đến lớn.`, sorted.join(", "),
      `So sánh từng hàng: trăm rồi đến chục, đơn vị. Thứ tự: ${sorted.join(", ")}`)];
  }
  for (let i = 0; i < 8; i++) {
    const n = ri(r, 110, 990);
    yield ["van_dung", tf4(`Cho số ${n}. Nhận định nào đúng, nhận định nào sai?`, [
      { t: `Chữ số hàng trăm là ${Math.floor(n / 100)}`, ok: true },
      { t: `Chữ số hàng chục là ${n % 10}`, ok: false },
      { t: `${n} = ${Math.floor(n / 100)}00 + ${n % 100}`, ok: true },
      { t: `Số liền sau của ${n} là ${n + 1}`, ok: true },
    ])];
  }
}
function* g212(r) {
  // TOAN2.1.2 cong tru co nho <=100, khong nho <=1000
  for (let i = 0; i < 20; i++) {
    const a = ri(r, 25, 89), b = ri(r, 15, 95 - a);
    if ((a % 10) + (b % 10) >= 10)
      yield ["biet", sa(`Đặt tính rồi tính: ${a} + ${b} = ?`, `${a + b}`, `${a} + ${b} = ${a + b}`)];
    const c = ri(r, 40, 99), d = ri(r, 15, c - 10);
    if (c % 10 < d % 10)
      yield ["biet", sa(`Đặt tính rồi tính: ${c} - ${d} = ?`, `${c - d}`, `${c} - ${d} = ${c - d}`)];
  }
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 120, 800), b = ri(r, 100, 199);
    yield ["hieu", mcAuto(r, `Tính nhẩm: ${a} + ${b} = ?`, `${a + b}`, near(r, a + b).map(String))];
    const c = ri(r, 300, 999), d = ri(r, 100, 280);
    yield ["hieu", mcAuto(r, `Tính nhẩm: ${c} - ${d} = ?`, `${c - d}`, near(r, c - d).map(String))];
  }
  for (let i = 0; i < 10; i++) {
    const a = ri(r, 30, 60), b = ri(r, 10, 29), c = ri(r, 10, Math.min(30, a + b - 1));
    yield ["van_dung", sa(`Tính: ${a} + ${b} - ${c} = ?`, `${a + b - c}`, `${a} + ${b} = ${a + b}; ${a + b} - ${c} = ${a + b - c}`)];
  }
}
function* g213(r) {
  // TOAN2.1.3 nhan chia 2 va 5
  for (let i = 0; i < 20; i++) {
    const m = pick(r, [2, 5]), k = ri(r, 2, 9);
    yield ["biet", sa(`Tính: ${m} × ${k} = ?`, `${m * k}`, `${m} × ${k} = ${m * k}`)];
    yield ["biet", sa(`Tính: ${m * k} : ${m} = ?`, `${k}`, `${m * k} : ${m} = ${k}`)];
  }
  for (let i = 0; i < 10; i++) {
    const m = pick(r, [2, 5]), k = ri(r, 2, 9);
    yield ["hieu", mcAuto(r, `Phép cộng ${m} + ${m} + ${m} + ${m} được viết thành phép nhân là:`,
      `${m} × 4`, [`${m} × 3`, `4 + ${m}`, `${m} × 5`])];
    yield ["van_dung", sa(`Có ${m * k} cái kẹo chia đều cho ${k} bạn. Mỗi bạn được bao nhiêu cái kẹo?`,
      `${m}`, `${m * k} : ${k} = ${m}. Mỗi bạn được ${m} cái kẹo.`)];
  }
  for (let i = 0; i < 8; i++) {
    const m = pick(r, [2, 5]), k = ri(r, 2, 9);
    yield ["van_dung", tl(`Mỗi hộp có ${m} bút chì. Hỏi ${k} hộp như thế có tất cả bao nhiêu bút chì?`,
      `Phép tính: ${m} × ${k} = ${m * k}. Đáp số: ${m * k} bút chì.`)];
  }
}
function* g221(r) {
  // TOAN2.2.1 diem, duong thang, doan thang
  const qs = [
    ["Ba điểm thẳng hàng là ba điểm:", "cùng nằm trên một đường thẳng", ["tạo thành hình tam giác", "nằm trên hai đường thẳng khác nhau", "luôn cách đều nhau"]],
    ["Đoạn thẳng khác đường thẳng ở chỗ:", "đoạn thẳng có hai đầu mút", ["đoạn thẳng dài vô hạn", "đường thẳng có hai đầu mút", "không có gì khác nhau"]],
    ["Đường gấp khúc gồm:", "nhiều đoạn thẳng nối tiếp nhau", ["một đường thẳng duy nhất", "chỉ hai điểm", "các đường cong"]],
    ["Điểm ở giữa hai điểm A và B là điểm:", "nằm giữa A và B trên đường thẳng nối chúng", ["nằm ngoài đoạn AB", "trùng với điểm A", "xa A nhất"]],
  ];
  for (const [stem, c, w] of qs) yield ["biet", mcAuto(r, stem, c, w)];
  const qs2 = [
    ["Đường thẳng có mấy đầu mút?", "Không có đầu mút nào", ["1 đầu mút", "2 đầu mút", "3 đầu mút"]],
    ["Qua hai điểm cho trước, ta vẽ được:", "chỉ một đoạn thẳng", ["hai đoạn thẳng", "vô số đoạn thẳng", "không đoạn nào"]],
    ["Hình chữ nhật có mấy góc vuông?", "4 góc vuông", ["2 góc vuông", "3 góc vuông", "1 góc vuông"]],
    ["Đường gấp khúc ABCD gồm mấy đoạn thẳng?", "3 đoạn", ["2 đoạn", "4 đoạn", "5 đoạn"]],
    ["Trong ba điểm A, B, C thẳng hàng, điểm B ở giữa nghĩa là:", "A-B-C nằm trên một đường thẳng theo thứ tự", ["B xa nhất", "B trùng A", "A và C trùng nhau"]],
    ["Độ dài đường gấp khúc bằng:", "tổng độ dài các đoạn thẳng của nó", ["đoạn dài nhất", "đoạn ngắn nhất", "hiệu hai đoạn"]],
  ];
  for (const [stem, c, w] of qs2) yield ["biet", mcAuto(r, stem, c, w)];
  for (let i = 0; i < 12; i++) {
    const a = ri(r, 2, 15), b = ri(r, 2, 15), c = ri(r, 2, 15);
    yield ["hieu", sa(`Đường gấp khúc gồm 3 đoạn thẳng có độ dài lần lượt ${a} cm, ${b} cm, ${c} cm. Tính độ dài đường gấp khúc.`,
      `${a + b + c}`, `${a} + ${b} + ${c} = ${a + b + c} cm`)];
  }
  yield ["hieu", tf4(`Nhận định nào đúng, nhận định nào sai?`, [
    { t: "Đường thẳng kéo dài mãi về hai phía", ok: true },
    { t: "Đoạn thẳng không có đầu mút", ok: false },
    { t: "Ba điểm bất kì luôn thẳng hàng", ok: false },
    { t: "Đường gấp khúc có thể gồm 3 đoạn thẳng", ok: true },
  ])];
  yield ["hieu", tf4(`Nhận định nào đúng, nhận định nào sai?`, [
    { t: "Đoạn thẳng có 2 đầu mút", ok: true },
    { t: "Đường thẳng có 2 đầu mút", ok: false },
    { t: "Đường gấp khúc là đường thẳng", ok: false },
    { t: "Hình tam giác có 3 cạnh", ok: true },
  ])];
}
function* g222(r) {
  // TOAN2.2.2 dm/m, gio phut, ngay thang
  for (let i = 0; i < 15; i++) {
    const kind = i % 3;
    if (kind === 0) {
      const n = ri(r, 2, 9);
      yield ["biet", sa(`Đổi: ${n} dm = ? cm`, `${n * 10}`, `${n} dm = ${n} × 10 = ${n * 10} cm`)];
      yield ["biet", sa(`Đổi: ${n} m = ? dm`, `${n * 10}`, `${n} m = ${n * 10} dm`)];
    } else if (kind === 1) {
      const a = ri(r, 12, 98);
      yield ["hieu", mcAuto(r, `${a} cm bằng:`,
        `${Math.floor(a / 10)} dm ${a % 10} cm`,
        [`${a % 10} dm ${Math.floor(a / 10)} cm`, `${a} dm`, `${Math.floor(a / 10)} dm ${Math.floor(a / 10)} cm`])];
    } else {
      const a = ri(r, 20, 90), b = ri(r, 5, 15);
      yield ["van_dung", sa(`Sợi dây dài ${a} cm, cắt đi ${b} cm. Sợi dây còn lại dài bao nhiêu xăng-ti-mét?`,
        `${a - b}`, `${a} - ${b} = ${a - b} cm`)];
    }
  }
  for (let i = 0; i < 10; i++) {
    const h = ri(r, 1, 12);
    yield ["biet", sa(`Một ngày có bao nhiêu giờ?`, `24`, `Một ngày có 24 giờ.`)];
    yield ["hieu", mcAuto(r, `Khi kim giờ chỉ số ${h}, kim phút chỉ số 12, đồng hồ chỉ:`,
      `${h} giờ`, [`${h} giờ 30 phút`, `12 giờ ${h} phút`, `${h + 1} giờ`])];
  }
}
function* g231(r) {
  // TOAN2.3.1 thong ke don gian
  for (let i = 0; i < 10; i++) {
    const a = ri(r, 4, 12), b = ri(r, 4, 12), c = ri(r, 4, 12);
    yield ["van_dung", sa(`Lớp 2A khảo sát môn yêu thích: bóng đá ${a} bạn, bơi ${b} bạn, cầu lông ${c} bạn. Tổng số bạn tham gia khảo sát là bao nhiêu?`,
      `${a + b + c}`, `${a} + ${b} + ${c} = ${a + b + c} bạn`)];
    yield ["hieu", mcAuto(r, `Số bạn thích bóng đá ${a}, bơi ${b}, cầu lông ${c}. Môn được thích nhất là:`,
      a >= b && a >= c ? "Bóng đá" : b >= c ? "Bơi" : "Cầu lông",
      ["Bóng đá", "Bơi", "Cầu lông"].filter((x) => x !== (a >= b && a >= c ? "Bóng đá" : b >= c ? "Bơi" : "Cầu lông")))];
  }
}
function* g241(r) {
  // TOAN2.4.1 tien, gio, lich thuc hanh
  for (let i = 0; i < 12; i++) {
    const a = ri(r, 2, 9), b = ri(r, 2, 9);
    yield ["van_dung", sa(`${pick(r, NAMES)} có ${a} tờ 10 000 đồng. Hỏi bạn có tất cả bao nhiêu nghìn đồng?`,
      `${a * 10}`, `${a} × 10 = ${a * 10} nghìn đồng`)];
    yield ["van_dung", tl(`Một quyển vở giá ${b} nghìn đồng. Mẹ đưa ${pick(r, NAMES)} tờ 10 nghìn đồng để mua. Hỏi còn thừa bao nhiêu nghìn đồng?`,
      b < 10 ? `Phép tính: 10 - ${b} = ${10 - b}. Đáp số: ${10 - b} nghìn đồng.` : `Phép tính: 10 - ${b % 10} = ${10 - (b % 10)}. Đáp số: ${10 - (b % 10)} nghìn đồng.`)];
  }
}

// ============================================================
// LOP 3
// ============================================================
function* g311(r) {
  // TOAN3.1.1 so den 100 000
  for (let i = 0; i < 15; i++) {
    const n = ri(r, 10000, 99999);
    const [h, t, u] = [Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
    yield ["biet", sa(`Viết số gồm ${Math.floor(n / 10000)} chục nghìn, ${Math.floor(n / 1000) % 10} nghìn, ${h} trăm, ${t} chục và ${u} đơn vị.`,
      `${n}`, `Số cần tìm là ${fmt(n)}`)];
  }
  for (let i = 0; i < 12; i++) {
    const a = ri(r, 10000, 99999), b = ri(r, 10000, 99999);
    if (a === b) continue;
    yield ["biet", sa(`So sánh: ${fmt(a)} ... ${fmt(b)} (điền >, < hoặc =)`, a > b ? ">" : "<",
      `So sánh từ hàng chục nghìn: ${fmt(a)} ${a > b ? ">" : "<"} ${fmt(b)}`)];
  }
  for (let i = 0; i < 10; i++) {
    const arr = [...new Set([ri(r, 10000, 99999), ri(r, 10000, 99999), ri(r, 10000, 99999), ri(r, 10000, 99999)])];
    if (arr.length < 4) continue;
    const mx = Math.max(...arr);
    yield ["hieu", mcAuto(r, `Số lớn nhất trong các số ${arr.map(fmt).join(", ")} là:`,
      fmt(mx), arr.filter((x) => x !== mx).map(fmt))];
  }
}
function* g312(r) {
  // TOAN3.1.2 lam tron
  for (let i = 0; i < 15; i++) {
    const n = ri(r, 101, 9999);
    const to10 = Math.round(n / 10) * 10;
    yield ["biet", sa(`Làm tròn số ${fmt(n)} đến hàng chục.`, `${fmt(to10)}`,
      `Chữ số hàng đơn vị là ${n % 10} ${n % 10 < 5 ? "< 5 nên làm tròn xuống" : "≥ 5 nên làm tròn lên"}: ${fmt(to10)}`)];
    const to100 = Math.round(n / 100) * 100;
    yield ["hieu", mcAuto(r, `Làm tròn số ${fmt(n)} đến hàng trăm ta được:`,
      fmt(to100), [fmt(to100 + 100), fmt(to100 - 100), fmt(to10)].filter((x) => x !== fmt(to100)).slice(0, 3))];
  }
}
function* g313(r) {
  // TOAN3.1.3 cong tru <=100000, nhan 4cs x 1cs, chia
  for (let i = 0; i < 20; i++) {
    const a = ri(r, 10000, 89999), b = ri(r, 1000, 9999);
    yield ["biet", sa(`Đặt tính rồi tính: ${fmt(a)} + ${fmt(b)} = ?`, `${fmt(a + b)}`, `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}`)];
    yield ["biet", sa(`Đặt tính rồi tính: ${fmt(a)} - ${fmt(b)} = ?`, `${fmt(a - b)}`, `${fmt(a)} - ${fmt(b)} = ${fmt(a - b)}`)];
  }
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 1000, 9999), b = ri(r, 2, 9);
    yield ["hieu", mcAuto(r, `${fmt(a)} × ${b} = ?`, fmt(a * b), near(r, a * b).map(fmt))];
    const d = ri(r, 2, 9), k = ri(r, 100, 2000);
    yield ["hieu", sa(`Tính: ${fmt(d * k)} : ${d} = ?`, `${fmt(k)}`, `${fmt(d * k)} : ${d} = ${fmt(k)}`)];
  }
  for (let i = 0; i < 8; i++) {
    const b = ri(r, 3, 8), m = ri(r, 200, 900);
    const a = b * m;
    yield ["van_dung", tl(`Một cửa hàng có ${fmt(a)} kg gạo, chia đều vào ${b} bao. Hỏi mỗi bao có bao nhiêu ki-lô-gam gạo?`,
      `Phép tính: ${fmt(a)} : ${b} = ${fmt(m)}. Đáp số: ${fmt(m)} kg.`)];
  }
}
function* g314(r) {
  // TOAN3.1.4 bieu thuc 2 phep tinh
  for (let i = 0; i < 20; i++) {
    const kind = i % 4;
    const a = ri(r, 10, 500), b = ri(r, 2, 9), c = ri(r, 5, 100);
    if (kind === 0)
      yield ["hieu", sa(`Tính giá trị biểu thức: ${a} + ${b} × ${c} = ?`, `${a + b * c}`,
        `Nhân trước: ${b} × ${c} = ${b * c}; ${a} + ${b * c} = ${a + b * c}`)];
    if (kind === 1)
      yield ["hieu", sa(`Tính giá trị biểu thức: (${a} + ${c}) × ${b} = ?`, `${(a + c) * b}`,
        `Trong ngoặc trước: ${a} + ${c} = ${a + c}; ${a + c} × ${b} = ${(a + c) * b}`)];
    if (kind === 2) {
      const k = ri(r, 2, 9), m = ri(r, 2, 9);
      yield ["van_dung", sa(`Tính: ${k * m * 10} : ${m} + ${k} = ?`, `${k * 10 + k}`,
        `${k * m * 10} : ${m} = ${k * 10}; ${k * 10} + ${k} = ${k * 10 + k}`)];
    }
    if (kind === 3 && a > c * b)
      yield ["hieu", mcAuto(r, `Giá trị của biểu thức ${a} - ${c} × ${b} là:`, `${a - c * b}`,
        [`${(a - c) * b}`, `${a - c - b}`, `${a * b - c}`].filter((x) => +x >= 0 && x !== `${a - c * b}`).map(String).slice(0, 3))];
  }
}
function* g315(r) {
  // TOAN3.1.5 phan so don gian qua hinh anh
  const parts = [[1, 2, "một phần hai"], [1, 3, "một phần ba"], [1, 4, "một phần tư"], [1, 5, "một phần năm"], [1, 6, "một phần sáu"]];
  for (let i = 0; i < 12; i++) {
    const [a, b, w] = pick(r, parts);
    yield ["biet", mcAuto(r, `Hình chữ nhật được chia thành ${b} phần bằng nhau, tô màu ${a} phần. Đã tô màu ${frac(a, b)} hình chữ nhật. Phân số ${frac(a, b)} đọc là:`,
      w, parts.filter((x) => x[2] !== w).map((x) => x[2]))];
    yield ["hieu", sa(`Một hình tròn chia thành ${b} phần bằng nhau, tô màu ${a} phần. Viết phân số chỉ phần đã tô màu (dạng a/b).`,
      `${a}/${b}`, `Phân số chỉ phần tô màu là ${frac(a, b)}`)];
  }
}
function* g316(r) {
  // TOAN3.1.6 bai toan 2 buoc
  for (let i = 0; i < 15; i++) {
    const n = pick(r, NAMES), a = ri(r, 10, 90), b = ri(r, 5, a - 5), c = ri(r, 5, 20);
    yield ["van_dung", tl(`${n} có ${a} nhãn vở, cho bạn ${b} nhãn vở rồi mẹ mua thêm ${c} cái. Hỏi ${n} có bao nhiêu nhãn vở?`,
      `Bước 1: còn ${a} - ${b} = ${a - b}; Bước 2: ${a - b} + ${c} = ${a - b + c}. Đáp số: ${a - b + c} nhãn vở.`)];
    const k = ri(r, 3, 6), m = ri(r, 2, 9), h = ri(r, 2, k - 1);
    yield ["van_dung", tl(`Có ${k * m} cái bánh xếp đều vào ${k} hộp. Hỏi ${h} hộp như thế có bao nhiêu cái bánh?`,
      `Bước 1: mỗi hộp ${k * m} : ${k} = ${m} cái; Bước 2: ${h} × ${m} = ${h * m}. Đáp số: ${h * m} cái bánh.`)];
  }
  for (let i = 0; i < 8; i++) {
    const a = ri(r, 20, 60), b = ri(r, 2, 5);
    yield ["van_dung_cao", tl(`Một cửa hàng buổi sáng bán được ${a} kg gạo, buổi chiều bán gấp ${b} lần buổi sáng. Hỏi cả ngày cửa hàng bán được bao nhiêu ki-lô-gam gạo?`,
      `Buổi chiều: ${a} × ${b} = ${a * b}; Cả ngày: ${a} + ${a * b} = ${a + a * b} kg.`)];
  }
}
function* g321(r) {
  // TOAN3.2.1 trung diem, hinh tron, chu vi
  for (let i = 0; i < 10; i++) {
    const a = ri(r, 3, 15), b = ri(r, 3, 15);
    yield ["hieu", sa(`Hình chữ nhật có chiều dài ${a} cm, chiều rộng ${b} cm. Tính chu vi hình chữ nhật.`,
      `${(a + b) * 2}`, `Chu vi = (${a} + ${b}) × 2 = ${(a + b) * 2} cm`)];
    const s = ri(r, 3, 15);
    yield ["hieu", sa(`Hình vuông có cạnh ${s} cm. Tính chu vi hình vuông.`, `${s * 4}`, `Chu vi = ${s} × 4 = ${s * 4} cm`)];
  }
  yield ["biet", tf4(`Nhận định nào đúng, nhận định nào sai?`, [
    { t: "Trung điểm của đoạn thẳng chia đoạn thẳng thành hai phần bằng nhau", ok: true },
    { t: "Đường kính dài gấp đôi bán kính", ok: true },
    { t: "Hình tròn có 4 góc", ok: false },
    { t: "Tâm của hình tròn nằm trên đường tròn", ok: false },
  ])];
}
function* g322(r) {
  // TOAN3.2.2 mm, g, ml
  for (let i = 0; i < 15; i++) {
    const kind = i % 3;
    if (kind === 0) {
      const n = ri(r, 2, 9);
      yield ["biet", sa(`Đổi: ${n} cm = ? mm`, `${n * 10}`, `${n} cm = ${n * 10} mm`)];
      yield ["biet", sa(`Đổi: ${n} kg = ? g`, `${n * 1000}`, `${n} kg = ${fmt(n * 1000)} g`)];
    } else if (kind === 1) {
      const n = ri(r, 2, 9);
      yield ["hieu", mcAuto(r, `${n} lít = ? mi-li-lít`, fmt(n * 1000),
        [`${n * 100}`, `${n * 10}`, `${n} 000 0`].slice(0, 3))];
    } else {
      const a = ri(r, 200, 900), b = ri(r, 100, a - 100);
      yield ["van_dung", sa(`Can thứ nhất chứa ${a} ml nước, can thứ hai chứa ${b} ml. Hỏi can thứ nhất chứa nhiều hơn bao nhiêu mi-li-lít?`,
        `${a - b}`, `${a} - ${b} = ${a - b} ml`)];
    }
  }
}
function* g323(r) {
  // TOAN3.3.1 thong ke, bang so lieu
  for (let i = 0; i < 10; i++) {
    const a = ri(r, 10, 40), b = ri(r, 10, 40), c = ri(r, 10, 40), d = ri(r, 10, 40);
    yield ["hieu", sa(`Số cây bốn tổ trồng được: tổ 1: ${a}, tổ 2: ${b}, tổ 3: ${c}, tổ 4: ${d}. Tổ nào trồng nhiều nhất và trồng bao nhiêu cây?`,
      `${Math.max(a, b, c, d)}`, `Lớn nhất trong ${a}, ${b}, ${c}, ${d} là ${Math.max(a, b, c, d)}`)];
    yield ["van_dung", sa(`Với số liệu trên (tổ 1: ${a}, tổ 2: ${b}, tổ 3: ${c}, tổ 4: ${d}), cả bốn tổ trồng được bao nhiêu cây?`,
      `${a + b + c + d}`, `${a} + ${b} + ${c} + ${d} = ${a + b + c + d}`)];
  }
}
function* g324(r) {
  // TOAN3.4.1 van dung thuc te
  for (let i = 0; i < 12; i++) {
    const price = pick(r, [5, 6, 8, 9, 12]) * 1000;
    const n = ri(r, 2, 6);
    yield ["van_dung", sa(`Một quyển vở giá ${fmt(price)} đồng. Mua ${n} quyển vở hết bao nhiêu đồng?`,
      fmt(price * n), `${fmt(price)} × ${n} = ${fmt(price * n)} đồng`)];
    const a = ri(r, 100, 900);
    yield ["van_dung_cao", sa(`${pick(r, NAMES)} có ${fmt(a * 2)} đồng mua đồ dùng học tập hết ${fmt(a)} đồng. Hỏi còn lại bao nhiêu đồng?`,
      fmt(a * 2 - a), `${fmt(a * 2)} - ${fmt(a)} = ${fmt(a)} đồng`)];
  }
}

// ============================================================
// LOP 4
// ============================================================
function* g411(r) {
  // TOAN4.1.1 so den lop trieu
  for (let i = 0; i < 15; i++) {
    const n = ri(r, 1000000, 9999999);
    yield ["biet", sa(`Số ${fmt(n)} gồm mấy triệu, mấy trăm nghìn, mấy chục nghìn, mấy nghìn, mấy trăm, mấy chục, mấy đơn vị? (Viết giá trị chữ số hàng nghìn)`,
      `${Math.floor(n / 1000) % 10}`, `Chữ số hàng nghìn là ${Math.floor(n / 1000) % 10}`)];
    yield ["biet", mcAuto(r, `Chữ số ${Math.floor(n / 1000000)} trong số ${fmt(n)} thuộc hàng nào?`,
      "Hàng triệu", ["Hàng trăm nghìn", "Hàng chục nghìn", "Hàng nghìn"])];
  }
  for (let i = 0; i < 10; i++) {
    const n = ri(r, 100000, 9999999);
    const th = Math.floor(n / 1000000), h = Math.floor(n / 1000) % 1000;
    yield ["hieu", mcAuto(r, `Số ${fmt(n)} được đọc là:`,
      `${th} triệu ${h > 0 ? `${h} nghìn ` : ""}${n % 1000}`.replace(/\s+/g, " ").trim(),
      [`${th} trăm nghìn`, `${n % 1000} triệu`, `${th} nghìn`])];
  }
}
function* g412(r) {
  // TOAN4.1.2 so sanh, sap xep
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 100000, 9999999), b = ri(r, 100000, 9999999);
    if (a === b) continue;
    yield ["biet", sa(`So sánh: ${fmt(a)} ... ${fmt(b)} (điền >, < hoặc =)`, a > b ? ">" : "<",
      `${fmt(a)} ${a > b ? ">" : "<"} ${fmt(b)}`)];
  }
  for (let i = 0; i < 10; i++) {
    const arr = [...new Set([ri(r, 10000, 999999), ri(r, 10000, 999999), ri(r, 10000, 999999), ri(r, 10000, 999999)])];
    if (arr.length < 4) continue;
    const sorted = [...arr].sort((x, y) => x - y);
    yield ["hieu", sa(`Sắp xếp các số ${arr.map(fmt).join(", ")} theo thứ tự từ lớn đến bé.`,
      sorted.reverse().map(fmt).join(", "), `Từ lớn đến bé: ${sorted.map(fmt).join(", ")}`)];
  }
}
function* g413(r) {
  // TOAN4.1.3 cong tru nhieu chu so
  for (let i = 0; i < 25; i++) {
    const a = ri(r, 10000, 999999), b = ri(r, 1000, a - 1000);
    yield ["biet", sa(`Đặt tính rồi tính: ${fmt(a)} + ${fmt(b)} = ?`, `${fmt(a + b)}`, `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}`)];
    yield ["biet", sa(`Đặt tính rồi tính: ${fmt(a)} - ${fmt(b)} = ?`, `${fmt(a - b)}`, `${fmt(a)} - ${fmt(b)} = ${fmt(a - b)}`)];
  }
}
function* g414(r) {
  // TOAN4.1.4 TBC, nhan chia nhieu chu so
  for (let i = 0; i < 15; i++) {
    const k = ri(r, 2, 4);
    const nums = Array.from({ length: k }, () => ri(r, 10, 99));
    const sum = nums.reduce((a, b) => a + b, 0);
    if (sum % k === 0)
      yield ["hieu", sa(`Tính số trung bình cộng của các số: ${nums.join(", ")}.`,
        `${sum / k}`, `(${nums.join(" + ")}) : ${k} = ${sum} : ${k} = ${sum / k}`)];
  }
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 100, 9999), b = ri(r, 11, 99);
    yield ["hieu", mcAuto(r, `${fmt(a)} × ${b} = ?`, fmt(a * b), near(r, a * b).map(fmt))];
    const d = ri(r, 11, 99), k = ri(r, 10, 500);
    yield ["van_dung", sa(`Tính: ${fmt(d * k)} : ${d} = ?`, `${fmt(k)}`, `${fmt(d * k)} : ${d} = ${fmt(k)}`)];
  }
}
function* g415(r) {
  // TOAN4.1.5 phan so
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 1, 9), b = ri(r, 2, 12), c = ri(r, 2, 9);
    const lcm = b * c / gcd(b, c);
    const an = a * (lcm / b), cn = c * (lcm / c);
    yield ["hieu", sa(`Rút gọn phân số ${frac(a * c, b * c)} về tối giản.`,
      `${a}/${b}`, `Chia cả tử và mẫu cho ${c}: ${frac(a * c, b * c)} = ${frac(a, b)}`)];
    yield ["hieu", sa(`Quy đồng mẫu số hai phân số ${frac(a, b)} và ${frac(c, c + b > lcm ? lcm : lcm)}: (viết mẫu chung)`, `${lcm}`,
      `Mẫu chung nhỏ nhất của ${b} và ${c} là ${lcm}`)];
  }
  for (let i = 0; i < 10; i++) {
    const a = ri(r, 1, 8), b = ri(r, 2, 9), c = ri(r, 1, 8);
    if (a === c) continue;
    yield ["biet", sa(`So sánh: ${frac(a, b)} ... ${frac(c, b)} (cùng mẫu, điền > hoặc <)`,
      a > c ? ">" : "<", `Cùng mẫu ${b}: tử ${a} ${a > c ? ">" : "<"} tử ${c}`)];
    yield ["van_dung", sa(`Tính: ${frac(a, b)} + ${frac(c, b)} = ? (dạng a/b)`,
      `${a + c}/${b}`, `Cùng mẫu: ${frac(a + c, b)}`)];
  }
}
function* g416(r) {
  // TOAN4.1.6 so thap phan co ban
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 1, 99), b = ri(r, 1, 99);
    yield ["biet", sa(`Viết phân số ${frac(a, 10)} dưới dạng số thập phân.`, dec(a / 10),
      `${frac(a, 10)} = ${dec(a / 10)}`)];
    {
      const x = a / 10 + b / 100;
      const read = (v) => `${Math.floor(v)} phẩy ${Math.round((v % 1) * 100)}`;
      const wrong = new Set();
      let g = 0;
      while (wrong.size < 3 && g++ < 30) { const w = read(ri(r, 1, 99) / 10 + ri(r, 1, 99) / 100); if (w !== read(x)) wrong.add(w); }
      yield ["hieu", mcAuto(r, `Số thập phân ${dec(x)} đọc là:`, read(x), [...wrong])];
    }
  }
}
function* g417(r) {
  // TOAN4.1.7 bai toan 3 buoc
  for (let i = 0; i < 12; i++) {
    const b = ri(r, 2, 6), per = ri(r, 4, 10), c = per * ri(r, 1, 3);
    const a = b * per;
    yield ["van_dung", tl(`Một lớp học có ${a} học sinh, chia đều thành ${b} tổ. Mỗi tổ nhận ${c} quyển vở phát đều cho các bạn. Hỏi mỗi bạn được bao nhiêu quyển vở?`,
      `Mỗi tổ có ${a} : ${b} = ${per} bạn; mỗi bạn được ${c} : ${per} = ${c / per} quyển. Đáp số: ${c / per} quyển.`)];
    const p = ri(r, 15, 45), q = ri(r, 2, 8);
    yield ["van_dung", tl(`Một cửa hàng ngày đầu bán ${p} tạ gạo, ngày thứ hai bán gấp ${q} lần ngày đầu. Hỏi trung bình mỗi ngày bán bao nhiêu tạ?`,
      `Ngày 2: ${p} × ${q} = ${p * q}; TBC: (${p} + ${p * q}) : 2 = ${(p + p * q) / 2} tạ.`)];
  }
}
function* g421(r) {
  // TOAN4.2.1 goc, song song vuong goc
  const qs = [
    ["Góc nhọn là góc:", "bé hơn góc vuông", ["lớn hơn góc vuông", "bằng góc vuông", "bằng góc bẹt"]],
    ["Góc tù là góc:", "lớn hơn góc vuông nhưng bé hơn góc bẹt", ["bé hơn góc vuông", "bằng góc bẹt", "bằng góc vuông"]],
    ["Hai đường thẳng vuông góc tạo thành:", "4 góc vuông", ["2 góc nhọn", "1 góc bẹt", "3 góc tù"]],
    ["Hai đường thẳng song song là hai đường thẳng:", "không bao giờ cắt nhau", ["cắt nhau tại 1 điểm", "vuông góc với nhau", "trùng nhau"]],
  ];
  for (const [s, c, w] of qs) yield ["biet", mcAuto(r, s, c, w)];
  const qs2 = [
    ["Góc bẹt bằng:", "hai góc vuông", ["một góc vuông", "ba góc vuông", "bốn góc nhọn"]],
    ["Kim giờ và kim phút của đồng hồ lúc 3 giờ đúng tạo thành:", "góc vuông", ["góc nhọn", "góc tù", "góc bẹt"]],
    ["Hai cạnh kề của quyển sách tạo thành:", "góc vuông", ["góc nhọn", "góc tù", "góc bẹt"]],
    ["Hình bình hành có:", "hai cặp cạnh đối song song", ["một cặp cạnh song song", "không cạnh song song", "bốn góc vuông"]],
    ["Góc tạo bởi kim giờ và kim phút lúc 6 giờ là:", "góc bẹt", ["góc vuông", "góc nhọn", "góc tù"]],
    ["Trong hình thoi, hai đường chéo:", "vuông góc với nhau", ["song song", "bằng nhau luôn", "trùng nhau"]],
  ];
  for (const [s, c, w] of qs2) yield ["biet", mcAuto(r, s, c, w)];
  for (let i = 0; i < 8; i++) {
    const h = pick(r, [1, 2, 4, 5, 7, 8, 10, 11]);
    yield ["hieu", mcAuto(r, `Lúc ${h} giờ đúng, kim giờ và kim phút tạo thành góc:`,
      h === 6 ? "góc bẹt" : [3, 9].includes(h) ? "góc vuông" : [1, 2, 10, 11].includes(h) ? "góc nhọn" : "góc tù",
      ["góc nhọn", "góc vuông", "góc tù", "góc bẹt"].filter((x) => x !== (h === 6 ? "góc bẹt" : [3, 9].includes(h) ? "góc vuông" : [1, 2, 10, 11].includes(h) ? "góc nhọn" : "góc tù")))];
  }
  yield ["hieu", tf4(`Nhận định nào đúng, nhận định nào sai?`, [
    { t: "Góc bẹt bằng hai góc vuông", ok: true },
    { t: "Góc nhọn lớn hơn góc tù", ok: false },
    { t: "Hai đường thẳng vuông góc cắt nhau tạo 4 góc vuông", ok: true },
    { t: "Hai đường thẳng song song cắt nhau", ok: false },
  ])];
  yield ["hieu", tf4(`Nhận định nào đúng, nhận định nào sai?`, [
    { t: "Góc tù bé hơn góc bẹt", ok: true },
    { t: "Góc nhọn bằng góc vuông", ok: false },
    { t: "Hình chữ nhật có 4 góc vuông", ok: true },
    { t: "Hai đường thẳng song song có 1 điểm chung", ok: false },
  ])];
}
function* g422(r) {
  // TOAN4.2.2 yen/ta/tan, dm2/m2
  for (let i = 0; i < 15; i++) {
    const kind = i % 3;
    const n = ri(r, 2, 9);
    if (kind === 0) {
      yield ["biet", sa(`Đổi: ${n} tạ = ? kg`, `${n * 100}`, `${n} tạ = ${n * 100} kg`)];
      yield ["biet", sa(`Đổi: ${n} tấn = ? tạ`, `${n * 10}`, `${n} tấn = ${n * 10} tạ`)];
    } else if (kind === 1) {
      yield ["hieu", mcAuto(r, `${n} m² = ? dm²`, `${n * 100}`, [`${n * 10}`, `${n * 1000}`, `${n}`])];
    } else {
      const a = ri(r, 5, 20), b = ri(r, 3, a - 1);
      yield ["van_dung", sa(`Một mảnh vườn hình chữ nhật dài ${a} m, rộng ${b} m. Tính diện tích mảnh vườn.`,
        `${a * b}`, `Diện tích = ${a} × ${b} = ${a * b} m²`)];
    }
  }
}
function* g423(r) {
  // TOAN4.3.1 bang thong ke, bieu do
  for (let i = 0; i < 10; i++) {
    const a = ri(r, 20, 80), b = ri(r, 20, 80), c = ri(r, 20, 80);
    yield ["hieu", sa(`Bảng số học sinh giỏi 3 lớp: lớp 4A ${a}, lớp 4B ${b}, lớp 4C ${c}. Lớp nào có nhiều học sinh giỏi nhất?`,
      a >= b && a >= c ? "4A" : b >= c ? "4B" : "4C",
      `Lớn nhất trong ${a}, ${b}, ${c}`)];
    yield ["van_dung", sa(`Với số liệu trên, trung bình mỗi lớp có bao nhiêu học sinh giỏi?`,
      `${Math.round((a + b + c) / 3)}`, `(${a}+${b}+${c}) : 3 ≈ ${Math.round((a + b + c) / 3)}`)];
  }
}

// ============================================================
// LOP 5
// ============================================================
function* g511(r) {
  // TOAN5.1.1 on phep tinh STN, 4 buoc
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 1000, 99999), b = ri(r, 100, 999);
    yield ["biet", sa(`Tính: ${fmt(a)} + ${fmt(b)} = ?`, `${fmt(a + b)}`, `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}`)];
    yield ["hieu", sa(`Tính: ${fmt(a)} - ${fmt(b)} = ?`, `${fmt(a - b)}`, `${fmt(a)} - ${fmt(b)} = ${fmt(a - b)}`)];
  }
  for (let i = 0; i < 10; i++) {
    const b = ri(r, 2, 5), lop = ri(r, 3, 6), hs = ri(r, 25, 40);
    const total = b * lop * hs;
    yield ["van_dung", tl(`Một trường có ${b} khối, mỗi khối ${lop} lớp, mỗi lớp ${hs} học sinh. Hỏi trường có tất cả bao nhiêu học sinh?`,
      `Số lớp: ${b} × ${lop} = ${b * lop}; Tổng HS: ${b * lop} × ${hs} = ${fmt(total)}. Đáp số: ${fmt(total)} học sinh.`)];
  }
}
function* g512(r) {
  // TOAN5.1.2 phan so, hon so
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 1, 8), b = ri(r, 2, 9), c = ri(r, 1, 8), d = ri(r, 2, 9);
    yield ["hieu", sa(`Tính: ${frac(a, b)} + ${frac(c, d)} = ? (dạng a/b, tối giản)`,
      `${(a * d + c * b) / gcd(a * d + c * b, b * d)}/${(b * d) / gcd(a * d + c * b, b * d)}`,
      `Quy đồng: ${frac(a * d, b * d)} + ${frac(c * b, b * d)} = ${frac(a * d + c * b, b * d)}`)];
    yield ["hieu", sa(`Viết hỗn số $${a}\\frac{${c}}{${d}}$ thành phân số.`,
      `${a * d + c}/${d}`, `$${a}\\frac{${c}}{${d}} = \\frac{${a}×${d}+${c}}{${d}} = \\frac{${a * d + c}}{${d}}$`)];
  }
}
function* g513(r) {
  // TOAN5.1.3 so thap phan
  for (let i = 0; i < 20; i++) {
    const a = ri(r, 1, 999) / 10, b = ri(r, 1, 999) / 100;
    yield ["biet", sa(`Đọc số thập phân ${dec(a)}.`, `${Math.floor(a)} phẩy ${Math.round(a % 1 * 10)}`,
      `${dec(a)} đọc là ${Math.floor(a)} phẩy ${Math.round(a % 1 * 10)}`)];
    const x = Math.round((a + b) * 100) / 100;
    yield ["hieu", sa(`Tính: ${dec(a)} + ${dec(b)} = ?`, dec(x), `${dec(a)} + ${dec(b)} = ${dec(x)}`)];
  }
  for (let i = 0; i < 10; i++) {
    const a = ri(r, 10, 999) / 10, b = ri(r, 10, 999) / 10;
    if (a === b) continue;
    yield ["biet", sa(`So sánh: ${dec(a)} ... ${dec(b)} (điền >, < hoặc =)`, a > b ? ">" : "<",
      `${dec(a)} ${a > b ? ">" : "<"} ${dec(b)}`)];
  }
}
function* g514(r) {
  // TOAN5.1.4 ti so phan tram
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 2, 9) * 10, b = pick(r, [10, 20, 25, 50]);
    yield ["hieu", sa(`Tính ${b}% của ${a}.`, `${a * b / 100}`, `${a} × ${b}% = ${a} × ${b} : 100 = ${a * b / 100}`)];
    const total = pick(r, [40, 50]);
    const c = ri(r, 10, total - 10);
    const t = c * 100 / total;
    if (Number.isInteger(t))
      yield ["van_dung", sa(`Lớp có ${total} học sinh, trong đó ${c} bạn nữ. Tính tỉ số phần trăm học sinh nữ.`,
        `${t}%`, `${c} : ${total} × 100 = ${t}%`)];
  }
}
function* g515(r) {
  // TOAN5.1.5 ti le, tim 2 so
  for (let i = 0; i < 15; i++) {
    const k = pick(r, [4, 6, 8, 10, 12]), m = ri(r, 3, 9);
    yield ["van_dung", tl(`${m} công nhân làm xong công việc trong ${k} ngày. Hỏi ${m * 2} công nhân làm xong trong bao nhiêu ngày? (tỉ lệ nghịch)`,
      `Gấp đôi người thì thời gian giảm một nửa: ${k} : 2 = ${k / 2}. Đáp số: ${k / 2} ngày.`)];
    const sum = ri(r, 20, 100), d = ri(r, 2, sum / 2 - 1);
    const big = (sum + d) / 2, small = (sum - d) / 2;
    if (Number.isInteger(big))
      yield ["van_dung", tl(`Tổng hai số là ${sum}, hiệu là ${d}. Tìm hai số đó.`,
        `Số lớn: (${sum} + ${d}) : 2 = ${big}; Số bé: ${small}`)];
  }
}
function* g521(r) {
  // TOAN5.2.1 dien tich tam giac/thang/tron
  for (let i = 0; i < 15; i++) {
    const a = ri(r, 4, 20), h = ri(r, 4, 20);
    yield ["hieu", sa(`Hình tam giác có đáy ${a} cm, chiều cao ${h} cm. Tính diện tích.`,
      `${a * h / 2}`, `S = ${a} × ${h} : 2 = ${a * h / 2} cm²`)];
    const b = ri(r, 2, 9);
    yield ["hieu", sa(`Hình tròn có bán kính ${b} cm. Tính diện tích (π ≈ 3,14).`,
      `${Math.round(b * b * 3.14 * 100) / 100}`, `S = ${b} × ${b} × 3,14 = ${Math.round(b * b * 3.14 * 100) / 100} cm²`)];
  }
  for (let i = 0; i < 8; i++) {
    const a = ri(r, 6, 15), b = ri(r, 4, a - 1), h = ri(r, 3, 10);
    yield ["van_dung", sa(`Hình thang có đáy lớn ${a} cm, đáy bé ${b} cm, chiều cao ${h} cm. Tính diện tích.`,
      `${(a + b) * h / 2}`, `S = (${a} + ${b}) × ${h} : 2 = ${(a + b) * h / 2} cm²`)];
  }
}
function* g522(r) {
  // TOAN5.2.2 doi dien tich/the tich, van toc
  for (let i = 0; i < 15; i++) {
    const n = ri(r, 2, 9);
    yield ["biet", sa(`Đổi: ${n} m² = ? dm²`, `${n * 100}`, `${n} m² = ${n * 100} dm²`)];
    yield ["biet", sa(`Đổi: ${n} m³ = ? dm³`, `${n * 1000}`, `${n} m³ = ${fmt(n * 1000)} dm³`)];
  }
  for (let i = 0; i < 10; i++) {
    const v = ri(r, 30, 60), t = ri(r, 2, 5);
    yield ["van_dung", tl(`Một ô tô đi với vận tốc ${v} km/giờ trong ${t} giờ. Tính quãng đường ô tô đi được.`,
      `Quãng đường = v × t = ${v} × ${t} = ${v * t} km`)];
  }
}
function* g523(r) {
  // TOAN5.3.1 bieu do quat, xac suat
  const qs = [
    ["Biểu đồ hình quạt tròn dùng để:", "biểu diễn tỉ số phần trăm các phần của tổng thể", ["đếm số lượng", "vẽ hình", "so sánh hai số"]],
    ["Trong biểu đồ quạt, toàn bộ hình tròn ứng với:", "100%", ["50%", "10%", "1000%"]],
  ];
  for (const [s, c, w] of qs) yield ["biet", mcAuto(r, s, c, w)];
  const qs2 = [
    ["Gieo một con xúc xắc, kết quả nào có thể xảy ra?", "Mặt 6 chấm", ["Mặt 7 chấm", "Mặt 0 chấm", "Mặt 8 chấm"]],
    ["Rút một thẻ từ hộp có 5 thẻ đỏ, không thể rút được:", "thẻ xanh", ["thẻ đỏ", "một thẻ", "thẻ bất kì"]],
    ["Tung đồng xu, số kết quả có thể xảy ra là:", "2", ["1", "3", "6"]],
    ["Hộp có 3 bi xanh, 3 bi đỏ, khả năng rút được bi đỏ là:", "có thể xảy ra", ["chắc chắn", "không thể", "không xác định"]],
  ];
  for (const [s, c, w] of qs2) yield ["biet", mcAuto(r, s, c, w)];
  for (let i = 0; i < 10; i++) {
    const a = ri(r, 30, 60);
    yield ["hieu", sa(`Biểu đồ quạt: học sinh thích thể thao chiếm ${a}%. Nếu lớp có 40 học sinh thì có bao nhiêu bạn thích thể thao?`,
      `${Math.round(40 * a / 100)}`, `40 × ${a}% = ${Math.round(40 * a / 100)} bạn`)];
    const b = ri(r, 20, 80);
    yield ["van_dung", sa(`Biểu đồ quạt của 200 học sinh: thích đọc sách chiếm ${b}%. Số học sinh thích đọc sách là:`,
      `${200 * b / 100}`, `200 × ${b}% = ${200 * b / 100} bạn`)];
  }
  yield ["hieu", tf4(`Nhận định nào đúng, nhận định nào sai?`, [
    { t: "Toàn bộ biểu đồ quạt ứng với 100%", ok: true },
    { t: "Gieo xúc xắc có thể ra mặt 7 chấm", ok: false },
    { t: "Tung đồng xu có 2 kết quả có thể xảy ra", ok: true },
    { t: "Biểu đồ quạt chỉ dùng để đếm số", ok: false },
  ])];
}
function* g524(r) {
  // TOAN5.4.1 van dung thuc tien: tien, lai suat
  for (let i = 0; i < 12; i++) {
    const p = ri(r, 10, 90) * 1000, q = ri(r, 2, 9);
    yield ["van_dung", tl(`Mẹ đi chợ mua ${q} kg gạo giá ${fmt(p)} đồng một ki-lô-gam. Mẹ đưa cô bán hàng ${fmt(p * q + 50000)} đồng. Hỏi cô bán hàng phải trả lại bao nhiêu đồng?`,
      `Tiền gạo: ${fmt(p * q)}; Trả lại: ${fmt(p * q + 50000)} - ${fmt(p * q)} = 50 000 đồng`)];
    const cap = ri(r, 100, 500) * 10000, rate = pick(r, [5, 6, 7, 8]);
    yield ["van_dung_cao", tl(`Bác Lan gửi tiết kiệm ${fmt(cap)} đồng với lãi suất ${rate}% một năm. Hỏi sau một năm bác nhận được bao nhiêu tiền lãi?`,
      `Tiền lãi = ${fmt(cap)} × ${rate}% = ${fmt(cap * rate / 100)} đồng`)];
  }
}

function* g3tc9(r) {
  // TOAN3.TC.9 bieu do cot kep (YCCD rieng)
  const subs = [["nam", "nữ"], ["buổi sáng", "buổi chiều"], ["tháng 1", "tháng 2"]];
  for (let i = 0; i < 15; i++) {
    const [x, y] = pick(r, subs);
    const a1 = ri(r, 10, 40), a2 = ri(r, 10, 40), b1 = ri(r, 10, 40), b2 = ri(r, 10, 40);
    yield ["hieu", sa(`Biểu đồ cột kép số học sinh hai lớp: lớp 3A có ${a1} ${x}, ${a2} ${y}; lớp 3B có ${b1} ${x}, ${b2} ${y}. Tổng số học sinh lớp 3A là bao nhiêu?`,
      `${a1 + a2}`, `${a1} + ${a2} = ${a1 + a2}`)];
    yield ["van_dung", sa(`Với số liệu trên (3A: ${a1} ${x}, ${a2} ${y}; 3B: ${b1} ${x}, ${b2} ${y}), số ${x} hai lớp chênh nhau bao nhiêu?`,
      `${Math.abs(a1 - b1)}`, `|${a1} - ${b1}| = ${Math.abs(a1 - b1)}`)];
    yield ["hieu", mcAuto(r, `Trong biểu đồ cột kép, mỗi nhóm có mấy cột?`, "2 cột (mỗi cột một đại lượng)", ["1 cột", "3 cột", "4 cột"])];
  }
  yield ["biet", tf4(`Nhận định nào đúng, nhận định nào sai?`, [
    { t: "Biểu đồ cột kép dùng so sánh hai đại lượng cùng nhóm", ok: true },
    { t: "Biểu đồ cột kép chỉ có một cột mỗi nhóm", ok: false },
    { t: "Mỗi cột trong biểu đồ có chiều cao ứng với số liệu", ok: true },
    { t: "Biểu đồ cột kép không cần chú thích", ok: false },
  ])];
}

// ============================================================
// REGISTRY: ma YCCD -> (gen, grade)
// ============================================================
export const TOAN_GEN = {
  "TOAN1.1.1": [g111, 1], "TOAN1.1.2": [g112, 1], "TOAN1.1.3": [g113, 1],
  "TOAN1.2.1": [g121, 1], "TOAN1.2.2": [g122, 1], "TOAN1.3.1": [g131, 1],
  "TOAN2.1.1": [g211, 2], "TOAN2.1.2": [g212, 2], "TOAN2.1.3": [g213, 2],
  "TOAN2.2.1": [g221, 2], "TOAN2.2.2": [g222, 2], "TOAN2.3.1": [g231, 2], "TOAN2.4.1": [g241, 2],
  "TOAN3.1.1": [g311, 3], "TOAN3.1.2": [g312, 3], "TOAN3.1.3": [g313, 3],
  "TOAN3.1.4": [g314, 3], "TOAN3.1.5": [g315, 3], "TOAN3.1.6": [g316, 3],
  "TOAN3.2.1": [g321, 3], "TOAN3.2.2": [g322, 3], "TOAN3.3.1": [g323, 3], "TOAN3.4.1": [g324, 3],
  "TOAN3.TC.9": [g3tc9, 3],
  "TOAN4.1.1": [g411, 4], "TOAN4.1.2": [g412, 4], "TOAN4.1.3": [g413, 4],
  "TOAN4.1.4": [g414, 4], "TOAN4.1.5": [g415, 4], "TOAN4.1.6": [g416, 4], "TOAN4.1.7": [g417, 4],
  "TOAN4.2.1": [g421, 4], "TOAN4.2.2": [g422, 4], "TOAN4.3.1": [g423, 4],
  "TOAN5.1.1": [g511, 5], "TOAN5.1.2": [g512, 5], "TOAN5.1.3": [g513, 5],
  "TOAN5.1.4": [g514, 5], "TOAN5.1.5": [g515, 5],
  "TOAN5.2.1": [g521, 5], "TOAN5.2.2": [g522, 5], "TOAN5.3.1": [g523, 5], "TOAN5.4.1": [g524, 5],
};
