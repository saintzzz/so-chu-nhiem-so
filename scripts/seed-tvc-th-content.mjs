/**
 * CR-024: Seed lai YCCĐ tieu hoc bam van ban CTGDPT 2018 (TT 32/2018)
 * + ngan hang cau hoi mau khop tung YCCĐ cho giao vien demo.
 * - YCCĐ: xoa bo khung AI-pharaphrase cu (school_id IS NULL, cap TH),
 *   ghi lai theo van ban chuong trinh (dien giai tai cho nguoi doc gan).
 * - Cau hoi: seed cho owner = tai khoan gvcn@demo.scn (demo/training).
 *   Nguon ngu lieu do he thong tu viet - KHONG sao chep SGK (ban quyen).
 * Usage: node scripts/seed-tvc-th-content.mjs
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

const T = ["Tư duy và lập luận toán học"];
const GQVĐ = ["Giải quyết vấn đề toán học"];
const MH = ["Mô hình hoá toán học"];
const GT = ["Giao tiếp toán học"];
const TVNN = ["Năng lực ngôn ngữ"];
const TVVH = ["Năng lực văn học"];
const AN = ["Năng lực giao tiếp tiếng Anh"];

// [code, subject, grade, strand, description(van ban CT), competencies]
const STDS = [
  // ===== TOÁN 1 =====
  ["TOAN1.1.1", "toan", 1, "Số và phép tính", "Đếm, đọc, viết được các số trong phạm vi 10; nhận biết được số có hai chữ số; đếm, đọc, viết được các số trong phạm vi 100; so sánh và sắp xếp được thứ tự các số trong phạm vi 100.", [...T, ...GT]],
  ["TOAN1.1.2", "toan", 1, "Số và phép tính", "Thực hiện được phép cộng, phép trừ trong phạm vi 10; thực hiện được cộng, trừ không nhớ trong phạm vi 100; tính nhẩm được các phép tính cộng, trừ trong phạm vi 10.", T],
  ["TOAN1.1.3", "toan", 1, "Số và phép tính", "Nhận biết được ý nghĩa của phép cộng (gộp lại, thêm vào) và phép trừ (tách ra, bớt đi); vận dụng được phép cộng, phép trừ để giải quyết bài toán có lời văn đơn giản.", [...MH, ...GQVĐ]],
  ["TOAN1.2.1", "toan", 1, "Hình học và Đo lường", "Nhận biết được hình vuông, hình tròn, hình tam giác, hình chữ nhật; nhận biết được khối hộp chữ nhật, khối lập phương trong thực tiễn.", T],
  ["TOAN1.2.2", "toan", 1, "Hình học và Đo lường", "Đo được độ dài bằng gang tay, sải tay, bước chân và bằng đơn vị xăng-ti-mét; đọc được giờ đúng trên đồng hồ; xác định được các ngày trong tuần, ngày trong tháng.", GQVĐ],
  ["TOAN1.3.1", "toan", 1, "Hoạt động thực hành và trải nghiệm", "Vận dụng được kiến thức, kĩ năng về số, đo lường vào tình huống thực tế (đếm, đo độ dài, đọc giờ, xem lịch, định vị vị trí).", [...MH, ...GQVĐ]],
  // ===== TOÁN 2 =====
  ["TOAN2.1.1", "toan", 2, "Số và phép tính", "Đếm, đọc, viết, so sánh được các số trong phạm vi 1000; nhận biết được cấu tạo thập phân của số có ba chữ số; làm tròn được số đến hàng chục, hàng trăm.", [...T, ...GT]],
  ["TOAN2.1.2", "toan", 2, "Số và phép tính", "Thực hiện được phép cộng, phép trừ có nhớ trong phạm vi 100; phép cộng, phép trừ có nhớ không quá hai lượt trong phạm vi 1000; tính nhẩm trong phạm vi 100; tính được giá trị biểu thức số có đến hai phép tính.", T],
  ["TOAN2.1.3", "toan", 2, "Số và phép tính", "Nhận biết được phép nhân (phép cộng lặp lại các số hạng bằng nhau) và phép chia (chia đều); thuộc bảng nhân 2, 5 và bảng chia 2, 5; giải được bài toán có lời văn liên quan đến phép nhân, phép chia.", [...MH, ...GQVĐ]],
  ["TOAN2.2.1", "toan", 2, "Hình học và Đo lường", "Nhận biết được điểm ở giữa, ba điểm thẳng hàng; đường thẳng, đoạn thẳng, đường gấp khúc; khối trụ, khối cầu trong thực tiễn.", T],
  ["TOAN2.2.2", "toan", 2, "Hình học và Đo lường", "Đo và đổi được các đơn vị độ dài (xăng-ti-mét, đề-xi-mét, mét); đọc được giờ, phút trên đồng hồ; xem được lịch; nhận biết được tiền Việt Nam.", GQVĐ],
  ["TOAN2.3.1", "toan", 2, "Một số yếu tố Thống kê và Xác suất", "Thu thập, phân loại, sắp xếp được số liệu thống kê theo cách đơn giản nhất trong tình huống quen thuộc; đọc và mô tả được các số liệu ở dạng bảng.", MH],
  ["TOAN2.4.1", "toan", 2, "Hoạt động thực hành và trải nghiệm", "Thực hành cân, đo, đong, đếm; sử dụng tiền, đọc giờ và xem lịch trong tình huống thực tế của học sinh.", [...MH, ...GQVĐ]],
  // ===== TOÁN 3 =====
  ["TOAN3.1.1", "toan", 3, "Số và phép tính", "Đọc, viết, so sánh được các số trong phạm vi 100 000; nhận biết được cấu tạo thập phân của một số; nhận biết được chữ số La Mã và viết được các số tự nhiên trong phạm vi 20 bằng cách sử dụng chữ số La Mã.", [...T, ...GT]],
  ["TOAN3.1.2", "toan", 3, "Số và phép tính", "Làm tròn được số đến hàng chục, hàng trăm, hàng nghìn, hàng chục nghìn; ước lượng được kết quả của các phép tính trong trường hợp đơn giản.", T],
  ["TOAN3.1.3", "toan", 3, "Số và phép tính", "Thực hiện được phép cộng, phép trừ có nhớ trong phạm vi 100 000; phép nhân với số có một chữ số (có nhớ không quá hai lượt và không liên tiếp); phép chia cho số có một chữ số; nhận biết được phép chia hết và phép chia có dư; vận dụng được tính chất giao hoán, kết hợp của phép nhân và quan hệ giữa phép nhân với phép chia trong thực hành tính.", T],
  ["TOAN3.1.4", "toan", 3, "Số và phép tính", "Làm quen với biểu thức số; tính được giá trị của biểu thức số có đến hai dấu phép tính, có và không có dấu ngoặc; thực hiện được cộng, trừ, nhân, chia nhẩm trong những trường hợp đơn giản.", T],
  ["TOAN3.1.5", "toan", 3, "Số và phép tính", "Nhận biết được phân số qua hình ảnh trực quan (một phần hai, một phần ba, một phần tư...); so sánh được các phân số trong trường hợp đơn giản.", T],
  ["TOAN3.1.6", "toan", 3, "Số và phép tính", "Giải được các bài toán liên quan đến các phép tính đã học (có đến hai bước tính), kể cả các bài toán thực tiễn gắn với ý nghĩa của phép tính.", [...MH, ...GQVĐ]],
  ["TOAN3.2.1", "toan", 3, "Hình học và Đo lường", "Nhận biết được điểm ở giữa, trung điểm của đoạn thẳng; hình tròn (tâm, đường kính, bán kính); góc vuông, góc không vuông; tính được chu vi hình tam giác, hình tứ giác, hình chữ nhật, hình vuông; nhận biết được diện tích của một hình.", T],
  ["TOAN3.2.2", "toan", 3, "Hình học và Đo lường", "Đo và đổi được các đơn vị đo độ dài (mi-li-mét), khối lượng (gam), dung tích (mi-li-lít), nhiệt độ (độ C); sử dụng được tiền Việt Nam trong giao dịch đơn giản.", GQVĐ],
  ["TOAN3.3.1", "toan", 3, "Một số yếu tố Thống kê và Xác suất", "Thu thập, phân loại, sắp xếp được số liệu thống kê (theo tiêu chí cho trước); đọc và mô tả được dữ liệu ở dạng bảng; nhận biết được khả năng xảy ra của một sự kiện (chắc chắn, có thể, không thể).", MH],
  ["TOAN3.4.1", "toan", 3, "Hoạt động thực hành và trải nghiệm", "Vận dụng được kiến thức, kĩ năng đã học vào giải quyết tình huống thực tế (trò chơi toán học, đo đạc, mua bán đơn giản).", [...MH, ...GQVĐ]],
  // ===== TOÁN 4 =====
  ["TOAN4.1.1", "toan", 4, "Số và phép tính", "Đọc, viết được các số có nhiều chữ số (đến lớp triệu); nhận biết được cấu tạo thập phân của một số và giá trị theo vị trí của từng chữ số; nhận biết được số chẵn, số lẻ; làm quen với dãy số tự nhiên và đặc điểm của dãy số tự nhiên.", [...T, ...GT]],
  ["TOAN4.1.2", "toan", 4, "Số và phép tính", "Nhận biết được cách so sánh hai số trong phạm vi lớp triệu; sắp xếp được các số theo thứ tự (từ bé đến lớn hoặc ngược lại) trong một nhóm có không quá bốn số; làm tròn được số đến tròn chục, tròn trăm, tròn nghìn, tròn mười nghìn, tròn trăm nghìn.", T],
  ["TOAN4.1.3", "toan", 4, "Số và phép tính", "Thực hiện được các phép cộng, phép trừ các số tự nhiên có nhiều chữ số (có nhớ không quá ba lượt và không liên tiếp); vận dụng được tính chất giao hoán, kết hợp của phép cộng và quan hệ giữa phép cộng và phép trừ trong thực hành tính.", T],
  ["TOAN4.1.4", "toan", 4, "Số và phép tính", "Tính được số trung bình cộng của nhiều số; thực hiện được phép nhân, phép chia với số có không quá hai chữ số; nhân với 10, 100, 1000 và chia cho 10, 100, 1000; vận dụng tính chất của phép nhân trong thực hành tính.", T],
  ["TOAN4.1.5", "toan", 4, "Số và phép tính", "Nhận biết, đọc, viết được phân số; so sánh được các phân số; rút gọn và quy đồng được mẫu số các phân số; thực hiện được các phép tính cộng, trừ, nhân, chia phân số trong trường hợp đơn giản.", T],
  ["TOAN4.1.6", "toan", 4, "Số và phép tính", "Nhận biết được số thập phân; đọc, viết, so sánh được số thập phân; thực hiện được phép cộng, trừ số thập phân trong trường hợp đơn giản.", T],
  ["TOAN4.1.7", "toan", 4, "Số và phép tính", "Giải được các bài toán có đến ba bước tính liên quan đến các phép tính đã học và quan hệ phụ thuộc đơn giản (tìm số trung bình cộng, tìm hai số khi biết tổng và hiệu).", [...MH, ...GQVĐ]],
  ["TOAN4.2.1", "toan", 4, "Hình học và Đo lường", "Nhận biết được góc nhọn, góc tù, góc bẹt; hai đường thẳng song song, vuông góc; hình bình hành, hình thoi; tính được chu vi và diện tích hình chữ nhật, hình vuông.", T],
  ["TOAN4.2.2", "toan", 4, "Hình học và Đo lường", "Đo và đổi được các đơn vị đo khối lượng (yến, tạ, tấn), diện tích (đề-xi-mét vuông, mét vuông, mi-li-mét vuông), thời gian (giây, phút, giờ, thế kỉ); ước lượng được kết quả đo lường.", GQVĐ],
  ["TOAN4.3.1", "toan", 4, "Một số yếu tố Thống kê và Xác suất", "Lập được bảng thống kê số liệu ban đầu; đọc và mô tả được dữ liệu ở dạng biểu đồ cột; tính được số trung bình cộng; mô tả được khả năng xảy ra của một sự kiện.", MH],
  // ===== TOÁN 5 =====
  ["TOAN5.1.1", "toan", 5, "Số và phép tính", "Ôn tập, củng cố các phép tính với số tự nhiên; giải được bài toán có đến bốn bước tính liên quan đến các phép tính với số tự nhiên và quan hệ phụ thuộc đơn giản.", [...MH, ...GQVĐ]],
  ["TOAN5.1.2", "toan", 5, "Số và phép tính", "Ôn tập, củng cố các phép tính với phân số; nhận biết được hỗn số và phân số thập phân; chuyển đổi được giữa hỗn số và phân số.", T],
  ["TOAN5.1.3", "toan", 5, "Số và phép tính", "Đọc, viết, so sánh, làm tròn được số thập phân; thực hiện được các phép cộng, trừ, nhân, chia số thập phân; chuyển đổi được giữa phân số và số thập phân.", T],
  ["TOAN5.1.4", "toan", 5, "Số và phép tính", "Nhận biết được tỉ số và tỉ số phần trăm của hai đại lượng cùng loại; giải được các bài toán liên quan đến tỉ số phần trăm (tìm tỉ số phần trăm, tìm giá trị phần trăm của một số, tìm một số khi biết giá trị phần trăm).", [...MH, ...GQVĐ]],
  ["TOAN5.1.5", "toan", 5, "Số và phép tính", "Giải được bài toán về quan hệ tỉ lệ thuận, tỉ lệ nghịch; tìm được hai số khi biết tổng - hiệu và tỉ số của hai số đó.", [...MH, ...GQVĐ]],
  ["TOAN5.2.1", "toan", 5, "Hình học và Đo lường", "Tính được diện tích hình tam giác, hình thang, hình tròn; tính được diện tích xung quanh, diện tích toàn phần và thể tích của hình hộp chữ nhật, hình lập phương.", [...T, ...MH]],
  ["TOAN5.2.2", "toan", 5, "Hình học và Đo lường", "Đổi được các đơn vị đo diện tích, thể tích; nhận biết được vận tốc; giải được bài toán chuyển động đều đơn giản (quãng đường, vận tốc, thời gian).", [...MH, ...GQVĐ]],
  ["TOAN5.3.1", "toan", 5, "Một số yếu tố Thống kê và Xác suất", "Đọc và mô tả được biểu đồ hình quạt tròn; nhận biết được khả năng xảy ra của một sự kiện qua trò chơi, thực nghiệm đơn giản.", MH],
  ["TOAN5.4.1", "toan", 5, "Hoạt động thực hành và trải nghiệm", "Vận dụng được kiến thức, kĩ năng đã học vào giải quyết vấn đề thực tiễn (tính tiền, tính diện tích - thể tích vật thật, đọc bản đồ - tỉ lệ bản đồ).", [...MH, ...GQVĐ]],

  // ===== TIẾNG VIỆT 1 =====
  ["TVIET1.1.1", "tieng_viet", 1, "Đọc", "Đọc đúng, rõ ràng các văn bản (truyện, văn xuôi, thơ, ca dao, đồng dao, văn bản thông tin) với tốc độ đọc phù hợp; hiểu nghĩa của các từ ngữ, các câu trong văn bản; nhận biết được nhân vật, hành động, việc làm, cảm xúc của nhân vật.", TVNN],
  ["TVIET1.2.1", "tieng_viet", 1, "Viết", "Viết đúng chính tả các âm, vần, từ ngữ, câu; viết đúng bài tập chép, đoạn nghe - viết ngắn; viết được câu tự giới thiệu, tên và địa chỉ của em.", TVNN],
  ["TVIET1.3.1", "tieng_viet", 1, "Nói và nghe", "Trả lời được câu hỏi, thực hiện được các yêu cầu giao tiếp đơn giản (chào hỏi, tạm biệt, xin phép, cảm ơn, xin lỗi) phù hợp với tình huống và phép lịch sự; kể lại được một câu chuyện ngắn.", TVNN],
  ["TVIET1.4.1", "tieng_viet", 1, "Kiến thức tiếng Việt", "Nhận biết được âm, vần và thanh điệu; vốn từ ngữ chỉ sự vật, hoạt động, đặc điểm, sắc thái quen thuộc; nhận biết được dấu chấm, dấu chấm than, dấu phẩy.", TVNN],
  // ===== TIẾNG VIỆT 2 =====
  ["TVIET2.1.1", "tieng_viet", 2, "Đọc", "Đọc đúng và trôi chảy các văn bản (truyện, văn xuôi, thơ, ca dao, đồng dao, văn bản thông tin), tốc độ khoảng 50 - 60 tiếng/phút; nêu được nội dung chính, chi tiết được yêu thích trong văn bản; bước đầu liên hệ được với bản thân.", TVNN],
  ["TVIET2.2.1", "tieng_viet", 2, "Viết", "Viết đúng chính tả đoạn nghe - viết; viết được đoạn văn 3 - 5 câu kể lại việc đã làm, tả đồ vật hoặc tả cảnh; viết được đoạn giới thiệu về nơi em sống.", TVNN],
  ["TVIET2.3.1", "tieng_viet", 2, "Nói và nghe", "Kể lại được câu chuyện đã đọc, đã nghe hoặc kể theo tranh; nói được về nhân vật, sự việc; trình bày được ý kiến trước nhóm; nghe và ghi nhận được ý kiến của bạn.", TVNN],
  ["TVIET2.4.1", "tieng_viet", 2, "Kiến thức tiếng Việt", "Mở rộng vốn từ theo chủ điểm (từ chỉ sự vật, hoạt động, đặc điểm); nhận biết được câu nêu hoạt động; sử dụng được dấu chấm, dấu chấm hỏi, dấu chấm than.", TVNN],
  // ===== TIẾNG VIỆT 3 =====
  ["TVIET3.1.1", "tieng_viet", 3, "Đọc", "Đọc đúng và bước đầu biết đọc diễn cảm các đoạn văn miêu tả, câu chuyện, bài thơ với tốc độ khoảng 70 - 80 tiếng/phút; nhận biết được chi tiết và nội dung chính; hiểu được nội dung hàm ẩn của văn bản với những suy luận đơn giản; tìm được ý chính của từng đoạn.", TVNN],
  ["TVIET3.1.2", "tieng_viet", 3, "Đọc", "Nhận biết được điệu bộ, hành động của nhân vật qua từ ngữ trong văn bản; nhận biết được thời gian, địa điểm và trình tự các sự việc trong câu chuyện; nhận biết được vần và biện pháp tu từ so sánh trong thơ.", TVVH],
  ["TVIET3.2.1", "tieng_viet", 3, "Viết", "Viết đúng chính tả đoạn thơ, đoạn văn theo hình thức nghe - viết hoặc nhớ - viết (khoảng 65 - 70 chữ/15 phút); viết được đoạn văn kể lại câu chuyện đã đọc, miêu tả đồ vật, chia sẻ cảm xúc - tình cảm, nêu lí do thích một nhân vật; viết được thông báo, bản tin ngắn theo mẫu.", TVNN],
  ["TVIET3.3.1", "tieng_viet", 3, "Nói và nghe", "Nói rõ ràng, tập trung vào mục đích và đề tài; kể được câu chuyện đơn giản đã đọc, nghe hoặc xem; đọc được bài giới thiệu về bản thân; nghe hiểu được nội dung chính của bài nói, câu chuyện.", TVNN],
  ["TVIET3.4.1", "tieng_viet", 3, "Kiến thức tiếng Việt", "Mở rộng vốn từ theo chủ điểm; nhận biết được từ có nghĩa giống nhau và trái ngược nhau; từ chỉ sự vật, hoạt động, tính chất; nhận biết câu kể, câu hỏi, câu khiến, câu cảm; công dụng của dấu hai chấm, dấu ngoặc kép.", TVNN],
  // ===== TIẾNG VIỆT 4 =====
  ["TVIET4.1.1", "tieng_viet", 4, "Đọc", "Đọc đúng và diễn cảm các văn bản truyện, kịch bản, bài thơ, bài miêu tả với tốc độ khoảng 80 - 90 tiếng/phút; nhận biết được chi tiết tiêu biểu, nội dung chính và chủ đề của văn bản; chỉ ra được mối liên hệ giữa các chi tiết; biết tóm tắt văn bản.", TVNN],
  ["TVIET4.1.2", "tieng_viet", 4, "Đọc", "Nhận biết được thời gian, địa điểm và tác dụng của chúng trong câu chuyện; hiểu được từ ngữ, hình ảnh, biện pháp so sánh, nhân hoá trong văn bản; nhận xét được nhân vật, sự việc và thái độ, tình cảm của người viết.", TVVH],
  ["TVIET4.2.1", "tieng_viet", 4, "Viết", "Viết được bài văn kể lại một sự việc bản thân đã chứng kiến, bài văn miêu tả (đồ vật, cây cối, cảnh vật); viết được đoạn văn, bài viết có đủ ba phần mở bài - thân bài - kết bài; viết được thư, nhật ký, bài giới thiệu ngắn.", TVNN],
  ["TVIET4.3.1", "tieng_viet", 4, "Nói và nghe", "Thuyết trình, giới thiệu được về đồ vật, hoạt động; kể lại được câu chuyện với giọng kể phù hợp; trao đổi, thảo luận được về nội dung văn bản đã đọc; nghe hiểu và tóm tắt được ý chính của bài nói.", TVNN],
  ["TVIET4.4.1", "tieng_viet", 4, "Kiến thức tiếng Việt", "Nhận biết được danh từ, động từ, tính từ; câu hỏi, câu kể, câu cảm, câu khiến; mở rộng vốn từ theo chủ điểm; công dụng của dấu gạch ngang, dấu ngoặc kép, dấu ngoặc đơn.", TVNN],
  // ===== TIẾNG VIỆT 5 =====
  ["TVIET5.1.1", "tieng_viet", 5, "Đọc", "Đọc đúng và diễn cảm các văn bản truyện, kịch bản, bài thơ, bài miêu tả với tốc độ khoảng 90 - 100 tiếng/phút; nhận biết được chi tiết tiêu biểu, nội dung chính và chủ đề; hiểu được nội dung hàm ẩn dễ nhận biết; biết tóm tắt văn bản; sử dụng được từ điển để tra cứu.", TVNN],
  ["TVIET5.1.2", "tieng_viet", 5, "Đọc", "Nhận biết được văn bản viết theo tưởng tượng và văn bản viết về người thật, việc thật; nhận biết được vai trò của hình ảnh, kí hiệu, số liệu trong văn bản thông tin; nêu được những thay đổi trong hiểu biết, tình cảm, cách ứng xử sau khi đọc.", TVVH],
  ["TVIET5.2.1", "tieng_viet", 5, "Viết", "Viết được bài văn kể lại câu chuyện đã đọc, đã nghe với chi tiết sáng tạo; bài văn tả người, tả phong cảnh; đoạn văn thể hiện tình cảm, cảm xúc, nêu ý kiến về một hiện tượng xã hội; bài văn giải thích về một hiện tượng tự nhiên, bài giới thiệu sách hoặc phim.", TVNN],
  ["TVIET5.3.1", "tieng_viet", 5, "Nói và nghe", "Thuyết trình, tranh biện đơn giản về chủ đề quen thuộc; kể chuyện sáng tạo; nghe hiểu và trình bày lại được nội dung chính của bài nói; thực hiện được cuộc phỏng vấn đơn giản.", TVNN],
  ["TVIET5.4.1", "tieng_viet", 5, "Kiến thức tiếng Việt", "Nhận biết được từ đồng nghĩa, trái nghĩa, đồng âm, nhiều nghĩa; đại từ, kết từ; câu đơn, câu ghép; thành ngữ, tục ngữ theo chủ đề; liên kết giữa các câu trong đoạn văn.", TVNN],

  // ===== TIẾNG ANH 3 ===== (CT Ngoai ngu 1 - khung 6 bac, uu tien nghe-noi)
  ["ANH3.1.1", "tieng_anh", 3, "Nghe", "Nghe và nhận biết được lời chào, tên, đồ vật, màu sắc, số đếm đến 20; nghe hiểu được các mẫu câu đơn giản trong giao tiếp quen thuộc (giới thiệu, hỏi đáp tên - tuổi).", AN],
  ["ANH3.2.1", "tieng_anh", 3, "Nói", "Nói được lời chào, tạm biệt, giới thiệu tên và tuổi; hỏi đáp được về đồ vật, màu sắc, con vật theo mẫu câu đã học (What's this? It's a...).", AN],
  ["ANH3.3.1", "tieng_anh", 3, "Đọc", "Đọc và hiểu được từ, cụm từ và câu đơn về các chủ đề quen thuộc (gia đình, đồ dùng học tập, con vật, lớp học, màu sắc).", AN],
  ["ANH3.4.1", "tieng_anh", 3, "Viết", "Viết đúng chữ cái, từ và câu đơn theo mẫu; điền được từ còn thiếu để hoàn thành câu hoặc đoạn hội thoại ngắn.", AN],
  ["ANH3.5.1", "tieng_anh", 3, "Kiến thức ngôn ngữ", "Nhận biết và sử dụng được từ vựng theo chủ đề; cấu trúc đơn giản (This is..., I like..., to be ở ngôi I/you); phát âm được âm đầu và âm cuối của từ quen thuộc.", AN],
  // ===== TIẾNG ANH 4 =====
  ["ANH4.1.1", "tieng_anh", 4, "Nghe", "Nghe hiểu được đoạn hội thoại ngắn về trường học, gia đình, sở thích, thời gian, ngày tháng; xác định được thông tin chính và thông tin cụ thể.", AN],
  ["ANH4.2.1", "tieng_anh", 4, "Nói", "Hỏi đáp được về nơi chốn, môn học, thời gian, giá cả, sở thích và khả năng (can/can't); mô tả được đồ vật, hoạt động đơn giản.", AN],
  ["ANH4.3.1", "tieng_anh", 4, "Đọc", "Đọc hiểu được đoạn văn ngắn, đoạn hội thoại; xác định được thông tin cụ thể; đọc đúng ngữ điệu câu kể, câu hỏi.", AN],
  ["ANH4.4.1", "tieng_anh", 4, "Viết", "Viết được câu hoàn chỉnh về chủ đề quen thuộc; viết được đoạn văn ngắn theo hướng dẫn; viết được thiệp mời, thiệp chúc đơn giản.", AN],
  ["ANH4.5.1", "tieng_anh", 4, "Kiến thức ngôn ngữ", "Sử dụng được từ vựng theo chủ điểm (trường học, nơi chốn, đồ ăn - thức uống, ngày - tháng); cấu trúc What time...? / Where...? / How much...?; danh từ số nhiều, giới từ chỉ nơi chốn.", AN],
  // ===== TIẾNG ANH 5 =====
  ["ANH5.1.1", "tieng_anh", 5, "Nghe", "Nghe hiểu được đoạn hội thoại, câu chuyện ngắn về chủ đề quen thuộc (sức khoẻ, nghề nghiệp, chuyến đi, vật nuôi, truyện cổ tích); trả lời được câu hỏi Wh-.", AN],
  ["ANH5.2.1", "tieng_anh", 5, "Nói", "Kể được câu chuyện ngắn theo tranh; hỏi đáp được về ý định (will), dự định (be going to), trải nghiệm quá khứ đơn giản; nêu được ý kiến cơ bản.", AN],
  ["ANH5.3.1", "tieng_anh", 5, "Đọc", "Đọc hiểu được văn bản ngắn, truyện tranh; suy luận được nghĩa của từ theo ngữ cảnh; xác định được nhân vật, sự việc và thông điệp chính.", AN],
  ["ANH5.4.1", "tieng_anh", 5, "Viết", "Viết được đoạn văn ngắn về bản thân, gia đình, trường học; viết được thư hoặc thư điện tử ngắn; dùng đúng dấu câu và chữ hoa - chữ thường.", AN],
  ["ANH5.5.1", "tieng_anh", 5, "Kiến thức ngôn ngữ", "Sử dụng được từ vựng theo chủ điểm (nghề nghiệp, phương tiện, địa điểm, sức khoẻ); thì quá khứ đơn, tương lai gần; câu hỏi Wh- và câu trả lời tương ứng.", AN],
];

// [std_code, qtype, level, points, stem, context, correct, solution]
const QUESTIONS = [
  // ===== TOÁN 3 =====
  ["TOAN3.1.1", "multiple_choice", "biet", 0.5, "Số 45 302 đọc là:\nA. Bốn lăm nghìn ba trăm linh hai\nB. Bốn mươi lăm nghìn ba trăm linh hai\nC. Bốn mươi lăm nghìn hai trăm ba\nD. Bốn năm ba không hai", null, "B", "Đọc theo lớp: 45 nghìn 302 = bốn mươi lăm nghìn ba trăm linh hai."],
  ["TOAN3.1.2", "multiple_choice", "hieu", 0.5, "Làm tròn số 3 768 đến hàng trăm được:\nA. 3 700\nB. 3 800\nC. 3 770\nD. 4 000", null, "B", "Chữ số hàng chục là 6 >= 5 nên làm tròn lên: 3 800."],
  ["TOAN3.1.3", "multiple_choice", "biet", 0.5, "Kết quả của phép tính 235 x 3 là:\nA. 605\nB. 705\nC. 695\nD. 715", null, "B", "235 x 3 = 705 (nhân 3 đơn vị, nhân 3 chục nhớ 1, nhân 2 trăm cộng 1)."],
  ["TOAN3.1.3", "short_answer", "hieu", 0.5, "Đặt tính rồi tính: 848 : 4 = ......", null, "212", "848 : 4 = 212 (8:4=2; 4:4=1; 8:4=2)."],
  ["TOAN3.1.4", "multiple_choice", "van_dung", 0.5, "Giá trị của biểu thức 120 + 30 x 2 là:\nA. 300\nB. 180\nC. 150\nD. 90", null, "B", "Nhân chia trước: 30 x 2 = 60; 120 + 60 = 180."],
  ["TOAN3.1.5", "true_false_4", "hieu", 1, "Cho hai phân số 1/4 và 1/2. Đúng ghi Đ, sai ghi S:\na) 1/4 > 1/2\nb) 1/4 < 1/2\nc) 1/4 của 8 bằng 2\nd) 1/2 của 8 bằng 2", null, "a-Sai, b-Đúng, c-Đúng, d-Sai", "1/4 < 1/2 (cùng tử 1, mẫu lớn hơn thì bé hơn); 1/4 của 8 = 2; 1/2 của 8 = 4."],
  ["TOAN3.1.6", "essay", "van_dung", 2, "Một cửa hàng buổi sáng bán được 245 kg gạo, buổi chiều bán được ít hơn buổi sáng 78 kg. Hỏi cả hai buổi cửa hàng bán được bao nhiêu ki-lô-gam gạo?", null, null, "Buổi chiều bán: 245 - 78 = 167 (kg). Cả hai buổi: 245 + 167 = 412 (kg). Đáp số: 412 kg."],
  ["TOAN3.2.1", "multiple_choice", "biet", 0.5, "Hình vuông có cạnh 5 cm thì chu vi là:\nA. 10 cm\nB. 20 cm\nC. 25 cm\nD. 15 cm", null, "B", "Chu vi hình vuông = cạnh x 4 = 5 x 4 = 20 cm."],
  ["TOAN3.2.2", "short_answer", "van_dung", 0.5, "Điền số thích hợp: 2 000 ml = ...... lít", null, "2", "2 000 ml = 2 lít."],
  ["TOAN3.3.1", "multiple_choice", "hieu", 0.5, "Một hộp có 3 bi đỏ và 7 bi xanh. Lấy ngẫu nhiên một viên bi, sự kiện nào có thể xảy ra?\nA. Chắc chắn lấy được bi đỏ\nB. Không thể lấy được bi xanh\nC. Có thể lấy được bi đỏ\nD. Chắc chắn lấy được bi vàng", null, "C", "Hộp có cả bi đỏ và bi xanh nên việc lấy được bi đỏ là sự kiện có thể xảy ra; không có bi vàng nên không thể lấy được."],
  // Bo sung phu day cac o ma tran Toan 3
  ["TOAN3.1.1", "true_false_4", "biet", 1, "Đúng ghi Đ, sai ghi S:\na) Số 56 407 đọc là năm mươi sáu nghìn bốn trăm linh bảy.\nb) Chữ số La Mã IX viết số 9.\nc) Số 10 000 có 4 chữ số.\nd) Trong số 8 352, chữ số 3 ở hàng trăm.", null, "a-Đúng, b-Đúng, c-Sai, d-Đúng", "10 000 có 5 chữ số; các ý còn lại đúng."],
  ["TOAN3.1.1", "short_answer", "hieu", 0.5, "Viết số gồm 4 chục nghìn, 2 nghìn, 5 trăm và 8 đơn vị: ......", null, "42508", "4 chục nghìn + 2 nghìn + 5 trăm + 8 = 42 508."],
  ["TOAN3.1.1", "essay", "van_dung", 2, "Sắp xếp các số 45 209; 45 092; 45 920; 45 290 theo thứ tự từ bé đến lớn và giải thích cách em làm.", null, null, "So sánh hàng nghìn (bằng nhau) rồi hàng trăm, hàng chục: 45 092 < 45 209 < 45 290 < 45 920."],
  ["TOAN3.1.3", "short_answer", "biet", 0.5, "Tính nhẩm: 6 x 7 = ......", null, "42", "6 x 7 = 42."],
  ["TOAN3.1.3", "true_false_4", "hieu", 1, "Đúng ghi Đ, sai ghi S:\na) 25 : 5 là phép chia hết.\nb) 17 : 3 dư 1.\nc) Trong phép chia có dư, số dư luôn bé hơn số chia.\nd) 100 : 4 = 25.", null, "a-Đúng, b-Sai, c-Đúng, d-Đúng", "17 : 3 = 5 dư 2 (không phải dư 1); các ý còn lại đúng."],
  ["TOAN3.1.3", "essay", "van_dung", 2, "Một lớp học có 36 học sinh, xếp đều thành 4 hàng. Hỏi mỗi hàng có bao nhiêu học sinh? Nếu thêm 8 học sinh nữa thì có thể xếp mỗi hàng 11 em không?", null, null, "36 : 4 = 9 (em/hàng). Thêm 8 em: 36 + 8 = 44; 44 : 4 = 11. Vậy xếp được mỗi hàng 11 em."],
  ["TOAN3.1.6", "multiple_choice", "biet", 0.5, "Một cửa hàng có 1 250 kg gạo, đã bán 480 kg. Số gạo còn lại là:\nA. 770 kg\nB. 780 kg\nC. 870 kg\nD. 760 kg", null, "A", "1 250 - 480 = 770 kg."],
  ["TOAN3.1.6", "short_answer", "hieu", 0.5, "Một hộp sữa nặng 200 g. Hỏi 5 hộp sữa nặng bao nhiêu gam? ...... g", null, "1000", "200 x 5 = 1 000 g."],
  ["TOAN3.1.6", "essay", "van_dung_cao", 2.5, "Mẹ mua 3 gói kẹo, mỗi gói 120 g và 1 gói bánh 350 g. Giá mỗi gói kẹo là 25 000 đồng. a) Mẹ mua được bao nhiêu gam kẹo? b) Mẹ đưa cô bán hàng 100 000 đồng thì được trả lại bao nhiêu tiền?", null, null, "a) 120 x 3 = 360 g. b) Tiền kẹo: 25 000 x 3 = 75 000đ; giả sử giá bánh không đổi thì chỉ tính kẹo: trả lại 100 000 - 75 000 = 25 000đ (nếu tính cả bánh cần thêm giá bánh). Chấm theo lập luận hợp lý."],
  ["TOAN3.1.4", "essay", "hieu", 2, "Viết biểu thức rồi tính: Lấy tổng của 350 và 125 trừ đi 200.", null, null, "(350 + 125) - 200 = 475 - 200 = 275."],
  ["TOAN3.2.1", "true_false_4", "hieu", 1, "Đúng ghi Đ, sai ghi S:\na) Hình chữ nhật có 4 góc vuông.\nb) Trung điểm của đoạn thẳng chia đoạn thẳng thành hai phần bằng nhau.\nc) Đường kính bằng một nửa bán kính.\nd) Hình tam giác có 3 cạnh, 3 đỉnh.", null, "a-Đúng, b-Đúng, c-Sai, d-Đúng", "Đường kính gấp đôi bán kính (d = 2r) chứ không phải một nửa."],
  ["TOAN3.2.1", "essay", "van_dung", 2, "Một hình chữ nhật có chiều dài 12 cm, chiều rộng 8 cm. Tính chu vi hình chữ nhật đó.", null, null, "Chu vi = (12 + 8) x 2 = 40 (cm). Đáp số: 40 cm."],
  ["TOAN3.3.1", "essay", "hieu", 2, "Số cây mỗi tổ trồng được của lớp 3A: Tổ 1: 12 cây, Tổ 2: 15 cây, Tổ 3: 9 cây. Viết bảng số liệu và cho biết tổ nào trồng được nhiều cây nhất.", null, null, "Bảng: Tổ 1 - 12; Tổ 2 - 15; Tổ 3 - 9. Tổ 2 trồng nhiều nhất (15 cây)."],
  // Du phong cho ma tran TOAN3 (de chinh thuc + de du phong)
  ["TOAN3.1.1", "multiple_choice", "hieu", 0.5, "Số lớn nhất có 5 chữ số khác nhau, bắt đầu bằng 7 là:\nA. 79 876\nB. 79 999\nC. 78 976\nD. 98 765", null, "A", "Số bắt đầu bằng 7, các chữ số giảm dần khác nhau: 79 876."],
  ["TOAN3.1.1", "essay", "hieu", 2, "Cho các số 12 450, 21 405, 14 520. a) Sắp xếp theo thứ tự từ lớn đến bé. b) Làm tròn số lớn nhất đến hàng nghìn.", null, null, "a) 21 405 > 14 520 > 12 450. b) 21 405 làm tròn đến hàng nghìn = 21 000."],
  ["TOAN3.1.2", "essay", "van_dung", 2, "Làm tròn số 17 842 đến hàng chục, hàng trăm và hàng nghìn. Viết các số sau khi làm tròn.", null, null, "Hàng chục: 17 840; hàng trăm: 17 800; hàng nghìn: 18 000."],
  ["TOAN3.1.3", "essay", "biet", 1.5, "Đặt tính rồi tính: a) 12 458 + 9 372 b) 76 205 - 38 416", null, null, "a) 12 458 + 9 372 = 21 830. b) 76 205 - 38 416 = 37 789."],
  ["TOAN3.1.4", "short_answer", "biet", 0.5, "Tính giá trị biểu thức: 25 + 75 : 5 = ......", null, "40", "75 : 5 = 15; 25 + 15 = 40."],
  ["TOAN3.1.5", "short_answer", "biet", 0.5, "Viết phân số chỉ phần đã tô màu nếu chia một hình tròn thành 4 phần bằng nhau và tô 1 phần: ......", null, "1/4", "Tô 1 trong 4 phần bằng nhau -> 1/4."],
  ["TOAN3.2.2", "essay", "hieu", 2, "Một chai nước chứa 500 ml. Hỏi 4 chai như thế chứa được bao nhiêu mi-li-lít? Đổi ra lít.", null, null, "500 x 4 = 2 000 ml = 2 lít."],
  ["TOAN3.2.2", "multiple_choice", "hieu", 0.5, "Nam đi siêu thị mua một gói bánh 15 000 đồng và một hộp sữa 32 000 đồng. Nam đưa tờ 50 000 đồng thì được trả lại:\nA. 3 000 đồng\nB. 13 000 đồng\nC. 8 000 đồng\nD. 5 000 đồng", null, "A", "15 000 + 32 000 = 47 000; 50 000 - 47 000 = 3 000 đồng."],
  ["TOAN3.1.6", "essay", "van_dung", 2, "Trường tiểu học có 4 lớp khối 3, mỗi lớp 35 học sinh. Mỗi em đóng góp 2 quyển vở để ủng hộ các bạn vùng lũ. Hỏi cả khối đóng góp được bao nhiêu quyển vở?", null, null, "Số học sinh khối 3: 35 x 4 = 140 (em). Số vở đóng góp: 140 x 2 = 280 (quyển). Đáp số: 280 quyển vở."],
  ["TOAN3.1.3", "essay", "van_dung_cao", 2.5, "Tìm số bị chia, biết số chia là 6, thương là 128 và số dư là 5.", null, null, "Số bị chia = thương x số chia + số dư = 128 x 6 + 5 = 768 + 5 = 773."],
  ["TOAN3.1.4", "multiple_choice", "hieu", 0.5, "Giá trị của biểu thức (85 - 40) : 5 là:\nA. 9\nB. 45\nC. 85\nD. 17", null, "A", "Trong ngoặc trước: 85 - 40 = 45; 45 : 5 = 9."],
  ["TOAN3.2.1", "short_answer", "biet", 0.5, "Hình tam giác có 3 cạnh lần lượt là 4 cm, 5 cm, 6 cm. Chu vi hình tam giác là ...... cm", null, "15", "Chu vi = 4 + 5 + 6 = 15 cm."],
  // ===== TOÁN 4 =====
  ["TOAN4.1.1", "multiple_choice", "biet", 0.5, "Giá trị của chữ số 4 trong số 482 518 100 là:\nA. 4 000\nB. 40 000\nC. 400 000\nD. 400 000 000", null, "D", "Chữ số 4 đứng ở hàng trăm triệu nên giá trị là 400 000 000."],
  ["TOAN4.1.2", "multiple_choice", "hieu", 0.5, "Làm tròn số 99 592 848 đến hàng chục nghìn được:\nA. 99 500 000\nB. 99 590 000\nC. 99 600 000\nD. 100 000 000", null, "B", "Chữ số hàng nghìn là 2 < 5 nên giữ nguyên hàng chục nghìn: 99 590 000."],
  ["TOAN4.1.3", "short_answer", "hieu", 0.5, "Tính: 38 459 + 26 715 = ......", null, "65174", "38 459 + 26 715 = 65 174."],
  ["TOAN4.1.4", "multiple_choice", "van_dung", 0.5, "Số trung bình cộng của 24, 36 và 45 là:\nA. 35\nB. 105\nC. 34\nD. 36", null, "A", "(24 + 36 + 45) : 3 = 105 : 3 = 35."],
  ["TOAN4.1.5", "true_false_4", "hieu", 1, "Cho phân số 3/4. Đúng ghi Đ, sai ghi S:\na) 3/4 = 6/8\nb) 3/4 > 1\nc) 3/4 < 2/4\nd) Rút gọn 6/8 được 3/4", null, "a-Đúng, b-Sai, c-Sai, d-Đúng", "6/8 rút gọn chia 2 = 3/4; 3/4 < 1; 3/4 > 2/4."],
  ["TOAN4.1.6", "multiple_choice", "biet", 0.5, "Số 5,7 đọc là:\nA. Năm phẩy bảy\nB. Năm chấm bảy\nC. Năm mươi bảy\nD. Năm bảy", null, "A", "5,7 đọc là năm phẩy bảy."],
  ["TOAN4.1.7", "essay", "van_dung", 2.5, "Một mảnh vườn hình chữ nhật có chu vi 50 m, chiều dài hơn chiều rộng 5 m. Tính diện tích mảnh vườn đó.", null, null, "Nửa chu vi: 50 : 2 = 25 (m). Chiều dài: (25 + 5) : 2 = 15 (m). Chiều rộng: 25 - 15 = 10 (m). Diện tích: 15 x 10 = 150 (m2). Đáp số: 150 m2."],
  ["TOAN4.2.1", "multiple_choice", "biet", 0.5, "Hình thoi có đặc điểm:\nA. Có 4 góc vuông\nB. Có hai cặp cạnh đối diện song song và 4 cạnh bằng nhau\nC. Có 4 cạnh bằng nhau và 4 góc vuông\nD. Chỉ có một cặp cạnh song song", null, "B", "Hình thoi có hai cặp cạnh đối diện song song và bốn cạnh bằng nhau."],
  ["TOAN4.2.2", "short_answer", "hieu", 0.5, "Điền số thích hợp: 3 tấn 5 tạ = ...... kg", null, "3500", "3 tấn = 3 000 kg; 5 tạ = 500 kg; tổng 3 500 kg."],
  ["TOAN4.3.1", "multiple_choice", "hieu", 0.5, "Số cây 4 tổ trồng được lần lượt là: 15, 20, 17, 24 cây. Trung bình mỗi tổ trồng được:\nA. 17 cây\nB. 18 cây\nC. 19 cây\nD. 20 cây", null, "C", "(15 + 20 + 17 + 24) : 4 = 76 : 4 = 19 cây."],
  // ===== TOÁN 5 =====
  ["TOAN5.1.3", "multiple_choice", "biet", 0.5, "Chữ số 3 trong số 45,372 có giá trị là:\nA. 3\nB. 3/10\nC. 3/100\nD. 3/1000", null, "C", "Chữ số 3 đứng ở hàng phần trăm nên giá trị là 3/100."],
  ["TOAN5.1.3", "short_answer", "hieu", 0.5, "Tính: 67,8 x 1,5 = ......", null, "101,7", "67,8 x 1,5 = 101,7."],
  ["TOAN5.1.4", "multiple_choice", "hieu", 0.5, "Tỉ số phần trăm của 3 và 5 là:\nA. 30%\nB. 50%\nC. 60%\nD. 80%", null, "C", "3 : 5 = 0,6 = 60%."],
  ["TOAN5.1.4", "essay", "van_dung", 2.5, "Một khu đất hình chữ nhật có chiều dài 120 m, chiều rộng bằng 2/3 chiều dài. Người ta dành 15% diện tích đất để làm nhà ở. Tính diện tích đất làm nhà ở.", null, null, "Chiều rộng: 120 x 2/3 = 80 (m). Diện tích: 120 x 80 = 9 600 (m2). Diện tích làm nhà: 9 600 x 15% = 1 440 (m2). Đáp số: 1 440 m2."],
  ["TOAN5.1.5", "multiple_choice", "van_dung_cao", 0.5, "Tổng hai số là 45, số bé bằng 2/3 số lớn. Số lớn là:\nA. 18\nB. 27\nC. 30\nD. 15", null, "B", "Tổng số phần: 2 + 3 = 5. Số lớn: 45 : 5 x 3 = 27."],
  ["TOAN5.2.1", "multiple_choice", "hieu", 0.5, "Hình tam giác có đáy 8 cm, chiều cao 5 cm. Diện tích là:\nA. 40 cm2\nB. 20 cm2\nC. 13 cm2\nD. 26 cm2", null, "B", "Diện tích = 8 x 5 : 2 = 20 cm2."],
  ["TOAN5.2.1", "essay", "van_dung_cao", 2, "Một cái hộp hình lập phương có cạnh 4 dm. Tính diện tích xung quanh và thể tích của hộp.", null, null, "Diện tích xung quanh = 4 x 4 x 4 = 64 (dm2). Thể tích = 4 x 4 x 4 = 64 (dm3). Đáp số: 64 dm2; 64 dm3."],
  ["TOAN5.2.2", "multiple_choice", "van_dung", 0.5, "Một ô tô đi quãng đường 150 km trong 3 giờ. Vận tốc của ô tô là:\nA. 50 km/giờ\nB. 45 km/giờ\nC. 60 km/giờ\nD. 55 km/giờ", null, "A", "v = s : t = 150 : 3 = 50 km/giờ."],
  ["TOAN5.3.1", "true_false_4", "hieu", 1, "Trong hộp có 5 bi trắng và 5 bi đen. Đúng ghi Đ, sai ghi S:\na) Chắc chắn lấy được bi đỏ\nb) Có thể lấy được bi trắng\nc) Chắc chắn lấy được bi trắng hoặc bi đen\nd) Không thể lấy được bi đen", null, "a-Sai, b-Đúng, c-Đúng, d-Sai", "Hộp không có bi đỏ nên không thể lấy được; chỉ có trắng và đen nên chắc chắn lấy được một trong hai màu đó."],
  // ===== TOÁN 1 (lớp 1 chủ yếu nhận xét - câu đơn giản) =====
  ["TOAN1.1.1", "multiple_choice", "biet", 0.5, "Số liền sau của 69 là:\nA. 68\nB. 70\nC. 71\nD. 60", null, "B", "Số liền sau của 69 là 70."],
  ["TOAN1.1.2", "short_answer", "biet", 0.5, "Tính nhẩm: 7 + 2 = ......", null, "9", "7 + 2 = 9."],
  ["TOAN1.1.3", "essay", "van_dung", 2, "Lan có 8 quyển vở, mẹ mua thêm cho Lan 5 quyển nữa. Hỏi Lan có tất cả bao nhiêu quyển vở? (Em viết phép tính và câu trả lời)", null, null, "Phép tính: 8 + 5 = 13. Trả lời: Lan có tất cả 13 quyển vở."],
  ["TOAN1.2.2", "multiple_choice", "hieu", 0.5, "Đồng hồ chỉ kim ngắn ở số 9, kim dài ở số 12. Đồng hồ chỉ:\nA. 12 giờ\nB. 9 giờ\nC. 9 giờ 30 phút\nD. 6 giờ", null, "B", "Kim ngắn chỉ số 9, kim dài chỉ 12 là 9 giờ đúng."],
  // ===== TOÁN 2 =====
  ["TOAN2.1.2", "multiple_choice", "biet", 0.5, "Kết quả của 47 + 38 là:\nA. 75\nB. 85\nC. 95\nD. 76", null, "B", "47 + 38 = 85 (7+8=15 nhớ 1; 4+3+1=8)."],
  ["TOAN2.1.3", "true_false_4", "hieu", 1, "Đúng ghi Đ, sai ghi S:\na) 2 x 6 = 12\nb) 20 : 5 = 5\nc) 5 x 3 = 15\nd) 14 : 2 = 7", null, "a-Đúng, b-Sai, c-Đúng, d-Đúng", "20 : 5 = 4 chứ không phải 5; các ý còn lại đúng."],
  ["TOAN2.1.3", "essay", "van_dung", 2, "Mỗi hộp có 5 cái bánh. Hỏi 6 hộp như thế có tất cả bao nhiêu cái bánh?", null, null, "6 hộp có: 5 x 6 = 30 (cái bánh). Đáp số: 30 cái bánh."],
  ["TOAN2.2.2", "short_answer", "hieu", 0.5, "Điền số thích hợp: 1 m = ...... cm", null, "100", "1 m = 100 cm."],
  // ===== TIẾNG VIỆT 3 =====
  ["TVIET3.1.1", "multiple_choice", "hieu", 0.5, "Đọc đoạn văn và trả lời: Nhân vật bé Na trong đoạn văn là người như thế nào?\nA. Vụng về, nhút nhát\nB. Tốt bụng, sẵn lòng giúp đỡ bạn\nC. Thích khoe khoang\nD. Ích kỉ, chỉ biết đến mình", "Mỗi lần có bạn nào lơ đãng, Na lại đưa cho bạn một miếng giấy nhỏ đã viết sẵn bài tập. Giờ ra chơi, Na cặm cụi quét lớp giúp tổ trực nhật. Bạn nào đau tay, Na lại đến nâng quyển vở, buộc dây giày hộ bạn.", "B", "Đoạn văn cho thấy Na luôn giúp đỡ các bạn một cách tự nhiên, chân thành."],
  ["TVIET3.1.2", "multiple_choice", "biet", 0.5, "Câu thơ \"Trăng ơi, từ đâu đến?\" sử dụng biện pháp gì?\nA. So sánh\nB. Nhân hoá\nC. Điệp từ\nD. Không dùng biện pháp nào", null, "B", "Trăng được nói chuyện, hỏi thăm như con người - đó là nhân hoá."],
  ["TVIET3.4.1", "true_false_4", "hieu", 1, "Đúng ghi Đ, sai ghi S:\na) Câu \"Em rất vui được đến trường\" là câu kể.\nb) Từ \"vui mừng\" và \"buồn bã\" là hai từ trái nghĩa.\nc) Câu \"Bạn ơi, đến đây nào!\" là câu khiến.\nd) \"Chăm chỉ\" và \"siêng năng\" là hai từ trái nghĩa.", null, "a-Đúng, b-Đúng, c-Đúng, d-Sai", "Câu a kể sự việc - câu kể; b đúng trái nghĩa; c có lời gọi mời - câu khiến; d là từ đồng nghĩa không phải trái nghĩa."],
  ["TVIET3.2.1", "essay", "van_dung", 2.5, "Viết một đoạn văn ngắn (khoảng 4 - 5 câu) kể lại việc em đã làm cùng các bạn trong buổi lao động trồng cây của lớp.", null, null, "Gợi ý chấm: đoạn văn đủ 4-5 câu; kể được việc làm cụ thể (xới đất, trồng cây, tưới nước); câu viết đúng ngữ pháp, đúng chính tả; nêu được cảm xúc của bản thân."],
  // ===== TIẾNG VIỆT 4 =====
  ["TVIET4.1.1", "multiple_choice", "hieu", 0.5, "Đọc đoạn văn và trả lời: Đoạn văn muốn nói điều gì?\nA. Hoa phượng nở vào mùa hè\nB. Vẻ đẹp của hoa phượng và cảm xúc của người học trò\nC. Cách trồng cây phượng\nD. Thời tiết mùa hè nóng nực", "Hoa phượng nở đỏ rực sân trường. Bông hoa đỏ như ngọn lửa nhỏ, báo hiệu mùa hè và mùa chia tay đã đến gần. Bạn nào cũng ngẩng nhìn chùm hoa với bao cảm xúc lưu luyến.", "B", "Đoạn văn vừa tả vẻ đẹp hoa phượng vừa gợi cảm xúc lưu luyến của học trò khi sắp chia tay."],
  ["TVIET4.4.1", "multiple_choice", "biet", 0.5, "Từ \"nhanh nhẹn\" thuộc loại từ nào?\nA. Danh từ\nB. Động từ\nC. Tính từ\nD. Đại từ", null, "C", "\"Nhanh nhẹn\" chỉ đặc điểm, tính chất - là tính từ."],
  ["TVIET4.4.1", "true_false_4", "hieu", 1, "Đúng ghi Đ, sai ghi S:\na) \"Trường học\" là danh từ.\nb) Câu \"Bạn có khỏe không?\" là câu hỏi.\nc) Dấu gạch ngang dùng để đánh dấu lời nói trực tiếp của nhân vật.\nd) \"Chạy\" là tính từ.", null, "a-Đúng, b-Đúng, c-Đúng, d-Sai", "\"Chạy\" chỉ hoạt động nên là động từ, không phải tính từ; các ý còn lại đúng."],
  ["TVIET4.2.1", "essay", "van_dung", 2.5, "Viết một đoạn văn (khoảng 5 - 6 câu) miêu tả cái cặp sách của em.", null, null, "Gợi ý chấm: tả được hình dáng, màu sắc, đặc điểm và công dụng của cặp sách; đoạn văn mạch lạc, đúng chính tả; có cảm xúc của bản thân."],
  // ===== TIẾNG VIỆT 5 =====
  ["TVIET5.1.1", "multiple_choice", "hieu", 0.5, "Đọc đoạn thơ và trả lời: Hình ảnh \"dàn trống\" trong đoạn thơ gợi lên điều gì?\nA. Tiếng ve kêu râm ran trong nắng hè\nB. Tiếng trống trường báo hiệu năm học mới\nC. Tiếng trống hội làng rộn ràng\nD. Tiếng trống chiêng trong lễ hội", "Trong nắng hạ chói chang / Tiếng trống trường vang vọng / Mở đầu niên học mới / Nụ hoa phượng e ấp đỏ.", "B", "Đoạn thơ gợi không khí khai trường; tiếng trống trường báo hiệu năm học mới bắt đầu."],
  ["TVIET5.4.1", "multiple_choice", "hieu", 0.5, "Trong câu \"Mây trắng bồng bềnh trôi, mây đen nặng nề sụp xuống\", hai từ \"bồng bềnh\" và \"nặng nề\" là:\nA. Từ đồng nghĩa\nB. Từ trái nghĩa\nC. Từ đồng âm\nD. Từ nhiều nghĩa", null, "B", "\"Bồng bềnh\" (nhẹ, nhấp nhô) trái nghĩa với \"nặng nề\" (nặng, chìm)."],
  ["TVIET5.1.2", "true_false_4", "hieu", 1, "Đúng ghi Đ, sai ghi S:\na) Truyện \"Tấm Cám\" là câu chuyện tưởng tượng.\nb) Văn bản giới thiệu một loài động vật là văn bản thông tin.\nc) Dấu ngoặc kép dùng để đánh dấu phần chú thích trong câu.\nd) Nhân vật trong văn bản kịch chủ yếu thể hiện qua lời thoại.", null, "a-Đúng, b-Đúng, c-Sai, d-Đúng", "Dấu ngoặc đơn mới đánh dấu phần chú thích; dấu ngoặc kép đánh dấu tên tác phẩm hoặc lời trích dẫn."],
  ["TVIET5.2.1", "essay", "van_dung", 3, "Viết đoạn văn (khoảng 6 - 8 câu) nêu ý kiến của em về việc học sinh nên tự làm việc nhà giúp bố mẹ.", null, null, "Gợi ý chấm: nêu được ý kiến rõ ràng; có ít nhất 2 lí do hoặc dẫn chứng; câu văn mạch lạc, đúng ngữ pháp và chính tả; thể hiện thái độ, cảm xúc chân thực."],
  // ===== TIẾNG VIỆT 1 - 2 =====
  ["TVIET1.1.1", "multiple_choice", "biet", 0.5, "Đọc câu sau và trả lời: Câu nói về ai?\nA. Con mèo\nB. Con chó\nC. Con gà\nD. Con chim", "Mèo con lười lắm. Nó nằm phơi bụng dưới nắng suốt buổi sáng.", "A", "Câu nói về con mèo."],
  ["TVIET1.4.1", "short_answer", "hieu", 0.5, "Điền âm thích hợp vào chỗ trống: trâu cày có ... (s hay x)", null, "sức", "Trâu cày có sức. Điền âm s."],
  ["TVIET2.1.1", "multiple_choice", "hieu", 0.5, "Đọc đoạn văn và trả lời: Bạn nhỏ đã làm gì để giúp bà?\nA. Quét nhà\nB. Châm vào gốc cây một hòn đá\nC. Dẫn bà đi bộ\nD. Nấu cơm", "Sáng nào bà cũng ra vườn tưới cây. Hôm nay bà đi khập khiễng, em chạy theo dìu bà đi từng bước thật chậm.", "C", "Bạn nhỏ dìu bà đi từng bước - tức dẫn bà đi bộ."],
  ["TVIET2.4.1", "multiple_choice", "biet", 0.5, "Cuối câu hỏi cần đặt dấu gì?\nA. Dấu chấm\nB. Dấu phẩy\nC. Dấu chấm hỏi\nD. Dấu chấm than", null, "C", "Câu hỏi kết thúc bằng dấu chấm hỏi."],
  // ===== TIẾNG ANH 3 =====
  ["ANH3.5.1", "multiple_choice", "biet", 0.5, "Chọn từ đúng: This is a ....\nA. pen\nB. pens\nC. an pen\nD. penss", null, "A", "\"a\" đi với danh từ số ít: This is a pen."],
  ["ANH3.2.1", "multiple_choice", "hieu", 0.5, "What is your name? - ........\nA. I'm fine\nB. I'm eight\nC. My name is Nam\nD. I like cats", null, "C", "Hỏi tên trả lời bằng My name is..."],
  ["ANH3.1.1", "true_false_4", "hieu", 1, "Listen and tick T (True) or F (False). Nội dung nghe: \"This is my classroom. It is big. There are twenty desks and one board.\"\na) The classroom is small.\nb) There are twenty desks.\nc) There are two boards.\nd) The classroom is big.", null, "a-Sai, b-Đúng, c-Sai, d-Đúng", "Bài nghe nói classroom is big và có twenty desks, one board."],
  ["ANH3.4.1", "short_answer", "van_dung", 0.5, "Điền từ còn thiếu: I ..... like apples.", null, "do not / don't", "I do not like apples (don't like)."],
  // ===== TIẾNG ANH 4 =====
  ["ANH4.5.1", "multiple_choice", "hieu", 0.5, "What time is it? - It's ........\nA. seven o'clock\nB. at school\nC. on Monday\nD. a pen", null, "A", "Trả lời giờ bằng It's + giờ + o'clock."],
  ["ANH4.3.1", "multiple_choice", "hieu", 0.5, "Read and choose: Where does Nam's father work?\nA. In a school\nB. In a hospital\nC. On a farm\nD. In a factory", "Nam's father is a worker. He works in a big factory in Ha Noi. He makes toys for children.", "D", "Đoạn văn nói He works in a big factory - bố làm việc ở nhà máy."],
  ["ANH4.2.1", "multiple_choice", "biet", 0.5, "...... can you do? - I can swim.\nA. Where\nB. What\nC. When\nD. Who", null, "B", "Hỏi khả năng dùng What can you do?"],
  ["ANH4.4.1", "essay", "van_dung", 2, "Write 3 - 4 sentences about your school. (Viết 3-4 câu về trường của em)", null, null, "Gợi ý chấm: viết đúng ngữ pháp câu đơn (My school is... / There is...); đủ 3-4 câu; đúng chính tả và chữ hoa đầu câu."],
  // ===== TIẾNG ANH 5 =====
  ["ANH5.5.1", "multiple_choice", "hieu", 0.5, "Yesterday, I ..... to the zoo with my family.\nA. go\nB. goes\nC. went\nD. will go", null, "C", "Yesterday -> thì quá khứ đơn: went."],
  ["ANH5.3.1", "multiple_choice", "hieu", 0.5, "Read and choose: What will the weather be like tomorrow?\nA. Sunny\nB. Rainy\nC. Snowy\nD. Windy", "The weather forecast says tomorrow will be cold and windy. Remember to wear warm clothes when you go out.", "D", "Đoạn văn: cold and windy -> trời sẽ có gió."],
  ["ANH5.2.1", "true_false_4", "van_dung", 1, "Mark T/F for each idea about a good weekend plan:\na) I will visit my grandparents.\nb) I will plays football.\nc) I am going to do my homework.\nd) I will helps my mum.", null, "a-Đúng, b-Sai, c-Đúng, d-Sai", "will + V nguyên thể (visit, help); going to + V (do). b, d sai chia động từ."],
  ["ANH5.4.1", "essay", "van_dung", 2, "Write a short email to your friend about your weekend plan. (Viết thư điện tử ngắn kể về kế hoạch cuối tuần)", null, null, "Gợi ý chấm: đúng thể email (Dear..., Best regards); dùng will/going to; nội dung 3-4 câu; đúng chính tả."],
];

// ---------- RUN ----------
const main = async () => {
  // 1) Lay YCCĐ he thong cap TH hien co (theo code) - idempotent:
  //    - code con trong dataset -> update description/strand/competencies (giu id)
  //    - code khong con -> xoa
  //    - code moi -> insert
  const { data: oldStds } = await supabase
    .from("tvc_curriculum_standards")
    .select("id, code")
    .is("school_id", null)
    .or("subject_code.eq.toan,subject_code.eq.tieng_viet,subject_code.eq.tieng_anh");
  const thStds = (oldStds ?? []).filter((s) =>
    /^(TOAN[1-5]|TVIET[1-5]|ANH[3-5])\./.test(s.code),
  );
  const codeSet = new Set(STDS.map((s) => s[0]));
  const existing = new Map(thStds.map((s) => [s.code, s.id]));
  const toDelete = thStds.filter((s) => !codeSet.has(s.code)).map((s) => s.id);
  if (toDelete.length) {
    const { error } = await supabase
      .from("tvc_curriculum_standards")
      .delete()
      .in("id", toDelete);
    if (error) throw new Error("delete stds: " + error.message);
    console.log(`Da xoa ${toDelete.length} YCCĐ khong con trong dataset.`);
  }
  const idOf = new Map();
  for (const [code, subject_code, grade, strand, description, competencies] of STDS) {
    const row = {
      code, subject_code, grade, strand, lesson_ref: "", description,
      competencies, version: "2025-2026", status: "active",
      prerequisite_ids: [], school_id: null,
    };
    if (existing.has(code)) {
      const id = existing.get(code);
      const { error } = await supabase
        .from("tvc_curriculum_standards")
        .update(row)
        .eq("id", id);
      if (error) throw new Error(`update ${code}: ` + error.message);
      idOf.set(code, id);
    } else {
      const { data, error } = await supabase
        .from("tvc_curriculum_standards")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(`insert ${code}: ` + error.message);
      idOf.set(code, data.id);
    }
  }
  console.log(`YCCĐ TH: ${STDS.length} ma (cap nhat ${existing.size}, them ${STDS.length - [...existing.keys()].filter((c) => codeSet.has(c)).length}).`);

  // 3) Xoa cau hoi demo cu (stem noi boi tung chay) roi seed lai
  const { data: owner } = await supabase
    .from("tvc_profiles")
    .select("id")
    .eq("email", "gvcn@demo.scn")
    .single();
  if (!owner) throw new Error("Khong tim thay tvc_profiles gvcn@demo.scn");
  await supabase
    .from("tvc_questions")
    .delete()
    .eq("owner_id", owner.id)
    .eq("source", "imported");

  // code theo <YCCĐ>-<D|F|S|E><seq>
  const typeCode = { multiple_choice: "D", true_false_4: "F", short_answer: "S", essay: "E" };
  const seq = new Map();
  const rows = QUESTIONS.map(([stdCode, qtype, level, points, stem, context, correct, solution]) => {
    const key = `${stdCode}-${typeCode[qtype]}`;
    const n = (seq.get(key) ?? 0) + 1;
    seq.set(key, n);
    const std = STDS.find((s) => s[0] === stdCode);
    return {
      owner_id: owner.id,
      code: `${stdCode}-${typeCode[qtype]}${String(n).padStart(2, "0")}`,
      stem,
      context,
      qtype,
      level,
      points,
      answer: correct ? { correct } : {},
      solution,
      standard_ids: [idOf.get(stdCode)],
      subject_code: std[1],
      grade: std[2],
      source: "imported",
      review_state: "approved", // seed soan tay theo van ban CT - danh dau san sang
    };
  });
  const { error: qErr } = await supabase.from("tvc_questions").insert(rows);
  if (qErr) throw new Error("insert questions: " + qErr.message);
  console.log(`Da seed ${rows.length} cau hoi cho ${owner.id}.`);
};

main().catch((e) => { console.error(e); process.exit(1); });
