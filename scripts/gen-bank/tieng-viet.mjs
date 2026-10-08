// ============================================================
// gen-bank/tieng-viet.mjs - Tieng Viet TH (lop 1-5), theo de thi
// thuc te: dien am/van, phan biet ch-tr s-x l-n, tu loai, doc hieu.
// Van ban doc hieu tu soan - khong sao chep SGK.
// ============================================================

import { makeRng } from "./toan.mjs";
import { docHieu, DH2, DH3, DH4, DH5 } from "./passages.mjs";
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const LET = ["A", "B", "C", "D"];

function mc(stem, opts, correctIdx) {
  return { stem: `${stem} ${opts.map((o, i) => `${LET[i]}. ${o}`).join(" ")}`, qtype: "multiple_choice", answer: { correct: LET[correctIdx] } };
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

const PTS = { multiple_choice: 0.5, true_false_4: 1, short_answer: 0.5, essay: 3 };
const Q = (stdId, grade, level, q) => ({ ...q, standard_ids: [stdId], subject_code: "tieng_viet", grade, level, points: PTS[q.qtype] });

// ---- kho tu vung tu soan ----------------------------------------------------
const TU_SU_VAT = ["cái bàn", "con mèo", "quyển sách", "bông hoa", "ngôi nhà", "con chim", "cây bút", "dòng sông", "quả cam", "chiếc cặp"];
const TU_HOAT_DONG = ["chạy", "nhảy", "đọc", "viết", "hát", "vẽ", "nấu ăn", "tập thể dục", "chơi", "học bài"];
const TU_DAC_DIEM = ["xinh đẹp", "cao", "ngoan", "chăm chỉ", "đỏ", "trắng", "thông minh", "vui vẻ", "sạch sẽ", "tốt bụng"];
const DONG_NGHIA = [["chăm chỉ", "siêng năng"], ["vui vẻ", "hớn hở"], ["xinh đẹp", "xinh xắn"], ["nhanh nhẹn", "lanh lợi"], ["dũng cảm", "gan dạ"], ["hiền lành", "nhân hậu"], ["thông minh", "lanh trí"], ["rực rỡ", "tươi sáng"]];
const TRAI_NGHIA = [["cao", "thấp"], ["nhanh", "chậm"], ["vui", "buồn"], ["sạch", "bẩn"], ["sáng", "tối"], ["dài", "ngắn"], ["khôn", "dại"], ["chăm", "lười"]];
const THANH_NGU = [["ăn no mặc ấm", "có cuộc sống đầy đủ"], ["chịu thương chịu khó", "sẵn sàng làm việc vất vả"], ["uống nước nhớ nguồn", "nhớ ơn người đã giúp mình"], ["một con ngựa đau cả tàu bỏ cỏ", "cùng nhau chia sẻ khó khăn"], ["chớ thấy sóng cả mà ngã tay chèo", "đừng bỏ cuộc trước khó khăn"], ["tiên học lễ hậu học văn", "học cách cư xử trước khi học chữ"]];

// ============================================================
// LOP 1
// ============================================================
function* v111(r) {
  // TVIET1.1.1 doc dung ro rang - nhan dien am, van, tu
  const vams = ["a", "o", "e", "ê", "i", "u", "ư", "b", "c", "d", "đ", "g", "h", "k", "l", "m", "n", "p", "q", "r", "s", "t", "v", "x"];
  for (let i = 0; i < 15; i++) {
    const w = pick(r, TU_SU_VAT.concat(TU_HOAT_DONG));
    const first = w.split(" ")[0][0] === "c" && w[1] !== "á" ? w[0] : w[0];
    yield Q("TVIET1.1.1", 1, "biet", sa(`Đọc to từ sau: "${w}". Từ này có mấy tiếng?`, `${w.split(" ").length}`,
      `Từ "${w}" có ${w.split(" ").length} tiếng.`));
  }
  const vowels = [["con mèo", "eo"], ["quyển sách", "uyên"], ["bông hoa", "ông"], ["cái bàn", "an"], ["dòng sông", "ông"]];
  for (const [w, v] of vowels)
    yield Q("TVIET1.1.1", 1, "hieu", mcAuto(r, `Tiếng "${w.split(" ")[0]}" có vần nào?`, v,
      ["an", "am", "ong", "ông", "eo", "uyên", "iên"].filter((x) => x !== v).slice(0, 3)));
}
function* v121(r) {
  // TVIET1.2.1 viet chinh ta - dien am/van
  const fills = [
    ["con m__", "èo", ["eo", "è"], "con mèo"],
    ["cái b__n", "à", ["a", "an"], "cái bàn"],
    ["ngôi nh__", "à", ["a", "an"], "ngôi nhà"],
    ["__ị con", "tr", ["ch", "tr"], "gà con"],
    ["cây c__", "h", ["g", "h"], "cây cỏ"],
  ];
  for (const [s, ans, opts, full] of fills)
    yield Q("TVIET1.2.1", 1, "biet", sa(`Điền vào chỗ trống để được từ đúng: "${s}"`, full.split(" ").pop() || full,
      `Từ đúng: "${full}"`));
  const pairs = [["cây cỏ", "cây cọ"], ["ca dao", "ca giao"], ["trăng rằm", "chăng dâm"], ["sơn ca", "xơn ca"],
    ["bó đũa", "bó nũa"], ["lá sen", "ná sen"], ["gà mái", "gà mải"], ["bé gái", "bé gải"],
    ["con cua", "con cùa"], ["mái nhà", "mải nhà"], ["quả na", "quả la"], ["bàn tay", "bàn tai"]];
  for (const [right, wrong] of pairs)
    yield Q("TVIET1.2.1", 1, "hieu", mcAuto(r, `Từ nào viết đúng chính tả: "${right}" hay "${wrong}"?`, right, [wrong, right[0] + "x", "không từ nào"]));
  const fills2 = [
    ["hoa h___", "ồng", "hoa hồng"], ["con c___", "ò", "con cò"], ["m___ ong", "ật", "mật ong"],
    ["qu___ bóng", "ả", "quả bóng"], ["b___ cát", "ãi", "bãi cát"], ["nh___ lá", "ỏ", "nhỏ lá"],
    ["c___ trường", "ổng", "cổng trường"], ["b___ mẹ", "ố", "bố mẹ"],
  ];
  for (const [s, ans, full] of fills2)
    yield Q("TVIET1.2.1", 1, "biet", sa(`Điền vào chỗ trống để được từ đúng: "${s}"`, full.split(" ").pop(),
      `Từ đúng: "${full}"`));
}
function* v131(r) {
  // TVIET1.3.1 tra loi cau hoi, giao tiep
  const stems = [
    ["Khi gặp thầy cô giáo, em nên nói gì?", "Em chào thầy (cô) ạ!", ["Em không nói gì.", "Em quay đi.", "Em nói tên mình."]],
    ["Khi được bạn cho quà, em nên nói gì?", "Em cảm ơn bạn ạ!", ["Em giật lấy luôn.", "Em không cần nói.", "Em kêu thêm nữa."]],
    ["Khi làm bạn ngã, em nên nói gì?", "Xin lỗi bạn nhé!", ["Kệ bạn đi.", "Đáng đời bạn.", "Bạn tự ngã mà."]],
    ["Muốn mượn bút của bạn, em nói thế nào?", "Bạn cho mình mượn bút được không?", ["Đưa bút đây!", "Lấy bút đi.", "Bút của mình đấy."]],
    ["Khi đến nhà người khác chơi, em nên:", "chào hỏi người lớn trong nhà", ["chạy vào phòng luôn", "không nói gì", "gọi to tên bạn"]],
    ["Buổi sáng đến lớp, em chào các bạn thế nào?", "Chào các bạn!", ["Bỏ đi luôn.", "Không nhìn ai.", "Chào tối nhé."]],
    ["Khi cô giáo khen em, em nên nói:", "Em cảm ơn cô ạ!", ["Em không thích.", "Kệ cô.", "Im lặng quay đi."]],
    ["Bạn bị điểm kém buồn, em nên nói:", "Lần sau bạn cố gắng hơn nhé!", ["Bạn dở quá.", "Kệ bạn.", "Mình giỏi hơn bạn."]],
    ["Khi đi qua chỗ người lớn đang nói chuyện, em nên:", "xin phép đi qua", ["chạy xuyên qua", "hét lên", "đứng chặn giữa"]],
    ["Người lạ cho em kẹo, em nên:", "từ chối lễ phép và kể với người lớn", ["nhận luôn", "giật lấy", "theo người lạ"]],
    ["Khi bạn giúp em học bài, em nên:", "cảm ơn bạn", ["không nói gì", "bảo bạn làm tiếp", "cười bạn dở"]],
    ["Em muốn vào phòng khi người lớn đang họp, em nên:", "gõ cửa và xin phép", ["mở cửa vào luôn", "hét to tên mẹ", "đạp cửa"]],
    ["Khi điện thoại cô giáo gọi, em nên nói:", "Dạ, em chào cô ạ!", ["A lô ai đấy?", "Em không nghe.", "Cúp máy luôn."]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET1.3.1", 1, "hieu", mcAuto(r, s, c, w));
  const asks = [
    ["Họ và tên của em là gì?", "(Tự trả lời tên em)", "HS trả lời đầy đủ họ tên mình."],
    ["Nhà em ở đâu?", "(Tự trả lời địa chỉ nhà em)", "HS nêu được thôn/xã/huyện của mình."],
    ["Bạn thân nhất của em là ai?", "(Tự trả lời tên bạn)", "HS trả lời rõ ràng tên bạn thân."],
    ["Lớp em có bao nhiêu bạn?", "(Tự trả lời số bạn trong lớp)", "HS nêu đúng sĩ số lớp."],
  ];
  for (const [s, c, sol] of asks) yield Q("TVIET1.3.1", 1, "van_dung", sa(s, c, sol));
}
function* v141(r) {
  // TVIET1.4.1 nhan biet am/van, tu chi su vat-hoat dong-dac diem
  for (let i = 0; i < 15; i++) {
    const cat = pick(r, [["sự vật", TU_SU_VAT], ["hoạt động", TU_HOAT_DONG], ["đặc điểm", TU_DAC_DIEM]]);
    const others = [["sự vật", TU_SU_VAT], ["hoạt động", TU_HOAT_DONG], ["đặc điểm", TU_DAC_DIEM]].filter((x) => x[0] !== cat[0]);
    const ok = pick(r, cat[1]), ws = others.map((x) => pick(r, x[1]));
    yield Q("TVIET1.4.1", 1, "biet", mcAuto(r, `Trong nhóm từ: ${[ok, ...ws].join(", ")} - từ nào chỉ ${cat[0]}?`, ok, ws));
  }
  const vanWords = [["bàn", "an"], ["mèo", "eo"], ["hoa", "oa"], ["bút", "ut"], ["sách", "ách"], ["chim", "im"]];
  for (const [w, v] of vanWords)
    yield Q("TVIET1.4.1", 1, "hieu", sa(`Tiếng "${w}" có vần gì?`, v, `Tiếng "${w}" có vần "${v}".`));
}

// ============================================================
// LOP 2
// ============================================================
function* v211(r) {
  // TVIET2.1.1 doc troi chay - doc hieu doan ngan
  const texts = [
    { t: "Sáng sớm, ve sầu cất tiếng hót trong nắng. Mẹ dắt em đến trường. Đường đến trường thật đẹp.", items: [["Ve sầu hót vào buổi tối.", false], ["Mẹ dắt em đến trường.", true], ["Đường đến trường xấu xí.", false], ["Bài đọc nói về buổi sáng.", true]] },
    { t: "Con mèo nhà em rất ngoan. Nó hay nằm sưởi nắng. Mỗi khi em đi học về, nó chạy ra đón em.", items: [["Con mèo hay cắn người.", false], ["Con mèo hay nằm sưởi nắng.", true], ["Con mèo không đón em.", false], ["Con mèo rất ngoan.", true]] },
    { t: "Lớp 2A có ba mươi học sinh. Các bạn ai cũng chăm học. Cô giáo chủ nhiệm rất thương các bạn.", items: [["Lớp 2A có hai mươi học sinh.", false], ["Các bạn chăm học.", true], ["Cô giáo không thương học sinh.", false], ["Lớp có ba mươi bạn.", true]] },
  ];
  for (const x of texts)
    yield Q("TVIET2.1.1", 2, "hieu", tf4(`Đọc đoạn sau và xác định đúng/sai: "${x.t}"`, x.items.map(([t, ok]) => ({ t, ok }))));
  yield* docHieu(r, 2, "TVIET2.1.1", Q, tf4, DH2, { mcAuto, sa });
}
function* v221(r) {
  // TVIET2.2.1 viet chinh ta doan - phan biet am/van kho
  const pairs = [
    ["cây trồng", "cây chồng"], ["giữ gìn", "dữ dìn"], ["cây dừa", "cây dừa"],
    ["chăm chỉ", "trăm trì"], ["lớp học", "nớp học"], ["con dao", "con giao"],
    ["bánh rán", "bánh gián"], ["xách xe", "sách xe"], ["chú ý", "trú ý"], ["no nê", "lo le"],
  ];
  for (const [right, wrong] of pairs)
    yield Q("TVIET2.2.1", 2, "biet", mcAuto(r, `Từ nào viết đúng chính tả: "${right}" hay "${wrong}"?`, right, [wrong, "cả hai đều đúng", "cả hai đều sai"]));
  const fills = [
    ["con gi__", "an", "con gián", ["an", "ang", "am"]],
    ["sông ng__", "òi", "sông ngòi", ["oi", "òi", "oy"]],
    ["bông l__", "úa", "bông lúa", ["ua", "úa", "ùa"]],
    ["tr__ng rằm", "ă", "trăng rằm", ["a", "ă", "â"]],
  ];
  for (const [s, ans, full, opts] of fills)
    yield Q("TVIET2.2.1", 2, "hieu", mcAuto(r, `Điền vào chỗ trống: "${s}"`, ans, opts.filter((x) => x !== ans)));
}
function* v231(r) {
  // TVIET2.3.1 ke lai cau chuyen, noi ve nhan vat
  const stems = [
    ["Câu chuyện 'Cây xoài của ông em' nói về điều gì?", "Tình cảm của em với ông qua cây xoài", ["Một con mèo đáng yêu", "Chuyến đi biển của gia đình", "Người bạn mới ở trường"]],
    ["Khi kể lại câu chuyện, em cần kể theo thứ tự nào?", "Đầu câu chuyện - diễn biến - kết thúc", ["Kết thúc trước", "Kể lung tung", "Chỉ kể kết thúc"]],
    ["Nhân vật trong truyện là:", "người hoặc con vật, đồ vật được nhân hóa trong truyện", ["chỉ có người", "chỉ có con vật", "không có gì cả"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET2.3.1", 2, "hieu", mcAuto(r, s, c, w));
  const topics = [
    ["Kể lại một việc em đã làm cùng gia đình vào cuối tuần (3-5 câu).", "Cuối tuần, em và gia đình đi công viên. Em được đi tàu điện. Cả nhà cùng ăn kem. Em rất vui."],
    ["Kể lại một buổi em giúp mẹ việc nhà (3-5 câu).", "Gợi ý: việc gì, làm lúc nào, mẹ nói gì với em."],
    ["Kể về người bạn thân của em (3-5 câu).", "Gợi ý: tên bạn, bạn như thế nào, hai bạn chơi gì."],
    ["Kể lại một chuyện vui ở lớp em (3-5 câu).", "Gợi ý: chuyện gì, xảy ra khi nào, vì sao vui."],
    ["Kể về con vật nuôi ở nhà em (3-5 câu).", "Gợi ý: con gì, trông thế nào, hay làm gì."],
    ["Kể lại lần em bị ốm được mẹ chăm sóc (3-5 câu).", "Gợi ý: ốm khi nào, mẹ làm gì, em cảm thấy thế nào."],
    ["Kể về cô giáo (thầy giáo) của em (3-5 câu).", "Gợi ý: cô tên gì, dạy môn gì, em yêu quý cô vì sao."],
    ["Kể lại chuyến đi chơi xa nhà em nhớ nhất (3-5 câu).", "Gợi ý: đi đâu, với ai, thấy gì thú vị."],
    ["Kể lại một lần em giúp đỡ bạn (3-5 câu).", "Gợi ý: bạn gặp khó khăn gì, em giúp thế nào."],
    ["Kể về món quà sinh nhật em thích nhất (3-5 câu).", "Gợi ý: quà gì, ai tặng, em thích vì sao."],
  ];
  for (const [s, sol] of topics) yield Q("TVIET2.3.1", 2, "van_dung", tl(s, `Mẫu: ${sol}`));
}
function* v241(r) {
  // TVIET2.4.1 mo rong von tu, cau 'Ai la gi?'
  for (let i = 0; i < 12; i++) {
    const cat = pick(r, [["sự vật", TU_SU_VAT], ["hoạt động", TU_HOAT_DONG], ["đặc điểm", TU_DAC_DIEM]]);
    const others = [["sự vật", TU_SU_VAT], ["hoạt động", TU_HOAT_DONG], ["đặc điểm", TU_DAC_DIEM]].filter((x) => x[0] !== cat[0]);
    const ok = pick(r, cat[1]), ws = others.map((x) => pick(r, x[1]));
    yield Q("TVIET2.4.1", 2, "biet", mcAuto(r, `Trong nhóm từ: ${[ok, ...ws].join(", ")} - từ nào chỉ ${cat[0]}?`, ok, ws));
  }
  const stems = [
    ["Câu 'Em là học sinh lớp 2.' thuộc kiểu câu nào?", "Ai là gì?", ["Ai làm gì?", "Ai thế nào?", "Câu cảm"]],
    ["Câu 'Con chim hót.' thuộc kiểu câu nào?", "Ai làm gì?", ["Ai là gì?", "Ai thế nào?", "Câu khiến"]],
    ["Câu 'Bông hoa đẹp quá!' thuộc kiểu câu nào?", "Ai thế nào?", ["Ai là gì?", "Ai làm gì?", "Câu hỏi"]],
    ["Câu nào thuộc kiểu 'Ai là gì?'", "Mẹ em là cô giáo.", ["Em đang học bài.", "Trời rất nắng.", "Ôi đẹp quá!"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET2.4.1", 2, "hieu", mcAuto(r, s, c, w));
}

// ============================================================
// LOP 3
// ============================================================
function* v311(r) {
  // TVIET3.1.1 doc dien cam doan mieu ta, chuyen, tho
  const texts = [
    { t: "Mùa thu, vườn cây rực rỡ hoa quả. Những chùm cam chín vàng như những quả cầu nhỏ treo trên cành. Gió thu mát rượi đưa hương quả thơm ngát.", items: [["Đoạn văn tả mùa hè.", false], ["Quả cam chín màu vàng.", true], ["Gió thu mát rượi.", true], ["Đoạn văn không tả vườn cây.", false]] },
    { t: "Bé Mai ôm con búp bê mẹ mới mua. Mái tóc búp bê xõa mềm như tơ. Hai mắt búp bê đen láy, tròn xoe như hạt nhãn.", items: [["Mái tóc búp bê được so sánh với tơ.", true], ["Mắt búp bê màu xanh.", false], ["Mẹ mua búp bê cho Mai.", true], ["Đoạn văn tả con mèo.", false]] },
  ];
  for (const x of texts)
    yield Q("TVIET3.1.1", 3, "hieu", tf4(`Đọc đoạn sau và xác định đúng/sai: "${x.t}"`, x.items.map(([t, ok]) => ({ t, ok }))));
  yield* docHieu(r, 3, "TVIET3.1.1", Q, tf4, DH3, { mcAuto, sa });
}
function* v312(r) {
  // TVIET3.1.2 dieu bo hanh dong nhan vat, chi tiet
  const stems = [
    ["Trong câu 'Bé Na nhìn mẹ cười rồi ôm chặt lấy mẹ.', từ chỉ hành động của Na là:", "nhìn, cười, ôm", ["mẹ, bé, Na", "chặt, lấy", "rồi, của"]],
    ["Chi tiết nào cho biết nhân vật đang vui?", "Nhân vật cười tươi, hát vang", ["Nhân vật ngồi im", "Nhân vật khóc lóc", "Nhân vật đi ngủ"]],
    ["Trong câu chuyện, điệu bộ của nhân vật giúp ta hiểu:", "tính cách và tâm trạng nhân vật", ["thời tiết", "tên tác giả", "năm xuất bản"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET3.1.2", 3, "hieu", mcAuto(r, s, c, w));
}
function* v321(r) {
  // TVIET3.2.1 chinh ta nghe-viet, phan biet ch/tr s/x l/n dau
  const pairs = [
    ["trâu bò", "châu bò"], ["chăm học", "trăm học"], ["cái chảo", "cái trảo"],
    ["con sáo", "con xáo"], ["suối chảy", "xuối chảy"], ["củ sả", "củ xả"],
    ["lá lúa", "ná núa"], ["con lợn", "con nợn"], ["bản làng", "bản nàng"],
    ["trung thu", "chung thu"], ["xe đạp", "xe đạp"], ["nước sôi", "nước xôi"],
  ];
  for (const [right, wrong] of pairs)
    yield Q("TVIET3.2.1", 3, "biet", mcAuto(r, `Từ nào viết đúng chính tả: "${right}" hay "${wrong}"?`, right, [wrong, "cả hai đúng", "cả hai sai"]));
  const fills = [
    ["__ị vả", "th", "thị vả", ["s", "x", "th"]],
    ["con __i", "ch", "con chim", ["tr", "ch", "s"]],
    ["cây __a", "c", "cây ca", ["tr", "ch", "x"]],
    ["nước __ôi", "s", "nước sôi", ["x", "s", "ch"]],
    ["dòng __uối", "s", "dòng suối", ["x", "s", "tr"]],
    ["con __ai", "n", "con nai", ["l", "n", "r"]],
  ];
  for (const [s, ans, full, opts] of fills)
    yield Q("TVIET3.2.1", 3, "hieu", mcAuto(r, `Điền âm đầu còn thiếu: "${s}"`, ans, opts.filter((x) => x !== ans)));
}
function* v331(r) {
  // TVIET3.3.1 noi ro rang, ke chuyen don gian
  const stems = [
    ["Khi thuyết trình trước lớp, em cần:", "nói to, rõ ràng, nhìn cả lớp", ["nói nhỏ vào tai bạn", "quay mặt vào tường", "đọc chép nguyên bài"]],
    ["Để kể lại câu chuyện hay, em nên kể theo:", "thứ tự diễn biến câu chuyện", ["ý mình thích trước", "ngược từ cuối lên đầu", "không cần thứ tự"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET3.3.1", 3, "hieu", mcAuto(r, s, c, w));
  const topics = [
    ["Kể lại một buổi học đáng nhớ của em (4-5 câu).", "Buổi học diễn ra khi nào, có những ai, em cảm thấy thế nào."],
    ["Giới thiệu về trường em cho bạn mới (4-5 câu).", "Tên trường, ở đâu, có gì đẹp, em thích chỗ nào."],
    ["Kể về một người em yêu quý trong gia đình (4-5 câu).", "Người đó là ai, làm gì, em yêu quý vì sao."],
    ["Kể lại buổi lao động ở lớp em (4-5 câu).", "Làm việc gì, ai phân công, kết quả thế nào."],
    ["Kể về một buổi sinh hoạt tập thể (4-5 câu).", "Hoạt động gì, các bạn thế nào, em vui ra sao."],
    ["Kể lại lần đầu em học nấu ăn cùng mẹ (4-5 câu).", "Nấu món gì, khó khăn ra sao, kết quả thế nào."],
    ["Giới thiệu một đồ chơi em thích (4-5 câu).", "Đồ chơi gì, trông thế nào, chơi ra sao."],
    ["Kể về phong cảnh quê hương em (4-5 câu).", "Quê ở đâu, có gì đẹp, em nhớ nhất điều gì."],
  ];
  for (const [s, sol] of topics) yield Q("TVIET3.3.1", 3, "van_dung", tl(s, `Gợi ý: ${sol}`));
}
function* v341(r) {
  // TVIET3.4.1 tu dong nghia/trai nghia, so sanh, nhan hoa
  for (const [a, b] of DONG_NGHIA)
    yield Q("TVIET3.4.1", 3, "biet", mcAuto(r, `Từ nào đồng nghĩa với "${a}"?`, b,
      DONG_NGHIA.filter((x) => x[1] !== b).map((x) => x[1])));
  for (const [a, b] of TRAI_NGHIA)
    yield Q("TVIET3.4.1", 3, "biet", mcAuto(r, `Từ nào trái nghĩa với "${a}"?`, b,
      TRAI_NGHIA.filter((x) => x[1] !== b).map((x) => x[1])));
  for (const [a, b] of DONG_NGHIA)
    yield Q("TVIET3.4.1", 3, "hieu", sa(`Viết một từ đồng nghĩa với "${a}".`, b, `Từ đồng nghĩa với "${a}": ${b}`));
  for (const [a, b] of TRAI_NGHIA)
    yield Q("TVIET3.4.1", 3, "hieu", sa(`Viết từ trái nghĩa với "${a}".`, b, `Từ trái nghĩa với "${a}": ${b}`));
  const capTN = [
    ["Tìm và viết lại cặp từ trái nghĩa trong câu: 'Người lớn giúp đỡ trẻ nhỏ.'", "lớn - nhỏ"],
    ["Tìm và viết lại cặp từ trái nghĩa trong câu: 'Đường lên dốc khó, xuống dốc dễ.'", "lên - xuống (khó - dễ)"],
    ["Tìm và viết lại cặp từ trái nghĩa trong câu: 'Ngày hè dài, đêm hè ngắn.'", "dài - ngắn (ngày - đêm)"],
    ["Tìm và viết lại cặp từ trái nghĩa trong câu: 'Đèn mở khi trời tắt.'", "mở - tắt"],
  ];
  for (const [s, c] of capTN)
    yield Q("TVIET3.4.1", 3, "van_dung", sa(s, c, `Cặp từ trái nghĩa: ${c}.`));
  const stems = [
    ["Trong câu 'Nụ hoa xinh như ngôi sao.', từ dùng để so sánh là:", "như", ["xinh", "hoa", "sao"]],
    ["Câu nào có hình ảnh so sánh?", "Tiếng suối trong như tiếng hát xa.", ["Tiếng suối chảy.", "Suối ở trong rừng.", "Tiếng suối to."]],
    ["Câu 'Chị gà Nơ-vi-na nhảy tưng tưng.' sử dụng biện pháp:", "nhân hóa", ["so sánh", "liệt kê", "hỏi đáp"]],
    ["Từ 'xinh xắn' có nghĩa giống từ nào?", "xinh đẹp", ["xấu xí", "to lớn", "bé nhỏ"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET3.4.1", 3, "hieu", mcAuto(r, s, c, w));
}

// ============================================================
// LOP 4
// ============================================================
function* v411(r) {
  // TVIET4.1.1 doc dien cam truyen, kich, tho
  const texts = [
    { t: "Đường vào làng quanh co như con rồng nằm. Hai bên đường, hàng tre xanh rì rào chạy theo gió. Xa xa, cánh đồng lúa chín vàng rộng mênh mông.", items: [["Đường làng được so sánh với con rồng nằm.", true], ["Đoạn văn tả thành phố.", false], ["Hai bên đường có hàng tre.", true], ["Cánh đồng lúa màu xanh non.", false]] },
    { t: "Bác Hùng cầm cuốc ra đồng từ lúc trời còn tối. Giọt mồ hôi lăn trên trán bác. Bác vẫn miệt mài với đất trồng.", items: [["Bác Hùng ra đồng lúc trưa.", false], ["Bác Hùng là người chăm chỉ.", true], ["Bác đi ra đồng lúc trời còn tối.", true], ["Bác Hùng không thích làm việc.", false]] },
  ];
  for (const x of texts)
    yield Q("TVIET4.1.1", 4, "hieu", tf4(`Đọc đoạn sau và xác định đúng/sai: "${x.t}"`, x.items.map(([t, ok]) => ({ t, ok }))));
  yield* docHieu(r, 4, "TVIET4.1.1", Q, tf4, DH4, { mcAuto, sa });
}
function* v412(r) {
  // TVIET4.1.2 thoi gian, dia diem, tac dung trong chuyen
  const stems = [
    ["Trong câu chuyện, yếu tố 'thời gian' cho biết:", "chuyện xảy ra lúc nào", ["chuyện xảy ra ở đâu", "ai là nhân vật", "tên tác giả"]],
    ["Trong câu chuyện, yếu tố 'địa điểm' cho biết:", "chuyện xảy ra ở đâu", ["chuyện xảy ra khi nào", "nhân vật tên gì", "kết thúc thế nào"]],
    ["Trong câu 'Sáng hôm sau, An chạy ra bờ sông.', từ chỉ thời gian là:", "sáng hôm sau", ["chạy", "bờ sông", "An"]],
    ["Trong câu 'Sáng hôm sau, An chạy ra bờ sông.', từ chỉ địa điểm là:", "bờ sông", ["sáng", "An", "chạy"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET4.1.2", 4, "hieu", mcAuto(r, s, c, w));
}
function* v421(r) {
  // TVIET4.2.1 viet van ke lai/mieu ta
  const topics = [
    ["Viết một đoạn văn (5-6 câu) miêu tả một đồ vật em yêu thích.", "đồ vật là gì, hình dáng, màu sắc, công dụng, tình cảm của em."],
    ["Kể lại một sự việc em đã chứng kiến ở trường.", "sự việc xảy ra khi nào, ở đâu, những ai có mặt, diễn biến và kết thúc."],
    ["Viết đoạn văn tả cây cối ở sân trường em.", "cây gì, thân - lá - hoa thế nào, cây có ích gì."],
    ["Viết đoạn văn kể lại buổi sinh hoạt lớp đầu tuần.", "buổi sinh hoạt có gì, cô giáo nói gì, em nghĩ gì."],
    ["Viết đoạn văn tả con vật nuôi em yêu thích.", "con gì, ngoại hình, thói quen, tình cảm của em."],
    ["Kể lại một lần em đi thăm người thân.", "đi đâu, với ai, gặp ai, em vui thế nào."],
    ["Viết đoạn văn tả cơn mưa em vừa chứng kiến.", "trời trước mưa, lúc mưa, sau mưa ra sao."],
    ["Kể lại một lần em được khen vì làm việc tốt.", "việc gì, ai khen, em cảm thấy thế nào."],
    ["Viết đoạn văn tả cặp sách của em.", "hình dáng, màu sắc, bên trong có gì, em giữ gìn ra sao."],
    ["Kể lại buổi em tham gia thi đấu thể thao.", "môn gì, em thi thế nào, kết quả và cảm xúc."],
  ];
  for (const [s, sol] of topics) yield Q("TVIET4.2.1", 4, "van_dung", tl(s, `Gợi ý: ${sol}`));
  const stems = [
    ["Mở bài trong bài văn miêu tả đồ vật cần:", "giới thiệu đồ vật sẽ tả", ["kể chuyện cổ tích", "nêu cảm nghĩ về cha mẹ", "viết ngay kết bài"]],
    ["Bài văn kể lại sự việc cần có đủ:", "thời gian, địa điểm, nhân vật, diễn biến", ["chỉ cần tên nhân vật", "chỉ cần kết thúc", "chỉ cần mở bài"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET4.2.1", 4, "hieu", mcAuto(r, s, c, w));
}
function* v431(r) {
  // TVIET4.3.1 thuyet trinh, gioi thieu, ke chuyen
  const stems = [
    ["Khi giới thiệu về một đồ vật, em nên nêu:", "tên, nguồn gốc, công dụng của đồ vật", ["chỉ màu sắc", "chỉ giá tiền", "không cần giới thiệu"]],
    ["Khi thuyết trình, giọng nói cần:", "vừa đủ nghe, rõ ràng, có ngữ điệu", ["thì thầm nhỏ", "hét thật to", "đọc đều đều"]],
    ["Khi kể lại câu chuyện đã đọc, em cần nhớ:", "nhân vật và diễn biến chính của truyện", ["chỉ tên truyện", "chỉ tác giả", "không cần nhớ gì"]],
    ["Giới thiệu về quê hương, em nên nói về:", "cảnh đẹp, con người, đặc sản của quê", ["chỉ thời tiết", "chỉ tên tỉnh", "không liên quan"]],
    ["Khi nghe bạn thuyết trình, em nên:", "lắng nghe và đặt câu hỏi khi cần", ["nói chuyện riêng", "ngủ gật", "ngắt lời liên tục"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET4.3.1", 4, "hieu", mcAuto(r, s, c, w));
  const topics = [
    ["Giới thiệu với cả lớp về quyển sách em vừa đọc (4-5 câu).", "tên sách, nội dung chính, em thích phần nào."],
    ["Thuyết trình ngắn giới thiệu một danh lam thắng cảnh của quê em (4-5 câu).", "ở đâu, có gì đẹp, vì sao nên đến thăm."],
    ["Giới thiệu về một nhân vật truyện em yêu thích (4-5 câu).", "nhân vật ở truyện nào, tính cách, em thích vì sao."],
  ];
  for (const [s, sol] of topics) yield Q("TVIET4.3.1", 4, "van_dung", tl(s, `Gợi ý: ${sol}`));
}
function* v441(r) {
  // TVIET4.4.1 danh/dong/tinh tu, loai cau, chu-vi ngu
  const words = [["cái bàn", "danh từ"], ["chạy", "động từ"], ["đẹp", "tính từ"], ["quyển vở", "danh từ"], ["học", "động từ"], ["ngoan", "tính từ"], ["con chó", "danh từ"], ["hát", "động từ"]];
  for (const [w, t] of words) {
    const others = ["danh từ", "động từ", "tính từ"].filter((x) => x !== t);
    yield Q("TVIET4.4.1", 4, "biet", mcAuto(r, `Từ "${w}" là loại từ nào?`, t, others));
  }
  const stems = [
    ["Câu 'Em yêu mẹ!' thuộc loại câu nào?", "Câu cảm", ["Câu hỏi", "Câu kể", "Câu khiến"]],
    ["Câu 'Hãy đọc bài đi!' thuộc loại câu nào?", "Câu khiến", ["Câu hỏi", "Câu kể", "Câu cảm"]],
    ["Câu 'Bạn học lớp mấy?' thuộc loại câu nào?", "Câu hỏi", ["Câu kể", "Câu cảm", "Câu khiến"]],
    ["Trong câu 'Con mèo nằm ngủ.', chủ ngữ là:", "Con mèo", ["nằm ngủ", "con", "ngủ"]],
    ["Trong câu 'Con mèo nằm ngủ.', vị ngữ là:", "nằm ngủ", ["Con mèo", "mèo", "nằm"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET4.4.1", 4, "hieu", mcAuto(r, s, c, w));
  // TLN: tim tu loai trong cau
  const saItems = [
    ["Ghi lại danh từ trong câu: 'Con mèo nằm ngủ trên bàn.'", "mèo, bàn", "Danh từ: con mèo, bàn."],
    ["Ghi lại động từ trong câu: 'Các bạn chơi đá cầu.'", "chơi, đá", "Động từ: chơi, đá."],
    ["Ghi lại tính từ trong câu: 'Bông hoa thật đẹp.'", "đẹp", "Tính từ: đẹp."],
    ["Đặt một câu hỏi với từ 'bao giờ'.", "(Câu hỏi dùng 'bao giờ')", "Mẫu: Bao giờ em đi học?"],
    ["Ghi lại chủ ngữ trong câu: 'Mẹ em nấu cơm.'", "Mẹ em", "Chủ ngữ: Mẹ em."],
    ["Ghi lại vị ngữ trong câu: 'Trời hôm nay rất nắng.'", "rất nắng", "Vị ngữ: rất nắng."],
  ];
  for (const [s, c, sol] of saItems) yield Q("TVIET4.4.1", 4, "van_dung", sa(s, c, sol));
}

// ============================================================
// LOP 5
// ============================================================
function* v511(r) {
  // TVIET5.1.1 doc dien cam van ban
  const texts = [
    { t: "Mùa xuân đến, vườn đào nở hoa hồng phớt. Những cánh hoa mỏng manh rung rinh trong gió. Cả khu vườn như khoác áo mới tươi thắm.", items: [["Vườn đào nở hoa vào mùa xuân.", true], ["Cánh hoa được tả là mỏng manh.", true], ["Đoạn văn tả mùa đông.", false], ["Vườn đào trổ quả.", false]] },
    { t: "Ông nội em đã ngoài bảy mươi nhưng vẫn khỏe mạnh. Sáng nào ông cũng đi bộ quanh hồ. Ông bảo vận động giúp người khỏe mạnh và sống lâu.", items: [["Ông nội đã trên bảy mươi tuổi.", true], ["Ông đi bộ buổi tối.", false], ["Ông cho rằng vận động tốt cho sức khỏe.", true], ["Ông nội ốm yếu.", false]] },
  ];
  for (const x of texts)
    yield Q("TVIET5.1.1", 5, "hieu", tf4(`Đọc đoạn sau và xác định đúng/sai: "${x.t}"`, x.items.map(([t, ok]) => ({ t, ok }))));
  yield* docHieu(r, 5, "TVIET5.1.1", Q, tf4, DH5, { mcAuto, sa });
}
function* v512(r) {
  // TVIET5.1.2 van ban tuong tuong vs nguoi that viec that
  const stems = [
    ["Văn bản viết về người thật, việc thật có đặc điểm:", "nhân vật và sự việc có thật trong đời sống", ["nhân vật do tưởng tượng ra", "luôn là chuyện thần thoại", "không có nhân vật"]],
    ["Truyện cổ tích là văn bản:", "viết theo tưởng tượng", ["viết về việc thật", "viết về lịch sử", "viết về khoa học"]],
    ["Bài viết về Bác Hồ là văn bản:", "viết về người thật, việc thật", ["viết theo tưởng tượng", "viết về truyện cổ tích", "viết thơ"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET5.1.2", 5, "hieu", mcAuto(r, s, c, w));
}
function* v521(r) {
  // TVIET5.2.1 viet van ke chuyen sang tao
  const topics = [
    ["Viết đoạn văn (6-8 câu) kể lại một câu chuyện em đã đọc, thêm chi tiết sáng tạo.", "nêu tên truyện, nhân vật chính, diễn biến chính, thêm chi tiết tưởng tượng hợp lý."],
    ["Viết bài văn miêu tả một người thân em yêu quý.", "mở bài giới thiệu người, thân bài tả ngoại hình + hoạt động + tính cách, kết bài tình cảm."],
    ["Viết bài văn tả một cảnh đẹp quê hương em.", "cảnh ở đâu, buổi nào đẹp nhất, chi tiết đặc trưng, tình cảm của em."],
    ["Kể lại câu chuyện 'Thạch Sanh' bằng lời của một nhân vật phụ.", "chọn vai (mẹ Thạch Sanh, Lí Thông...), kể nhất quán theo nhân vật đó."],
    ["Viết đoạn văn tưởng tượng em đi du hành mặt trăng.", "em gặp ai, thấy gì, cảm xúc ra sao."],
    ["Viết bài văn tả ngôi trường của em.", "vị trí, cổng - sân - lớp học, hoạt động, tình cảm của em."],
    ["Viết đoạn văn kể lại giấc mơ đẹp nhất của em.", "mơ thấy gì, ở đâu, với ai, khi tỉnh em nghĩ gì."],
    ["Kể lại một câu chuyện cổ tích bằng giọng kể của em (8-10 câu).", "tên truyện, nhân vật, diễn biến, kết thúc, bài học."],
  ];
  for (const [s, sol] of topics) yield Q("TVIET5.2.1", 5, "van_dung", tl(s, `Gợi ý: ${sol}`));
  const stems = [
    ["Khi kể lại câu chuyện với chi tiết sáng tạo, em có thể:", "thêm chi tiết miêu tả hợp lý, đổi kết thúc", ["chép y nguyên truyện gốc", "xóa hết nhân vật", "viết sang tiếng Anh"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET5.2.1", 5, "hieu", mcAuto(r, s, c, w));
}
function* v531(r) {
  // TVIET5.3.1 thuyet trinh, tranh bien don gian
  const stems = [
    ["Khi tranh biện về một vấn đề, em cần:", "đưa ý kiến kèm lí lẽ và dẫn chứng", ["cãi to để thắng", "không nghe ý kiến khác", "im lặng"]],
    ["Trong thuyết trình nhóm, phần mở đầu nên:", "nêu rõ vấn đề sẽ trình bày", ["nói lời kết", "chuyển sang phần khác", "đọc toàn bài"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET5.3.1", 5, "hieu", mcAuto(r, s, c, w));
}
function* v541(r) {
  // TVIET5.4.1 dong am/nhieu nghia, dai tu/ket tu/quan he tu, cau ghep, tu lay
  const stems = [
    ["Từ 'đánh' trong 'đánh trống' và 'đánh nhau' là từ:", "đa nghĩa", ["đồng âm", "đồng nghĩa", "trái nghĩa"]],
    ["Từ 'nghỉ' trong 'nghỉ học' và 'nghỉ ngơi' là từ:", "đồng âm", ["đa nghĩa", "đồng nghĩa", "từ láy"]],
    ["Trong câu 'Tôi đi học.', từ 'Tôi' là:", "đại từ", ["danh từ", "động từ", "tính từ"]],
    ["Trong câu 'Em và bạn cùng học.', từ 'và' là:", "kết từ", ["đại từ", "danh từ", "quan hệ từ"]],
    ["Câu 'Vì trời mưa nên em ở nhà.' có từ nối là:", "vì ... nên", ["em", "nhà", "mưa"]],
    ["Câu 'Mẹ vừa nấu ăn vừa nghe nhạc.' là:", "câu ghép", ["câu đơn", "câu hỏi", "câu cảm"]],
    ["Từ 'tươi tốt' là:", "từ láy", ["từ ghép", "danh từ", "đại từ"]],
    ["Từ 'nhà cửa' là:", "từ ghép", ["từ láy", "đại từ", "tính từ"]],
  ];
  for (const [s, c, w] of stems) yield Q("TVIET5.4.1", 5, "hieu", mcAuto(r, s, c, w));
  for (const [a, b] of DONG_NGHIA.slice(0, 5))
    yield Q("TVIET5.4.1", 5, "biet", mcAuto(r, `Từ đồng nghĩa với "${a}" là:`, b, DONG_NGHIA.filter((x) => x[1] !== b).map((x) => x[1])));
  for (const [tn, nghia] of THANH_NGU)
    yield Q("TVIET5.4.1", 5, "hieu", mcAuto(r, `Thành ngữ "${tn}" có nghĩa là:`, nghia,
      THANH_NGU.filter((x) => x[1] !== nghia).map((x) => x[1])));
  const saItems = [
    ["Viết một từ láy có nghĩa là tươi đẹp, phát triển tốt.", "tươi tốt", "Từ láy: tươi tốt."],
    ["Ghi lại đại từ trong câu: 'Tôi đi học.'", "Tôi", "Đại từ: Tôi."],
    ["Ghi lại quan hệ từ trong câu: 'Vì trời mưa nên em ở nhà.'", "vì ... nên", "Quan hệ từ: vì - nên."],
    ["Viết một thành ngữ nói về lòng biết ơn.", "uống nước nhớ nguồn", "Thành ngữ: uống nước nhớ nguồn."],
    ["Ghi lại từ ghép trong câu: 'Nhà cửa sạch sẽ.'", "nhà cửa", "Từ ghép: nhà cửa."],
  ];
  for (const [s, c, sol] of saItems) yield Q("TVIET5.4.1", 5, "van_dung", sa(s, c, sol));
}

export const TVIET_GEN = {
  "TVIET1.1.1": v111, "TVIET1.2.1": v121, "TVIET1.3.1": v131, "TVIET1.4.1": v141,
  "TVIET2.1.1": v211, "TVIET2.2.1": v221, "TVIET2.3.1": v231, "TVIET2.4.1": v241,
  "TVIET3.1.1": v311, "TVIET3.1.2": v312, "TVIET3.2.1": v321, "TVIET3.3.1": v331, "TVIET3.4.1": v341,
  "TVIET4.1.1": v411, "TVIET4.1.2": v412, "TVIET4.2.1": v421, "TVIET4.3.1": v431, "TVIET4.4.1": v441,
  "TVIET5.1.1": v511, "TVIET5.1.2": v512, "TVIET5.2.1": v521, "TVIET5.3.1": v531, "TVIET5.4.1": v541,
};
