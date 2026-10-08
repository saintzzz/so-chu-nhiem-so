// ============================================================
// gen-bank/tieng-anh.mjs - Tieng Anh TH (lop 3-5), template theo
// de thi thuc te: odd one out, fill blank, reorder, read+T/F.
// ============================================================

import { makeRng } from "./toan.mjs";
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const ri = (r, min, max) => min + Math.floor(r() * (max - min + 1));
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

const PTS = { multiple_choice: 0.5, true_false_4: 1, short_answer: 0.5, essay: 2.5 };
const Q = (stdId, grade, level, q) => ({ ...q, standard_ids: [stdId], subject_code: "tieng_anh", grade, level, points: PTS[q.qtype] });

// ---- word banks theo chu de chuong trinh TH --------------------------------
const W3 = {
  animals: ["cat", "dog", "bird", "fish", "rabbit", "monkey", "tiger", "elephant"],
  colors: ["red", "blue", "green", "yellow", "black", "white", "orange", "pink"],
  numbers: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
  school: ["pen", "pencil", "book", "ruler", "eraser", "bag", "desk", "notebook"],
  family: ["father", "mother", "brother", "sister", "grandfather", "grandmother", "baby"],
  body: ["head", "hand", "foot", "eye", "ear", "nose", "mouth", "arm"],
};
const W4 = {
  subjects: ["Maths", "English", "Vietnamese", "Science", "Music", "Art", "PE"],
  jobs: ["teacher", "doctor", "nurse", "farmer", "driver", "worker", "cook"],
  places: ["school", "hospital", "zoo", "park", "library", "market", "cinema"],
  food: ["rice", "bread", "noodles", "fish", "chicken", "milk", "juice", "water"],
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  time: ["morning", "afternoon", "evening", "night"],
  weather: ["sunny", "rainy", "cloudy", "windy", "stormy"],
};
const W5 = {
  jobs: ["doctor", "teacher", "engineer", "pilot", "architect", "police officer"],
  places: ["museum", "stadium", "airport", "beach", "mountain", "countryside"],
  activities: ["swimming", "cycling", "camping", "fishing", "reading", "drawing"],
  health: ["headache", "toothache", "fever", "cold", "cough", "stomachache"],
  transport: ["bus", "train", "plane", "motorbike", "bicycle", "ship"],
  festivals: ["Tet", "Mid-Autumn Festival", "Christmas", "Children's Day"],
};
const allOf = (bank) => Object.values(bank).flat();
const otherThemes = (bank, theme) => Object.entries(bank).filter(([k]) => k !== theme).flatMap(([, v]) => v);

// odd one out - kinh dien de TA tieu hoc
function* oddOneOut(r, bank, stdId, grade, n) {
  const themes = Object.keys(bank);
  for (let i = 0; i < n; i++) {
    const t = pick(r, themes);
    const words = [...bank[t]].sort(() => r() - 0.5).slice(0, 3);
    const odd = pick(r, otherThemes(bank, t));
    const opts = [...words, odd];
    yield Q(stdId, grade, "biet", mc("Khoanh tròn từ khác loại (Odd one out):", opts, opts.indexOf(odd)));
  }
}
// fill blank voi cau truc
function* fillBlank(r, stdId, grade, items) {
  for (const it of items) yield it;
}
const FB = (stdId, grade, level, stem, correct, wrongs, sol) =>
  Q(stdId, grade, level, { stem, qtype: "multiple_choice", answer: { correct: "A" }, solution: sol });
function* fillMc(r, stdId, grade, stems) {
  for (const [stem, correct, wrongs, sol] of stems)
    yield Q(stdId, grade, "hieu", mcAuto(r, stem, correct, wrongs));
}
// reorder words -> SA
function* reorder(r, stdId, grade, sentences, n) {
  for (let i = 0; i < n; i++) {
    const s = pick(r, sentences);
    const words = s.replace(/[.?!]/g, "").split(" ");
    const shuffled = [...words].sort(() => r() - 0.5);
    if (shuffled.join(" ") === words.join(" ")) continue;
    yield Q(stdId, grade, "van_dung", sa(
      `Sắp xếp các từ sau thành câu hoàn chỉnh: ${shuffled.join(" / ")}`,
      s, `Câu đúng: "${s}"`));
  }
}

// ============================================================
// LOP 3
// ============================================================
function* a311(r) {
  // ANH3.1.1 nghe/nhan biet loi chao, ten, do vat, mau, so - tren giay: phonic + nhan dien
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  for (let i = 0; i < 12; i++) {
    const l = pick(r, letters);
    yield Q("ANH3.1.1", 3, "biet", mcAuto(r, `Chữ cái nào đứng sau chữ "${l}" trong bảng chữ cái?`,
      String.fromCharCode(l.charCodeAt(0) + 1), [String.fromCharCode(Math.max(97, l.charCodeAt(0) - 1)), pick(r, letters), pick(r, letters)]
        .filter((x) => x !== String.fromCharCode(l.charCodeAt(0) + 1)).slice(0, 3)));
  }
  for (const t of Object.keys(W3)) {
    yield* oddOneOut(r, W3, "ANH3.1.1", 3, 2);
    break;
  }
  yield* oddOneOut(r, W3, "ANH3.1.1", 3, 10);
  const numWord = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  for (const w of W3.numbers)
    yield Q("ANH3.1.1", 3, "biet", mcAuto(r, `Số "${w}" là số mấy?`, `${numWord[w]}`, ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].filter((x) => x !== `${numWord[w]}`).slice(0, 3)));
}
function* a321(r) {
  // ANH3.2.1 loi chao, gioi thieu ten tuoi
  const stems = [
    ["Chọn câu trả lời phù hợp: \"Hello! What's your name?\"", "My name is Mai.", ["I am eight.", "Goodbye!", "It is red."]],
    ["Chọn câu trả lời phù hợp: \"How old are you?\"", "I am eight years old.", ["My name is Nam.", "It is a pen.", "Hello!"]],
    ["Chọn lời chào phù hợp buổi sáng:", "Good morning!", ["Good night!", "Goodbye!", "See you later!"]],
    ["Chọn câu trả lời phù hợp: \"What colour is it?\"", "It is blue.", ["It is a book.", "I am nine.", "My name is Lan."]],
    ["Chọn câu trả lời phù hợp: \"Goodbye, Lan!\"", "Bye bye!", ["Hello!", "Thank you!", "I am fine."]],
    ["Chọn câu trả lời phù hợp: \"Is it a ruler?\"", "Yes, it is.", ["It is red.", "I am eight.", "Goodbye!"]],
    ["Điền từ thích hợp: \"___ name is Hung.\"", "My", ["I", "Me", "You"]],
    ["Điền từ thích hợp: \"I ___ nine years old.\"", "am", ["is", "are", "be"]],
  ];
  yield* fillMc(r, "ANH3.2.1", 3, stems.map(([s, c, w]) => [s, c, w, undefined]));
  yield* reorder(r, "ANH3.2.1", 3, [
    "My name is Mai.", "I am eight years old.", "This is my pen.", "What is your name?",
    "It is blue.", "Nice to meet you.", "How old are you?", "Good morning teacher.",
  ], 12);
}
function* a331(r) {
  // ANH3.3.1 doc hieu tu/cum/cau don
  const texts = [
    { t: "This is my cat. It is black. It is small.", items: [["The cat is black.", true], ["The cat is big.", false], ["It is a dog.", false], ["The cat is small.", true]] },
    { t: "My name is Lan. I am eight. I have a red bag.", items: [["Lan is eight years old.", true], ["Lan has a blue bag.", false], ["Lan is nine.", false], ["The bag is red.", true]] },
    { t: "This is my family. This is my father. This is my mother. I love them.", items: [["The text is about family.", true], ["He has a sister.", false], ["He loves his family.", true], ["His father is a doctor.", false]] },
  ];
  for (const x of texts)
    yield Q("ANH3.3.1", 3, "hieu", tf4(`Đọc đoạn sau và xác định đúng/sai: "${x.t}"`, x.items.map(([t, ok]) => ({ t, ok }))));
  const pairs = [["pen", "bút"], ["book", "sách"], ["cat", "con mèo"], ["red", "màu đỏ"], ["school", "trường học"], ["father", "bố"], ["dog", "con chó"], ["blue", "màu xanh dương"]];
  for (const [w, v] of pairs)
    yield Q("ANH3.3.1", 3, "biet", mcAuto(r, `Từ "${w}" có nghĩa là:`, v, pairs.filter((x) => x[1] !== v).map((x) => x[1])));
}
function* a341(r) {
  // ANH3.4.1 viet dung theo mau, dien tu
  const stems = [
    ["Điền chữ cái còn thiếu: c _ t (con mèo)", "a", ["e", "i", "o"]],
    ["Điền chữ cái còn thiếu: d _ g (con chó)", "o", ["a", "e", "u"]],
    ["Điền chữ cái còn thiếu: b _ _ k (sách)", "oo", ["ee", "aa", "oa"]],
    ["Điền chữ cái còn thiếu: _ e n (bút)", "p", ["b", "t", "d"]],
    ["Điền chữ cái còn thiếu: r _ l e r (thước)", "u", ["a", "o", "i"]],
    ["Điền từ còn thiếu: \"This ___ a book.\"", "is", ["am", "are", "be"]],
    ["Điền từ còn thiếu: \"It ___ my pencil.\"", "is", ["am", "are", "do"]],
  ];
  yield* fillMc(r, "ANH3.4.1", 3, stems.map(([s, c, w]) => [s, c, w, undefined]));
  for (const w of [...W3.school, ...W3.animals, ...W3.colors])
    yield Q("ANH3.4.1", 3, "van_dung", sa(`Viết lại từ đúng chính tả: "${w.split("").sort(() => r() - 0.5).join("")}"`, w, `Từ đúng: ${w}`));
}
function* a351(r) {
  // ANH3.5.1 tu vung chu de + cau truc This is/I like
  yield* oddOneOut(r, W3, "ANH3.5.1", 3, 12);
  yield* fillMc(r, "ANH3.5.1", 3, [
    ["Chọn câu đúng:", "This is my book.", ["This are my book.", "This is my books.", "These is my book."]],
    ["Điền từ: \"I ___ cats.\"", "like", ["likes", "am", "is"]],
    ["Chọn câu đúng:", "I like dogs.", ["I likes dogs.", "I like dog.", "I am like dogs."]],
    ["Điền từ: \"___ is a ruler.\"", "This", ["These", "Those", "They"]],
  ].map(([s, c, w]) => [s, c, w, undefined]));
}

// ============================================================
// LOP 4
// ============================================================
function* a411(r) {
  // ANH4.1.1 nghe hoi thoai - tren giay: hoan thanh hoi thoai
  const stems = [
    ["Hoàn thành hội thoại: \"- What time do you get up? - I get up ___ six o'clock.\"", "at", ["in", "on", "to"]],
    ["Hoàn thành hội thoại: \"- What subjects do you have today? - I have ___\"", "Maths and English.", ["a dog.", "seven o'clock.", "my mother."]],
    ["Hoàn thành hội thoại: \"- Where is your school? - It is ___ Nguyen Trai street.\"", "in", ["at six", "under", "yesterday"]],
    ["Hoàn thành hội thoại: \"- What can you do? - I can ___\"", "swim", ["swimming", "a swim", "to swimming"]],
  ];
  yield* fillMc(r, "ANH4.1.1", 4, stems.map(([s, c, w]) => [s, c, w, undefined]));
  yield* oddOneOut(r, W4, "ANH4.1.1", 4, 8);
}
function* a421(r) {
  // ANH4.2.1 hoi dap noi chon, mon hoc, thoi gian, gia ca, can
  const stems = [
    ["Chọn câu trả lời phù hợp: \"What time is it?\"", "It is seven o'clock.", ["It is Monday.", "I am fine.", "It is red."]],
    ["Chọn câu trả lời phù hợp: \"When do you have English?\"", "I have it on Tuesday.", ["I like English.", "It is a pen.", "At my house."]],
    ["Chọn câu trả lời phù hợp: \"Can you swim?\"", "Yes, I can.", ["I can swim.", "Yes, I do.", "I am swimming."]],
    ["Chọn câu trả lời phù hợp: \"How much is this book?\"", "It is 20,000 dong.", ["It is big.", "Two books.", "It is mine."]],
    ["Chọn câu trả lời phù hợp: \"What is your favourite subject?\"", "I like Maths.", ["At school.", "On Monday.", "It is fun."]],
    ["Điền từ: \"___ you play football? - Yes, I can.\"", "Can", ["Do", "Are", "Is"]],
    ["Điền từ: \"What ___ is it? - It's nine o'clock.\"", "time", ["day", "colour", "subject"]],
    ["Điền từ: \"I go to school ___ Monday to Friday.\"", "from", ["at", "on", "in"]],
  ];
  yield* fillMc(r, "ANH4.2.1", 4, stems.map(([s, c, w]) => [s, c, w, undefined]));
  yield* reorder(r, "ANH4.2.1", 4, [
    "What time do you go to school?", "I go to school at seven.", "She can ride a bike.",
    "My favourite subject is English.", "How much is the pen?", "I have Maths on Monday.",
  ], 12);
}
function* a431(r) {
  // ANH4.3.1 doc hieu doan van ngan
  const texts = [
    { t: "My name is Minh. I am a student at Nguyen Trai Primary School. I go to school from Monday to Friday. My favourite subject is English.", items: [["Minh is a student.", true], ["His school is Nguyen Trai Primary School.", true], ["He goes to school on Sunday.", false], ["His favourite subject is Maths.", false]] },
    { t: "Hi, I am Hoa. My family has four people: my father, my mother, my brother and me. My father is a doctor. My mother is a teacher.", items: [["Hoa's family has five people.", false], ["Her father is a doctor.", true], ["Her mother is a farmer.", false], ["Hoa has one brother.", true]] },
    { t: "It is Sunday today. I do not go to school. I go to the zoo with my family. I can see monkeys, tigers and elephants there.", items: [["Today is Sunday.", true], ["He goes to school today.", false], ["He goes to the zoo.", true], ["He can see lions.", false]] },
  ];
  for (const x of texts)
    yield Q("ANH4.3.1", 4, "hieu", tf4(`Đọc đoạn sau và xác định đúng/sai: "${x.t}"`, x.items.map(([t, ok]) => ({ t, ok }))));
  const pairs = [["subject", "môn học"], ["favourite", "yêu thích"], ["hospital", "bệnh viện"], ["weather", "thời tiết"], ["breakfast", "bữa sáng"], ["clock", "đồng hồ"], ["garden", "vườn"], ["market", "chợ"]];
  for (const [w, v] of pairs)
    yield Q("ANH4.3.1", 4, "biet", mcAuto(r, `Từ "${w}" có nghĩa là:`, v, pairs.filter((x) => x[1] !== v).map((x) => x[1])));
}
function* a441(r) {
  // ANH4.4.1 viet cau/doan theo huong dan
  const stems = [
    ["Điền từ còn thiếu: \"My father ___ a doctor.\"", "is", ["am", "are", "be"]],
    ["Điền từ còn thiếu: \"They ___ football on Sunday.\"", "play", ["plays", "playing", "played"]],
    ["Chọn câu viết đúng:", "She likes listening to music.", ["She like listening music.", "She likes listen to music.", "She listening to music."]],
    ["Chọn câu viết đúng:", "I get up at six o'clock.", ["I get up on six o'clock.", "I get up in six o'clock.", "I gets up at six o'clock."]],
  ];
  yield* fillMc(r, "ANH4.4.1", 4, stems.map(([s, c, w]) => [s, c, w, undefined]));
  yield* reorder(r, "ANH4.4.1", 4, [
    "My mother is a teacher.", "I like English very much.", "The book is on the desk.",
    "We have lunch at eleven.", "He goes to bed at nine.", "There are four people in my family.",
  ], 12);
  yield Q("ANH4.4.1", 4, "van_dung", tl("Viết 3-4 câu giới thiệu về gia đình em (tên, nghề nghiệp của bố mẹ).",
    "Mẫu: My name is ___. There are ___ people in my family. My father is a ___. My mother is a ___. I love my family."));
}
function* a451(r) {
  // ANH4.5.1 tu vung chu diem lop 4
  yield* oddOneOut(r, W4, "ANH4.5.1", 4, 15);
  yield* fillMc(r, "ANH4.5.1", 4, [
    ["Điền từ: \"I have English ___ Monday and Thursday.\"", "on", ["in", "at", "from"]],
    ["Điền từ: \"She is a ___. She works in a hospital.\"", "doctor", ["teacher", "farmer", "student"]],
    ["Điền từ: \"What is the ___ like today? - It's sunny.\"", "weather", ["day", "time", "sky"]],
    ["Điền từ: \"I ___ like noodles.\" (phủ định)", "don't", ["doesn't", "am not", "isn't"]],
  ].map(([s, c, w]) => [s, c, w, undefined]));
}

// ============================================================
// LOP 5
// ============================================================
function* a511(r) {
  // ANH5.1.1 nghe hoi thoai/cau chuyen - tren giay: hoan thanh + TF
  const stems = [
    ["Hoàn thành: \"- What's the matter with you? - I have a ___\"", "headache", ["sunny", "Monday", "bicycle"]],
    ["Hoàn thành: \"- What will you do tomorrow? - I ___ visit my grandparents.\"", "will", ["am", "do", "did"]],
    ["Hoàn thành: \"- How did you go to Ha Noi? - I went ___ train.\"", "by", ["on", "in", "with"]],
    ["Hoàn thành: \"- Where did you go last summer? - I went to ___\"", "the beach", ["yesterday", "swimming", "my friend"]],
  ];
  yield* fillMc(r, "ANH5.1.1", 5, stems.map(([s, c, w]) => [s, c, w, undefined]));
  yield* oddOneOut(r, W5, "ANH5.1.1", 5, 8);
}
function* a521(r) {
  // ANH5.2.1 ke chuyen theo tranh, will / be going to
  const stems = [
    ["Điền từ: \"I ___ visit Hue next week.\" (dự định)", "am going to", ["go to", "will going", "went"]],
    ["Điền từ: \"She ___ be a teacher in the future.\"", "will", ["is", "does", "has"]],
    ["Chọn câu đúng:", "We are going to have a party.", ["We going to have a party.", "We are go to have a party.", "We will going have a party."]],
    ["Chọn câu trả lời: \"What will you do this weekend?\"", "I will play football with my friends.", ["I play football yesterday.", "I am playing now.", "Football is fun."]],
    ["Điền từ: \"He ___ a headache yesterday.\"", "had", ["has", "have", "is having"]],
  ];
  yield* fillMc(r, "ANH5.2.1", 5, stems.map(([s, c, w]) => [s, c, w, undefined]));
  yield* reorder(r, "ANH5.2.1", 5, [
    "I will go to the beach tomorrow.", "She is going to be a doctor.", "What will you do next summer?",
    "We are going to visit our grandparents.", "He had a cold last week.", "They will travel by plane.",
  ], 12);
}
function* a531(r) {
  // ANH5.3.1 doc hieu van ban ngan, suy luan nghia tu
  const texts = [
    { t: "Last summer, Nam went to Da Nang with his family. They travelled by train. They visited the beach and ate seafood. Nam liked the trip very much.", items: [["Nam went to Da Nang last summer.", true], ["They travelled by plane.", false], ["They ate seafood.", true], ["Nam did not like the trip.", false]] },
    { t: "Lan wants to be a doctor because she likes helping people. She studies hard at school. After school, she often reads books about health.", items: [["Lan wants to be a teacher.", false], ["She likes helping people.", true], ["She never reads books.", false], ["She wants to be a doctor.", true]] },
    { t: "Mai had a toothache yesterday. She could not go to school. Her mother took her to the dentist. Now she feels better.", items: [["Mai had a headache.", false], ["She went to school yesterday.", false], ["Her mother took her to the dentist.", true], ["She feels better now.", true]] },
  ];
  for (const x of texts)
    yield Q("ANH5.3.1", 5, "hieu", tf4(`Đọc đoạn sau và xác định đúng/sai: "${x.t}"`, x.items.map(([t, ok]) => ({ t, ok }))));
  const pairs = [["dentist", "nha sĩ"], ["travel", "du lịch/đi lại"], ["future", "tương lai"], ["abroad", "nước ngoài"], ["seafood", "hải sản"], ["grandparents", "ông bà"], ["museum", "bảo tàng"], ["engineer", "kỹ sư"]];
  for (const [w, v] of pairs)
    yield Q("ANH5.3.1", 5, "biet", mcAuto(r, `Từ "${w}" có nghĩa là:`, v, pairs.filter((x) => x[1] !== v).map((x) => x[1])));
}
function* a541(r) {
  // ANH5.4.1 viet doan ve ban than/gia dinh, thu
  const stems = [
    ["Chọn câu viết đúng:", "I was born in 2014 in Ha Noi.", ["I born in 2014 in Ha Noi.", "I am born in 2014 Ha Noi.", "I was bear in 2014 in Ha Noi."]],
    ["Điền từ: \"___ you go to school yesterday? - Yes, I did.\"", "Did", ["Do", "Does", "Are"]],
    ["Điền từ: \"She ___ to the park last Sunday.\"", "went", ["go", "goes", "going"]],
    ["Chọn câu đúng thì quá khứ:", "They played football yesterday.", ["They play football yesterday.", "They plays football yesterday.", "They will play football yesterday."]],
  ];
  yield* fillMc(r, "ANH5.4.1", 5, stems.map(([s, c, w]) => [s, c, w, undefined]));
  yield* reorder(r, "ANH5.4.1", 5, [
    "I went to Ha Long Bay last summer.", "She wrote a letter to her friend.", "We visited the museum yesterday.",
    "He was born in Ho Chi Minh City.", "They travelled by train last month.", "I will write about my family.",
  ], 12);
  yield Q("ANH5.4.1", 5, "van_dung", tl("Viết một đoạn văn ngắn (4-5 câu) kể về chuyến đi chơi gần đây của em.",
    "Gợi ý: Last ___, I went to ___. I went there by ___. I saw ___. I ate ___. I liked it very much."));
}
function* a551(r) {
  // ANH5.5.1 tu vung chu diem lop 5
  yield* oddOneOut(r, W5, "ANH5.5.1", 5, 15);
  yield* fillMc(r, "ANH5.5.1", 5, [
    ["Điền từ: \"A ___ flies a plane.\"", "pilot", ["doctor", "farmer", "teacher"]],
    ["Điền từ: \"You should see a dentist when you have a ___\"", "toothache", ["fever dream", "bicycle", "birthday"]],
    ["Điền từ: \"We went to Ha Noi ___ train.\"", "by", ["on", "in", "with"]],
    ["Điền từ: \"___ is a big festival in spring in Viet Nam.\"", "Tet", ["Sunday", "Summer", "School"]],
  ].map(([s, c, w]) => [s, c, w, undefined]));
}

export const ANH_GEN = {
  "ANH3.1.1": a311, "ANH3.2.1": a321, "ANH3.3.1": a331, "ANH3.4.1": a341, "ANH3.5.1": a351,
  "ANH4.1.1": a411, "ANH4.2.1": a421, "ANH4.3.1": a431, "ANH4.4.1": a441, "ANH4.5.1": a451,
  "ANH5.1.1": a511, "ANH5.2.1": a521, "ANH5.3.1": a531, "ANH5.4.1": a541, "ANH5.5.1": a551,
};
