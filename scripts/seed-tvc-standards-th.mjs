/**
 * CR-023: Seed YCCĐ cấp tiểu học cho schema `tvc` (dùng chung cho module
 * Công cụ soạn học liệu trong SCN và app TVC360).
 * Bộ khung tham khảo theo CTGDPT 2018 (TT 32/2018) - trường tuỳ chỉnh tiếp
 * qua trang /studio/yccd (thêm/sửa/xoá có school_id riêng).
 * Usage: node scripts/seed-tvc-standards-th.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => l.split("=", 2).map((s) => s.trim())),
);
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const NL_TOAN = ["Tư duy và lập luận toán học", "Giải quyết vấn đề toán học", "Giao tiếp toán học"];
const NL_TOAN_MH = ["Mô hình hoá toán học", "Giải quyết vấn đề toán học"];
const NL_TV = ["Năng lực ngôn ngữ", "Năng lực văn học"];
const NL_TV_GT = ["Năng lực giao tiếp", "Năng lực ngôn ngữ"];
const NL_ANH = ["Năng lực giao tiếp tiếng Anh"];

// [code, subject, grade, strand, description, competencies]
const DATA = [
  // ===== TOÁN 1 =====
  ["TOAN1.1.1", "toan", 1, "Số và phép tính", "Đếm, đọc, viết, so sánh, sắp xếp thứ tự các số trong phạm vi 100; nhận biết cấu tạo số có hai chữ số.", NL_TOAN],
  ["TOAN1.1.2", "toan", 1, "Số và phép tính", "Thực hiện được phép cộng, phép trừ không nhớ trong phạm vi 10 và 100; tính nhẩm các trường hợp đơn giản.", NL_TOAN],
  ["TOAN1.1.3", "toan", 1, "Số và phép tính", "Nhận biết ý nghĩa thực tiễn của phép cộng, phép trừ; giải được bài toán có lời văn liên quan đến phép cộng, phép trừ.", NL_TOAN_MH],
  ["TOAN1.2.1", "toan", 1, "Hình học và đo lường", "Nhận dạng được hình vuông, hình tròn, hình tam giác, hình chữ nhật; khối hộp chữ nhật, khối lập phương trong thực tế.", ["Tư duy và lập luận toán học", "Giao tiếp toán học"]],
  ["TOAN1.2.2", "toan", 1, "Hình học và đo lường", "Đo được độ dài bằng gang tay, sải tay, bước chân và đơn vị cm; xem giờ đúng trên đồng hồ; nhận biết các ngày trong tuần, ngày - tháng.", NL_TOAN],
  ["TOAN1.3.1", "toan", 1, "Hoạt động thực hành và trải nghiệm", "Vận dụng đếm, đo, định vị vào tình huống thực tế (vị trí, hướng đi, tổ chức trò chơi, trưng bày).", NL_TOAN_MH],
  // ===== TOÁN 2 =====
  ["TOAN2.1.1", "toan", 2, "Số và phép tính", "Đếm, đọc, viết, so sánh, làm tròn các số trong phạm vi 1000; phân tích cấu tạo số có ba chữ số.", NL_TOAN],
  ["TOAN2.1.2", "toan", 2, "Số và phép tính", "Cộng, trừ có nhớ trong phạm vi 100; cộng, trừ không nhớ trong phạm vi 1000; tính nhẩm và tính giá trị biểu thức đơn giản.", NL_TOAN],
  ["TOAN2.1.3", "toan", 2, "Số và phép tính", "Nhận biết phép nhân, phép chia; thuộc bảng nhân, bảng chia 2 đến 5; giải bài toán liên quan đến phép nhân, phép chia.", NL_TOAN_MH],
  ["TOAN2.2.1", "toan", 2, "Hình học và đo lường", "Nhận dạng khối trụ, khối cầu; đường thẳng, đoạn thẳng, đường gấp khúc; ba điểm thẳng hàng, điểm ở giữa.", ["Tư duy và lập luận toán học", "Giao tiếp toán học"]],
  ["TOAN2.2.2", "toan", 2, "Hình học và đo lường", "Đo và chuyển đổi độ dài (cm, dm, m); đọc giờ - phút trên đồng hồ; xem lịch, xác định ngày - tháng - năm; nhận biết tiền Việt Nam.", NL_TOAN],
  ["TOAN2.3.1", "toan", 2, "Hoạt động thực hành và trải nghiệm", "Thực hành cân, đo, đong, xem giờ - lịch; thu thập và sắp xếp số liệu đơn giản trong hoạt động lớp học.", NL_TOAN_MH],
  // ===== TOÁN 3 =====
  ["TOAN3.1.1", "toan", 3, "Số và phép tính", "Đọc, viết, so sánh, làm tròn các số trong phạm vi 100 000; cấu tạo số; nhận biết chữ số La Mã.", NL_TOAN],
  ["TOAN3.1.2", "toan", 3, "Số và phép tính", "Thực hiện bốn phép tính trong phạm vi 100 000 (nhân, chia có nhớ); thuộc bảng nhân, chia 6 - 9; tính giá trị biểu thức có đến hai phép tính.", NL_TOAN],
  ["TOAN3.1.3", "toan", 3, "Số và phép tính", "Nhận biết phân số (1/2, 1/3, 1/4...) qua mô hình trực quan; so sánh các phân số cùng mẫu đơn giản.", NL_TOAN],
  ["TOAN3.1.4", "toan", 3, "Số và phép tính", "Giải bài toán có đến hai bước tính liên quan đến ý nghĩa của các phép tính (gấp lên, giảm đi, so sánh hơn kém).", NL_TOAN_MH],
  ["TOAN3.2.1", "toan", 3, "Hình học và đo lường", "Nhận biết hình tròn (tâm, bán kính, đường kính), trung điểm của đoạn thẳng, góc vuông - góc không vuông; tính chu vi tam giác, tứ giác, hình chữ nhật, hình vuông.", NL_TOAN],
  ["TOAN3.2.2", "toan", 3, "Hình học và đo lường", "Đo và chuyển đổi đơn vị (mm, ml, g, độ C); nhận biết diện tích của hình; sử dụng tiền Việt Nam trong giao dịch đơn giản.", NL_TOAN],
  ["TOAN3.3.1", "toan", 3, "Một số yếu tố thống kê và xác suất", "Thu thập, phân loại, ghi chép và đọc bảng số liệu đơn giản về đối tượng quen thuộc.", NL_TOAN_MH],
  // ===== TOÁN 4 =====
  ["TOAN4.1.1", "toan", 4, "Số và phép tính", "Đọc, viết, so sánh, làm tròn số tự nhiên đến hàng triệu; nhận biết dãy số; đọc số La Mã đến 30.", NL_TOAN],
  ["TOAN4.1.2", "toan", 4, "Số và phép tính", "Thực hiện bốn phép tính với số tự nhiên (nhân, chia số có nhiều chữ số); vận dụng tính chất giao hoán, kết hợp, phân phối để tính nhẩm, tính hợp lí.", NL_TOAN],
  ["TOAN4.1.3", "toan", 4, "Số và phép tính", "Nhận biết, đọc, viết phân số; so sánh, rút gọn, quy đồng mẫu số; thực hiện các phép tính cộng - trừ - nhân - chia với phân số.", NL_TOAN],
  ["TOAN4.1.4", "toan", 4, "Số và phép tính", "Nhận biết số thập phân; đọc, viết, so sánh số thập phân; cộng, trừ số thập phân đơn giản.", NL_TOAN],
  ["TOAN4.2.1", "toan", 4, "Hình học và đo lường", "Nhận biết góc nhọn, góc vuông, góc tù, góc bẹt; hai đường thẳng song song, vuông góc; hình thoi, hình bình hành; tính chu vi - diện tích hình chữ nhật, hình vuông.", NL_TOAN],
  ["TOAN4.2.2", "toan", 4, "Hình học và đo lường", "Đo và chuyển đổi đơn vị khối lượng (yến, tạ, tấn), diện tích (dm2, m2, mm2), thời gian (giây, phút, giờ, thế kỉ); ước lượng kết quả đo.", NL_TOAN],
  ["TOAN4.3.1", "toan", 4, "Một số yếu tố thống kê và xác suất", "Đọc, mô tả, lập biểu đồ cột; phân tích số liệu; đếm số lần xuất hiện của sự kiện; tính số trung bình cộng.", NL_TOAN_MH],
  // ===== TOÁN 5 =====
  ["TOAN5.1.1", "toan", 5, "Số và phép tính", "Đọc, viết, so sánh, làm tròn số thập phân; thực hiện bốn phép tính với số thập phân; chuyển đổi phân số - số thập phân.", NL_TOAN],
  ["TOAN5.1.2", "toan", 5, "Số và phép tính", "Nhận biết tỉ số, tỉ số phần trăm của hai đại lượng cùng loại; giải bài toán liên quan đến tỉ số phần trăm (lãi suất, giảm giá, điểm số).", NL_TOAN_MH],
  ["TOAN5.1.3", "toan", 5, "Số và phép tính", "Giải bài toán về quan hệ tỉ lệ thuận, tỉ lệ nghịch; tìm hai số khi biết tổng - hiệu và tỉ số của hai số đó.", NL_TOAN_MH],
  ["TOAN5.2.1", "toan", 5, "Hình học và đo lường", "Tính chu vi - diện tích hình tam giác, hình thang, hình tròn; diện tích xung quanh, diện tích toàn phần, thể tích hình hộp chữ nhật, hình lập phương; chuyển đổi đơn vị thể tích.", NL_TOAN],
  ["TOAN5.2.2", "toan", 5, "Hình học và đo lường", "Nhận biết vận tốc; tính quãng đường, thời gian, vận tốc trong chuyển động đều đơn giản.", NL_TOAN_MH],
  ["TOAN5.3.1", "toan", 5, "Một số yếu tố thống kê và xác suất", "Đọc và mô tả biểu đồ hình quạt; nhận biết khả năng xảy ra của sự kiện qua trò chơi, thực nghiệm đơn giản.", NL_TOAN_MH],

  // ===== TIẾNG VIỆT 1 =====
  ["TVIET1.1.1", "tieng_viet", 1, "Đọc", "Đọc đúng, rõ ràng các văn bản ngắn đã học với tốc độ phù hợp; nhận biết nhân vật, sự việc chính trong văn bản.", NL_TV],
  ["TVIET1.2.1", "tieng_viet", 1, "Viết", "Viết đúng chính tả, đúng cỡ chữ bài tập chép hoặc nghe - viết ngắn; viết được câu, tên riêng, địa chỉ đơn giản.", NL_TV],
  ["TVIET1.3.1", "tieng_viet", 1, "Nói và nghe", "Kể lại được câu chuyện ngắn, trao đổi lời chào, lời xin phép, cảm ơn, xin lỗi phù hợp tình huống; nghe và đáp lại đúng phép lịch sự.", NL_TV_GT],
  ["TVIET1.4.1", "tieng_viet", 1, "Kiến thức tiếng Việt", "Nhận biết âm, vần, thanh điệu; từ ngữ chỉ sự vật, hoạt động, đặc điểm quen thuộc; nhận biết dấu chấm, dấu phẩy.", NL_TV],
  // ===== TIẾNG VIỆT 2 =====
  ["TVIET2.1.1", "tieng_viet", 2, "Đọc", "Đọc trôi chảy văn bản tự sự, miêu tả, thơ ngắn; nêu được ý chính, chi tiết yêu thích và liên hệ với bản thân.", NL_TV],
  ["TVIET2.2.1", "tieng_viet", 2, "Viết", "Viết đúng chính tả bài nghe - viết; viết đoạn văn 3-5 câu kể việc đã làm, tả đồ vật hoặc tả cảnh; dùng đúng chữ hoa và dấu câu.", NL_TV],
  ["TVIET2.3.1", "tieng_viet", 2, "Nói và nghe", "Kể chuyện theo tranh hoặc gợi ý; trình bày ý kiến trước nhóm; nghe và ghi nhận ý kiến của bạn.", NL_TV_GT],
  ["TVIET2.4.1", "tieng_viet", 2, "Kiến thức tiếng Việt", "Mở rộng vốn từ chỉ sự vật, hoạt động, đặc điểm theo chủ điểm; nhận biết câu nêu hoạt động; dùng dấu chấm, dấu chấm hỏi, dấu chấm than.", NL_TV],
  // ===== TIẾNG VIỆT 3 =====
  ["TVIET3.1.1", "tieng_viet", 3, "Đọc", "Đọc hiểu văn bản tự sự, miêu tả, thông tin, thơ; nêu ý chính, cảm nhận nhân vật và hình ảnh; đọc theo vai truyện có lời nhân vật.", NL_TV],
  ["TVIET3.2.1", "tieng_viet", 3, "Viết", "Viết đoạn văn kể việc có thật, miêu tả người - đồ vật - cảnh; viết đơn xin phép, ghi chép thông tin; viết đúng chính tả phân biệt âm, vần dễ lẫn.", NL_TV],
  ["TVIET3.3.1", "tieng_viet", 3, "Nói và nghe", "Kể lại chuyện đã học, trao đổi về nhân vật, sự việc; giới thiệu đồ vật, hoạt động; nghe và phản hồi lịch sự.", NL_TV_GT],
  ["TVIET3.4.1", "tieng_viet", 3, "Kiến thức tiếng Việt", "Mở rộng vốn từ theo chủ điểm; nhận biết phép so sánh; đặt câu theo mẫu Ai là gì - Ai làm gì - Ai thế nào; nhận biết từ đồng nghĩa; dấu hai chấm, dấu chấm phẩy.", NL_TV],
  // ===== TIẾNG VIỆT 4 =====
  ["TVIET4.1.1", "tieng_viet", 4, "Đọc", "Đọc hiểu truyện, thơ, văn bản thông tin - khoa học; tóm tắt nội dung, nhận xét nhân vật, rút ra ý nghĩa; đọc phân vai, đọc diễn cảm đoạn thơ, văn.", NL_TV],
  ["TVIET4.2.1", "tieng_viet", 4, "Viết", "Viết bài văn miêu tả đồ vật - cây cối - cảnh, kể chuyện sáng tạo, tường thuật sự việc; viết thư, nhật ký, bài giới thiệu ngắn.", NL_TV],
  ["TVIET4.3.1", "tieng_viet", 4, "Nói và nghe", "Thuyết trình giới thiệu, kể chuyện có cảm xúc; trao đổi, thảo luận về nội dung văn bản; nghe hiểu và tóm tắt ý chính bài nói.", NL_TV_GT],
  ["TVIET4.4.1", "tieng_viet", 4, "Kiến thức tiếng Việt", "Nhận biết danh từ, động từ, tính từ; câu hỏi, câu kể, câu cảm, câu khiến; mở rộng vốn từ theo chủ đề; dấu gạch ngang, dấu ngoặc kép.", NL_TV],
  // ===== TIẾNG VIỆT 5 =====
  ["TVIET5.1.1", "tieng_viet", 5, "Đọc", "Đọc hiểu văn bản tự sự, miêu tả, thông tin, nghị luận sơ giản, thơ; phân tích nhân vật, hình ảnh và biện pháp nghệ thuật đơn giản; đọc diễn cảm phù hợp nội dung.", NL_TV],
  ["TVIET5.2.1", "tieng_viet", 5, "Viết", "Viết bài văn tả người - cảnh - hoạt động, kể chuyện tưởng tượng, viết về trải nghiệm của bản thân; viết đơn, thư, báo cáo ngắn và biên bản đơn giản.", NL_TV],
  ["TVIET5.3.1", "tieng_viet", 5, "Nói và nghe", "Thuyết trình, tranh biện đơn giản về chủ đề quen thuộc; kể chuyện sáng tạo; nghe hiểu và trình bày lại nội dung chính; thực hiện phỏng vấn đơn giản.", NL_TV_GT],
  ["TVIET5.4.1", "tieng_viet", 5, "Kiến thức tiếng Việt", "Nhận biết từ đồng nghĩa, trái nghĩa, đồng âm, nhiều nghĩa; đại từ, quan hệ từ; câu đơn - câu ghép; thành ngữ, tục ngữ theo chủ đề.", NL_TV],

  // ===== TIẾNG ANH 3 =====
  ["ANH3.1.1", "tieng_anh", 3, "Nghe", "Nghe và nhận biết lời chào, tên, đồ vật, màu sắc, số đếm đến 20; nghe hiểu mẫu câu đơn giản trong giao tiếp quen thuộc.", NL_ANH],
  ["ANH3.2.1", "tieng_anh", 3, "Nói", "Nói lời chào, tạm biệt, giới thiệu tên - tuổi; hỏi đáp về đồ vật, màu sắc, con vật theo mẫu câu đã học.", NL_ANH],
  ["ANH3.3.1", "tieng_anh", 3, "Đọc", "Đọc và hiểu từ, cụm từ, câu đơn về chủ đề quen thuộc (gia đình, đồ dùng học tập, con vật, lớp học).", NL_ANH],
  ["ANH3.4.1", "tieng_anh", 3, "Viết", "Viết đúng chữ cái, từ, câu đơn theo mẫu; điền từ còn thiếu để hoàn thành câu, đoạn hội thoại ngắn.", NL_ANH],
  // ===== TIẾNG ANH 4 =====
  ["ANH4.1.1", "tieng_anh", 4, "Nghe", "Nghe hiểu đoạn hội thoại ngắn về trường học, gia đình, sở thích, thời gian; xác định được thông tin chính.", NL_ANH],
  ["ANH4.2.1", "tieng_anh", 4, "Nói", "Hỏi đáp về nơi chốn, thời gian, giá cả, sở thích, khả năng (can - can't); mô tả đồ vật, hoạt động đơn giản.", NL_ANH],
  ["ANH4.3.1", "tieng_anh", 4, "Đọc", "Đọc hiểu đoạn văn ngắn, đoạn hội thoại; xác định thông tin cụ thể; đọc đúng ngữ điệu câu hỏi, câu kể.", NL_ANH],
  ["ANH4.4.1", "tieng_anh", 4, "Viết", "Viết câu hoàn chỉnh về chủ đề quen thuộc; viết đoạn văn ngắn theo hướng dẫn; viết thiệp mời, thiệp chúc đơn giản.", NL_ANH],
  // ===== TIẾNG ANH 5 =====
  ["ANH5.1.1", "tieng_anh", 5, "Nghe", "Nghe hiểu đoạn hội thoại, câu chuyện ngắn về chủ đề quen thuộc (sức khoẻ, nghề nghiệp, chuyến đi, vật nuôi); trả lời câu hỏi Wh-.", NL_ANH],
  ["ANH5.2.1", "tieng_anh", 5, "Nói", "Kể chuyện ngắn theo tranh; hỏi đáp về ý định (will), dự định (be going to), trải nghiệm quá khứ đơn giản; nêu ý kiến cơ bản.", NL_ANH],
  ["ANH5.3.1", "tieng_anh", 5, "Đọc", "Đọc hiểu văn bản ngắn, truyện tranh; suy luận nghĩa từ theo ngữ cảnh; xác định nhân vật, sự việc, thông điệp chính.", NL_ANH],
  ["ANH5.4.1", "tieng_anh", 5, "Viết", "Viết đoạn văn ngắn về bản thân, gia đình, trường học; viết thư hoặc email ngắn; dùng đúng dấu câu và chữ hoa - thường.", NL_ANH],
];

const rows = DATA.map(([code, subject_code, grade, strand, description, competencies]) => ({
  code,
  subject_code,
  grade,
  strand,
  lesson_ref: "",
  description,
  competencies,
  version: "2025-2026",
  status: "active",
  prerequisite_ids: [],
  school_id: null,
}));

// Upsert theo code + school_id is null (không đè YCCĐ trường đã chỉnh).
const { data: existing } = await supabase
  .from("tvc_curriculum_standards")
  .select("id, code")
  .is("school_id", null)
  .in("code", rows.map((r) => r.code));
const existingCodes = new Set((existing ?? []).map((r) => r.code));
const toInsert = rows.filter((r) => !existingCodes.has(r.code));

if (toInsert.length) {
  const { error } = await supabase
    .from("tvc_curriculum_standards")
    .insert(toInsert);
  if (error) {
    console.error("INSERT FAILED:", error.message);
    process.exit(1);
  }
}
console.log(`Seed xong: ${toInsert.length} YCCĐ mới, ${existingCodes.size} đã có. Tổng dataset: ${rows.length}.`);
