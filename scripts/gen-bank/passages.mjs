// ============================================================
// gen-bank/passages.mjs - kho van ban doc hieu THAM SO HOA.
// Moi template: doi ten/vat/dia diem -> van ban moi + cau hoi moi.
// Van ban tu soan, khong sao chep SGK hay de thi co ban quyen.
// ============================================================

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// Moi mau: { t: fn(slots)->string, items: fn(slots)->[{t,ok}...] }
// slots: object gia tri duoc chon ngau nhien.

const NAM = ["Nam", "Minh", "Tuấn", "Hùng", "Đức", "Long"];
const NU = ["Lan", "Hoa", "Mai", "Linh", "Vy", "Hà", "Nga"];
const VAT = ["con mèo", "con chó", "con gà", "con chim", "con thỏ", "con cá"];
const NOI = ["vườn nhà", "công viên", "bờ sông", "sân trường", "quê ngoại", "bãi biển"];
const HOA = ["hoa hồng", "hoa cúc", "hoa mai", "hoa đào", "hoa sen", "hoa phượng"];

export function* docHieu(r, grade, stdId, Q, tf4, templates) {
  for (const tpl of templates) {
    for (let v = 0; v < tpl.variants; v++) {
      const slots = tpl.slots(r);
      yield Q(stdId, grade, "hieu", tf4(
        `Đọc đoạn sau và xác định đúng/sai: "${tpl.t(slots)}"`,
        tpl.items(slots).map(([t, ok]) => ({ t, ok }))));
    }
  }
}

// ---- LOP 2: cau ngan gon ----------------------------------------------------
export const DH2 = [
  {
    variants: 6,
    slots: (r) => ({ n: pick(r, NAM.concat(NU)), v: pick(r, VAT), noi: pick(r, NOI) }),
    t: (s) => `${s.n} nuôi một ${s.v} ở ${s.noi}. Mỗi sáng, ${s.n} cho nó ăn rồi mới đi học. ${s.v} rất ngoan và hay chạy theo ${s.n}.`,
    items: (s) => [
      [`${s.n} nuôi một ${s.v}.`, true],
      [`${s.n} cho ${s.v} ăn vào buổi tối.`, false],
      [`${s.v} rất ngoan.`, true],
      [`${s.n} không đi học.`, false],
    ],
  },
  {
    variants: 6,
    slots: (r) => ({ n: pick(r, NU), h: pick(r, HOA), noi: pick(r, NOI) }),
    t: (s) => `Cuối tuần, ${s.n} ra ${s.noi} ngắm ${s.h}. ${s.h} nở rộ đẹp lắm. ${s.n} hái một cành đem về cắm trong lọ.`,
    items: (s) => [
      [`${s.n} đi ngắm hoa vào ngày thường.`, false],
      [`Loài hoa trong bài là ${s.h}.`, true],
      [`${s.n} cắm hoa trong lọ.`, true],
      [`${s.h} chưa nở.`, false],
    ],
  },
  {
    variants: 6,
    slots: (r) => ({ n: pick(r, NAM), v: pick(r, VAT) }),
    t: (s) => `${s.n} có một ${s.v} màu trắng. Nó thích ăn cà rốt và rau xanh. Khi ${s.n} gọi, nó nhảy đến bên ${s.n}.`,
    items: (s) => [
      [`${s.v} của ${s.n} màu đen.`, false],
      [`${s.v} thích ăn cà rốt.`, true],
      [`${s.v} bỏ chạy khi ${s.n} gọi.`, false],
      [`${s.v} màu trắng.`, true],
    ],
  },
];

// ---- LOP 3: mieu ta + so sanh ------------------------------------------------
export const DH3 = [
  {
    variants: 6,
    slots: (r) => ({ h: pick(r, HOA), noi: pick(r, NOI), ss: pick(r, ["ngôi sao", "đốm lửa", "giọt sương", "viên ngọc"]) }),
    t: (s) => `Sáng sớm, ${s.h} ở ${s.noi} hé nở. Những cánh hoa còn đọng sương long lanh như ${s.ss}. Gió nhẹ thổi qua, hương thơm bay xa.`,
    items: (s) => [
      [`${s.h} nở vào buổi sáng.`, true],
      [`Cánh hoa được so sánh với ${s.ss}.`, true],
      [`Đoạn văn tả cảnh buổi tối.`, false],
      [`Gió thổi rất mạnh.`, false],
    ],
  },
  {
    variants: 6,
    slots: (r) => ({ n: pick(r, NU), v: pick(r, VAT), ss: pick(r, ["cục bông", "trái banh", "đám mây", "cái gối"]) }),
    t: (s) => `${s.v} nhà ${s.n} mới sinh được ba con. Chúng trông như những ${s.ss} nhỏ. ${s.n} rất thích vuốt ve chúng mỗi ngày.`,
    items: (s) => [
      [`${s.v} nhà ${s.n} sinh bốn con.`, false],
      [`Các con vật được so sánh với ${s.ss}.`, true],
      [`${s.n} không thích các con vật.`, false],
      [`${s.n} vuốt ve chúng mỗi ngày.`, true],
    ],
  },
  {
    variants: 6,
    slots: (r) => ({ n: pick(r, NAM), noi: pick(r, NOI), do: pick(r, ["đá cầu", "nhảy dây", "bắn bi", "xếp hình"]) }),
    t: (s) => `Giờ ra chơi, ${s.n} và các bạn ra ${s.noi} chơi ${s.do}. Tiếng cười nói vang cả sân. Đến khi trống vào lớp, ai cũng tiếc nuối.`,
    items: (s) => [
      [`${s.n} chơi một mình.`, false],
      [`Các bạn chơi ${s.do}.`, true],
      [`Các bạn chơi vào giờ học.`, false],
      [`Khi vào lớp các bạn tiếc nuối.`, true],
    ],
  },
];

// ---- LOP 4: co yeu to thoi gian/dia diem --------------------------------------
export const DH4 = [
  {
    variants: 6,
    slots: (r) => ({ n: pick(r, NAM.concat(NU)), noi: pick(r, NOI), tg: pick(r, ["sáng sớm", "giữa trưa", "chiều tà", "đêm khuya"]) }),
    t: (s) => `${s.tg[0].toUpperCase() + s.tg.slice(1)}, ${s.n} đi dạo ra ${s.noi}. Không khí ở đây trong lành, yên tĩnh. ${s.n} thấy lòng nhẹ nhàng hẳn.`,
    items: (s) => [
      [`Câu chuyện xảy ra vào lúc ${s.tg}.`, true],
      [`${s.n} đi ra ${s.noi}.`, true],
      [`Không khí ở đây ô nhiễm.`, false],
      [`${s.n} thấy buồn phiền.`, false],
    ],
  },
  {
    variants: 6,
    slots: (r) => ({ n: pick(r, NU), v: pick(r, VAT), nam: pick(r, [2, 3, 4]) }),
    t: (s) => `Năm ngoái, bà ngoại tặng ${s.n} một ${s.v}. Từ đó, ${s.n} chăm sóc nó mỗi ngày. Giờ đây chúng đã trở thành đôi bạn thân thiết.`,
    items: (s) => [
      [`${s.v} là quà của bà ngoại.`, true],
      [`${s.n} nhận quà năm nay.`, false],
      [`${s.n} và ${s.v} là đôi bạn thân.`, true],
      [`${s.n} không chăm sóc ${s.v}.`, false],
    ],
  },
  {
    variants: 6,
    slots: (r) => ({ n: pick(r, NAM), tr: pick(r, ["bóng đá", "cầu lông", "bóng chuyền", "cờ vua"]), cup: pick(r, ["khối lớp", "trường", "liên trường"]) }),
    t: (s) => `Tháng trước, trường ${s.n} tổ chức giải ${s.tr} cấp ${s.cup}. Lớp của ${s.n} đoạt giải nhất. Cả lớp vỡ òa vui sướng.`,
    items: (s) => [
      [`Giải ${s.tr} diễn ra tháng trước.`, true],
      [`Lớp ${s.n} đoạt giải ba.`, false],
      [`Lớp ${s.n} vỡ òa vui sướng.`, true],
      [`Giải do gia đình ${s.n} tổ chức.`, false],
    ],
  },
];

// ---- LOP 5: suy luan + bai hoc ------------------------------------------------
export const DH5 = [
  {
    variants: 6,
    slots: (r) => ({ n: pick(r, NAM), noi: pick(r, NOI), cong: pick(r, ["nhặt rác", "tưới cây", "trồng hoa", "quét dọn"]) }),
    t: (s) => `Chủ nhật tuần trước, ${s.n} cùng các bạn ra ${s.noi} ${s.cong}. Tuy mệt nhưng ai cũng vui. ${s.n} hiểu rằng giữ gìn môi trường là việc của mọi người.`,
    items: (s) => [
      [`${s.n} và các bạn ${s.cong} ở ${s.noi}.`, true],
      [`Các bạn ${s.cong} vào ngày thường.`, false],
      [`Bài học: giữ gìn môi trường là việc của mọi người.`, true],
      [`${s.n} thấy việc này vô ích.`, false],
    ],
  },
  {
    variants: 6,
    slots: (r) => ({ n: pick(r, NU), bh: pick(r, ["kiên trì", "chăm chỉ", "dũng cảm", "khiêm tốn"]), viec: pick(r, ["tập đánh đàn", "luyện chữ", "tập bơi", "học vẽ"]) }),
    t: (s) => `Lúc đầu ${s.n} ${s.viec} rất vụng. Nhưng ${s.n} không nản lòng, ngày nào cũng tập. Sau một năm, ${s.n} đã làm được điều mình muốn.`,
    items: (s) => [
      [`${s.n} bỏ cuộc giữa chừng.`, false],
      [`${s.n} tập luyện trong một năm.`, true],
      [`Câu chuyện ca ngợi đức tính ${s.bh}.`, true],
      [`${s.n} thành công ngay từ đầu.`, false],
    ],
  },
  {
    variants: 6,
    slots: (r) => ({ n: pick(r, NAM), qua: pick(r, ["táo", "cam", "xoài", "ổi"]), so: pick(r, [3, 4, 5]) }),
    t: (s) => `Trên đường về nhà, ${s.n} nhặt được một túi ${s.qua}. Biết là đồ rơi của người đi trước, ${s.n} chạy theo trả lại. Người mất cảm ơn ${s.n} rối rít.`,
    items: (s) => [
      [`${s.n} giữ túi ${s.qua} cho mình.`, false],
      [`${s.n} trả lại đồ cho người đánh mất.`, true],
      [`${s.n} là người trung thực.`, true],
      [`Túi ${s.qua} của ${s.n}.`, false],
    ],
  },
];
