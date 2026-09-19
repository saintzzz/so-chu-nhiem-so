/**
 * Bổ sung dữ liệu demo cho các bảng còn trống - đủ để test/demo
 * tất cả màn hình theo business flow. Chạy sau seed.mjs + seed-th.mjs.
 * Idempotent: skip bảng đã có dữ liệu.
 * Usage: node scripts/seed-fill.mjs
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
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ri = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const chance = (p) => Math.random() < p;
const daysAgo = (n) =>
  new Date(Date.now() - n * 86400000).toISOString();
const dateAgo = (n) => daysAgo(n).slice(0, 10);

async function batch(table, rows, size = 500) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + size), { ignoreDuplicates: true });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: +${rows.length}`);
}

async function isEmpty(table) {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .limit(1);
  return (count ?? 0) === 0;
}

async function main() {
  console.log("Seeding dữ liệu bổ sung cho demo/test...");

  const { data: schools } = await supabase
    .from("schools")
    .select("id,name,level");
  const thcs = schools.find((s) => s.level === "thcs");
  const th = schools.find((s) => s.level === "th");

  const { data: years } = await supabase
    .from("academic_years")
    .select("id,school_id")
    .eq("is_current", true);
  const yearOf = Object.fromEntries(years.map((y) => [y.school_id, y.id]));

  const { data: classes } = await supabase
    .from("classes")
    .select("id,name,grade,school_id,gvcn_id");
  const { data: students } = await supabase
    .from("students")
    .select("id,class_id,full_name");
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,role,school_id,full_name");
  const { data: parents } = await supabase
    .from("parents")
    .select("id,profile_id,full_name");
  const { data: parentLinks } = await supabase
    .from("parent_students")
    .select("parent_id,student_id");
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id,school_id,name");
  const { data: activities } = await supabase
    .from("activities")
    .select("id,class_id,status");
  const { data: departments } = await supabase
    .from("departments")
    .select("id,school_id");
  const { data: periodLogs } = await supabase
    .from("period_logs")
    .select("id");

  const studentsByClass = new Map();
  for (const s of students) {
    const arr = studentsByClass.get(s.class_id) ?? [];
    arr.push(s);
    studentsByClass.set(s.class_id, arr);
  }
  const parentOfStudent = new Map(
    parentLinks.map((l) => [l.student_id, l.parent_id]),
  );
  const gvcnOfSchool = (sid) => profiles.filter((p) => p.role === "gvcn" && p.school_id === sid);
  const gvbmOfSchool = (sid) => profiles.filter((p) => p.role === "gvbm" && p.school_id === sid);

  /* ---- 1. NLPC tiểu học: competency_evaluations + nlpc_comments ---- */
  if (th && (await isEmpty("competency_evaluations"))) {
    const ATTRS = [
      "nlc_tuchu","nlc_giaotiep","nlc_gqvd",
      "nldt_ngonngu","nldt_tinhtoan","nldt_khoahoc","nldt_congnghe","nldt_tinhoc","nldt_thammi","nldt_thechat",
      "pc_yenuoc","pc_nhanai","pc_chamchi","pc_trungthuc","pc_trachnhiem",
    ];
    const NLPC_CMT = {
      nlc: ["Em tự giác học tập, biết đặt mục tiêu cho bản thân.", "Em chủ động tham gia các hoạt động nhóm.", "Em cần rèn thêm tính tự chủ trong giờ tự học."],
      nldt: ["Em đọc trôi chảy, trình bày bài sạch đẹp.", "Em làm toán nhanh, tư duy logic tốt.", "Em hứng thú với các môn nghệ thuật."],
      pc: ["Em lễ phép, đoàn kết bạn bè.", "Em trung thực, có trách nhiệm với việc được giao.", "Em chăm chỉ, đi học đầy đủ."],
    };
    const rows = [];
    const cmts = [];
    for (const cls of classes.filter((c) => c.school_id === th.id)) {
      const gvcn = cls.gvcn_id;
      for (const st of studentsByClass.get(cls.id) ?? []) {
        for (const code of ATTRS) {
          rows.push({
            student_id: st.id, term: "hk1", attribute_code: code,
            level: chance(0.55) ? "T" : chance(0.85) ? "H" : "C",
            evaluated_by: gvcn,
          });
        }
        for (const grp of ["nlc", "nldt", "pc"]) {
          cmts.push({
            student_id: st.id, term: "hk1", grp,
            comment: rand(NLPC_CMT[grp]), evaluated_by: gvcn,
          });
        }
      }
    }
    await batch("competency_evaluations", rows);
    await batch("nlpc_comments", cmts);
  } else console.log("  competency_evaluations: đã có - skip");

  /* ---- 2. Điểm T/H/C + conduct cho trường TH ---- */
  if (th) {
    const thClasses = classes.filter((c) => c.school_id === th.id);
    const thSubjects = subjects.filter((s) => s.school_id === th.id);
    const { data: thGrades } = await supabase
      .from("grades").select("id").limit(1)
      .in("student_id", (studentsByClass.get(thClasses[0].id) ?? []).map(s => s.id).slice(0, 5));
    if (!thGrades?.length) {
      const g = [];
      const ce = [];
      for (const cls of thClasses) {
        for (const st of studentsByClass.get(cls.id) ?? []) {
          for (const sub of thSubjects) {
            for (const t of ["ddg_gk", "ddg_ck"]) {
              const ktdk = t === "ddg_ck" && chance(0.6) ? ri(5, 10) : null;
              g.push({
                student_id: st.id, subject_id: sub.id, term: "hk1",
                assessment_type: t, seq: 1,
                level: chance(0.5) ? "T" : chance(0.8) ? "H" : "C",
                score: ktdk,
                comment: chance(0.3) ? "Em tiếp bộ rõ rệt." : null,
              });
            }
          }
          ce.push({
            student_id: st.id, term: "hk1",
            rating: chance(0.5) ? "tot" : chance(0.8) ? "kha" : "dat",
            comment: "Em ngoan, chấp hành tốt nội quy.",
            evaluated_by: cls.gvcn_id,
          });
        }
      }
      await batch("grades", g);
      await batch("conduct_evaluations", ce);
    } else console.log("  grades TH: đã có - skip");
  }

  /* ---- 3. Hoạt động GD: điểm danh + thêm hoạt động ---- */
  if (await isEmpty("activity_attendance")) {
    const rows = [];
    for (const act of activities.filter((a) => a.status === "approved" || a.status === "done")) {
      for (const st of studentsByClass.get(act.class_id) ?? []) {
        rows.push({
          activity_id: act.id, student_id: st.id,
          status: chance(0.9) ? "present" : rand(["absent", "excused"]),
          evaluation: chance(0.3) ? rand(["Tích cực", "Tốt", "Đạt"]) : null,
        });
      }
    }
    await batch("activity_attendance", rows);
    // Thêm hoạt động mới nếu ít
    if (activities.length < 8) {
      const acts = [];
      for (const cls of classes.filter((c) => c.school_id === thcs.id).slice(0, 6)) {
        for (const [t, st, d] of [
          ["Sinh hoạt dưới cờ chủ đề An toàn giao thông", "done", 14],
          ["Vệ sinh trường lớp cuối tuần", "approved", -3],
          ["Tham quan bảo tàng dân tộc học", "pending", -10],
        ]) {
          acts.push({
            class_id: cls.id, title: t, status: st,
            activity_date: dateAgo(d),
            plan: `Kế hoạch chi tiết: ${t.toLowerCase()} cho lớp ${cls.name}.`,
            description: `Hoạt động giáo dục lớp ${cls.name}.`,
            created_by: cls.gvcn_id,
            approved_by: st !== "pending" ? profiles.find(p => p.role === "bgh" && p.school_id === cls.school_id)?.id : null,
          });
        }
      }
      await batch("activities", acts);
    }
  } else console.log("  activity_attendance: đã có - skip");

  /* ---- 4. Tư vấn + an toàn: thêm ca đa dạng status ---- */
  if ((await isEmpty("counseling_cases")) || true) {
    const { count } = await supabase.from("counseling_cases").select("id", { count: "exact", head: true });
    if ((count ?? 0) < 12) {
      const rows = [];
      const ISSUES = [
        ["Biểu hiện lo âu trước bài kiểm tra", "medium"],
        ["Xung đột với bạn cùng lớp", "low"],
        ["Giảm sút kết quả học tập đột ngột", "medium"],
        ["Dấu hiệu trầm cảm, ít giao tiếp", "high"],
        ["Nghiện điện thoại, mất tập trung", "medium"],
        ["Chán học, hay nói muốn nghỉ", "critical"],
      ];
      const allSt = classes.filter((c) => c.school_id === thcs.id)
        .flatMap((c) => studentsByClass.get(c.id) ?? []);
      for (let i = 0; i < 8; i++) {
        const st = rand(allSt);
        const cls = classes.find((c) => c.id === st.class_id);
        const [issue, sev] = rand(ISSUES);
        rows.push({
          student_id: st.id, detected_by: cls.gvcn_id, issue,
          severity: sev,
          status: rand(["new", "assessing", "counseling", "counseling", "referred", "resolved"]),
          referral: ["high", "critical"].includes(sev) && chance(0.7) ? "Chuyển phòng tham vấn học đường quận" : null,
          notes: "Đã trao đổi trực tiếp với em và thông báo gia đình.",
        });
      }
      await batch("counseling_cases", rows);
    }
  }

  const { count: incCount } = await supabase.from("incidents").select("id", { count: "exact", head: true });
  if ((incCount ?? 0) < 15) {
    const TYPES = [["Sức khỏe / tai nạn","Ngã chấn thương nhẹ trong giờ ra chơi"],["Xung đột / bạo lực học đường","Xung đột giữa các học sinh"],["An toàn giao thông","Suất hiện nguy cơ ATGT trước cổng trường"],["Sức khỏe / tai nạn","Say nắng trong giờ thể dục"],["Khác","Học sinh bỏ ra ngoài không phép"]];
    const rows = [];
    const allSt = classes.filter((c) => c.school_id === thcs.id).flatMap((c) => studentsByClass.get(c.id) ?? []);
    for (let i = 0; i < 8; i++) {
      const st = rand(allSt);
      const cls = classes.find((c) => c.id === st.class_id);
      const [type, desc] = rand(TYPES);
      rows.push({
        student_id: st.id, class_id: cls.id, type,
        severity: rand(["low","medium","low","high"]),
        status: rand(["new","following","resolved","resolved"]),
        description: desc + ` - học sinh ${st.full_name}, lớp ${cls.name}.`,
        reported_to_bgh: chance(0.7),
        occurred_at: daysAgo(ri(1, 30)),
        recorded_by: cls.gvcn_id,
      });
    }
    await batch("incidents", rows);
  }

  /* ---- 5. Tin nhắn (chat) GVCN <-> GVBM / PH / HS ---- */
  const { count: msgCount } = await supabase.from("messages").select("id", { count: "exact", head: true });
  if ((msgCount ?? 0) < 15) {
    const rows = [];
    const gvcn = profiles.find((p) => p.email === "gvcn@demo.scn")
      ?? gvcnOfSchool(thcs.id)[0];
    const gvbm = gvbmOfSchool(thcs.id);
    const cls6a1 = classes.find((c) => c.name === "6A1");
    const clsSt = studentsByClass.get(cls6a1?.id) ?? [];
    const CONV_GV = [
      ["Em Tuấn môn Toán tuần này làm bài yếu hơn, cô xem giúp.", "Vâng em cũng thấy em lơ đãng mấy tiết gần đây, em sẽ kiểm tra."],
      ["Lớp mình chuẩn bị kiểm tra 15' Văn thứ 6 nhé.", "OK cô, em đã thông báo cho các em rồi."],
      ["Em Hà chuyên cần tốt nhưng điểm GK giảm, cô có nhận xét gì?", "Em ấy hiểu bài nhưng hay sai sót nhỏ, em sẽ luyện thêm."],
    ];
    for (const [a, b] of CONV_GV) {
      const other = rand(gvbm);
      if (!other || !gvcn) continue;
      rows.push({ sender_id: gvcn.id, recipient_id: other.id, content: a, created_at: daysAgo(ri(1, 10)) });
      rows.push({ sender_id: other.id, recipient_id: gvcn.id, content: b, created_at: daysAgo(ri(0, 9)), read_at: daysAgo(ri(0, 5)) });
    }
    const CONV_PH = [
      ["Chào cô, em nghe cháu nói hôm nay lớp có hoạt động ngoại khóa ạ?", "Vâng chị, lớp đi tham quan bảo tàng, các em về an toàn cả rồi ạ."],
      ["Cháu Gia Bảo tuần này học có tiến bộ không cô?", "Cháu đã tập trung hơn, điểm kiểm tra miệng được 8.5 ạ."],
      ["Cô ơi mai cháu xin phép nghỉ học có việc gia đình ạ.", "Vâng em ghi nhận, chị nhớ làm đơn xin phép nhé."],
    ];
    for (const [a, b] of CONV_PH) {
      const st = rand(clsSt);
      const p = parents.find((x) => x.id === parentOfStudent.get(st?.id));
      if (!p?.profile_id || !gvcn) continue;
      rows.push({ sender_id: p.profile_id, recipient_id: gvcn.id, student_id: st.id, content: a, created_at: daysAgo(ri(1, 8)) });
      rows.push({ sender_id: gvcn.id, recipient_id: p.profile_id, student_id: st.id, content: b, created_at: daysAgo(ri(0, 7)), read_at: chance(0.7) ? daysAgo(ri(0, 3)) : null });
    }
    await batch("messages", rows);
  }

  /* ---- 6. Lịch hẹn PH ---- */
  const { count: apptCount } = await supabase.from("appointments").select("id", { count: "exact", head: true });
  if ((apptCount ?? 0) < 10) {
    const rows = [];
    const PURPOSES = ["Trao đổi kết quả học tập học kỳ I", "Bàn về việc cháu hay đi học muộn", "Trao đổi tình hình sức khỏe tâm lý của cháu", "Họp phụ huynh cá nhân - hỗ trợ môn Toán"];
    for (let i = 0; i < 9; i++) {
      const cls = rand(classes.filter((c) => c.school_id === thcs.id));
      const st = rand(studentsByClass.get(cls.id) ?? []);
      if (!st) continue;
      const p = parents.find((x) => x.id === parentOfStudent.get(st.id));
      if (!p) continue;
      rows.push({
        parent_id: p.id, teacher_id: cls.gvcn_id, student_id: st.id,
        scheduled_at: new Date(Date.now() + ri(-10, 14) * 86400000).toISOString(),
        purpose: rand(PURPOSES),
        status: rand(["proposed", "confirmed", "confirmed", "done", "cancelled"]),
      });
    }
    await batch("appointments", rows);
  }

  /* ---- 7. Sinh hoạt tổ + đánh giá năng lực GV ---- */
  const { count: mtgCount } = await supabase.from("dept_meetings").select("id", { count: "exact", head: true });
  if ((mtgCount ?? 0) < 6) {
    const rows = [];
    for (const dept of departments) {
      const tts = gvbmOfSchool(dept.school_id);
      for (const [t, d] of [
        ["Sinh hoạt chuyên môn đầu năm: phân chia tiết chuyên đề", 20],
        ["Rút kinh nghiệm sau kiểm tra giữa kỳ I", 7],
        ["Dự giờ đồng nghiệp và góp ý bài giảng", -4],
      ]) {
        rows.push({
          department_id: dept.id,
          title: t, meeting_date: dateAgo(d),
          content: `Nội dung chính: ${t}. Tham gia đầy đủ các thành viên tổ.`,
          created_by: tts[0]?.id,
        });
      }
    }
    await batch("dept_meetings", rows);
  }

  const { count: taCount } = await supabase.from("teacher_assessments").select("id", { count: "exact", head: true });
  if ((taCount ?? 0) < 8) {
    const rows = [];
    const evs = [];
    for (const sid of [thcs.id, th?.id].filter(Boolean)) {
      const yid = yearOf[sid];
      for (const gv of [...gvcnOfSchool(sid), ...gvbmOfSchool(sid)].slice(0, 6)) {
        rows.push({
          teacher_id: gv.id, academic_year_id: yid,
          self_review: `Tự đánh giá năm học của GV ${gv.full_name}: hoàn thành tốt nhiệm vụ chuyên môn, chủ động đổi mới phương pháp.`,
          plan: "Kế hoạch phát triển: học thêm chuyên đề CNTT, tham gia bồi dưỡng GVCN.",
          status: rand(["draft", "submitted", "submitted", "reviewed"]),
        });
      }
    }
    await batch("teacher_assessments", rows);
    const { data: tas } = await supabase.from("teacher_assessments").select("id");
    for (const t of tas ?? []) {
      for (let i = 0; i < ri(1, 3); i++) {
        evs.push({
          assessment_id: t.id,
          title: rand(["Minh chứng dự giờ", "Bài giảng điện tử", "Sáng kiến kinh nghiệm", "Giấy chứng nhận bồi dưỡng"]),
          url: `https://example.com/minh-chung/${t.id.slice(0, 8)}/${i}`,
          note: "Minh chứng nộp kèm theo đánh giá.",
        });
      }
    }
    if (await isEmpty("assessment_evidence")) await batch("assessment_evidence", evs);
  }

  /* ---- 8. audit_logs + announcement_reads + notifications ---- */
  if (await isEmpty("audit_logs")) {
    const ACTIONS = [
      ["signoff", "register_signoffs", "Ký duyệt sổ chủ nhiệm"],
      ["lock", "register_signoffs", "Duyệt & khóa sổ học bạ"],
      ["import", "grades", "Import điểm từ Excel"],
      ["update", "students", "Cập nhật hồ sơ học sinh"],
      ["insert", "attendance_records", "Xác nhận điểm danh"],
      ["export", "grades", "Xuất Mẫu 3 báo cáo"],
    ];
    const rows = [];
    for (let i = 0; i < 24; i++) {
      const actor = rand(profiles.filter((p) => p.school_id === thcs.id && ["gvcn", "bgh"].includes(p.role)));
      if (!actor) continue;
      const [action, entity, note] = rand(ACTIONS);
      rows.push({
        actor_id: actor.id, action, entity,
        entity_id: `${entity}-${ri(100, 999)}`,
        payload: { note, class: rand(["6A1", "7A1", "8A2", "9A1"]) },
        created_at: daysAgo(ri(0, 30)),
      });
    }
    await batch("audit_logs", rows);
  }

  const { data: anns } = await supabase.from("announcements").select("id,created_by");
  if (await isEmpty("announcement_reads")) {
    const readers = profiles.filter((p) => ["phu_huynh", "hoc_sinh", "gvcn"].includes(p.role));
    const rows = [];
    for (const a of anns ?? []) {
      for (const r of readers) {
        if (chance(0.55)) rows.push({ announcement_id: a.id, profile_id: r.id, read_at: daysAgo(ri(0, 10)) });
      }
    }
    await batch("announcement_reads", rows.slice(0, 400));
  }

  /* ---- 9. student_record_history + period_absences + thêm conduct_records ---- */
  const { count: histCount } = await supabase.from("student_record_history").select("id", { count: "exact", head: true });
  if ((histCount ?? 0) < 30) {
    const rows = [];
    const FIELDS = [["full_name","Nguyễn Văn A"],["dob","2013-01-15"],["gender","nam"],["national_id","1000000001"],["status","active"]];
    const gvcns = gvcnOfSchool(thcs.id);
    for (let i = 0; i < 25; i++) {
      const st = rand(students);
      const [field, val] = rand(FIELDS);
      rows.push({
        student_id: st.id, changed_by: rand(gvcns)?.id,
        field, old_value: "(giá trị cũ)", new_value: val,
        changed_at: daysAgo(ri(0, 45)),
      });
    }
    await batch("student_record_history", rows);
  }

  const { count: paCount } = await supabase.from("period_absences").select("id", { count: "exact", head: true });
  if ((paCount ?? 0) < 40 && periodLogs?.length) {
    const rows = [];
    const seen = new Set();
    while (rows.length < 35) {
      const key = `${rand(periodLogs).id}|${rand(students).id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const [period_log_id, student_id] = key.split("|");
      rows.push({
        period_log_id, student_id,
        status: rand(["excused", "unexcused", "late"]),
      });
    }
    await batch("period_absences", rows);
  }

  const { count: crCount } = await supabase.from("conduct_records").select("id", { count: "exact", head: true });
  if ((crCount ?? 0) < 150) {
    const GOOD = ["Đạt điểm 10 bài kiểm tra","Phát biểu xây dựng bài tích cực","Giúp đỡ bạn học yếu","Đạt giải Olympic cấp trường","Tham gia tích cực hoạt động lớp"];
    const BAD = ["Đi học muộn","Không làm bài tập","Nói chuyện trong giờ","Quên sách vở","Vi phạm nội quy đồng phục"];
    const rows = [];
    for (let i = 0; i < 60; i++) {
      const st = rand(students);
      const cls = classes.find((c) => c.id === st.class_id);
      const good = chance(0.55);
      rows.push({
        student_id: st.id,
        type: good ? "khen_thuong" : "vi_pham",
        content: rand(good ? GOOD : BAD),
        points: good ? ri(1, 3) : -ri(1, 2),
        date: dateAgo(ri(0, 45)),
        recorded_by: cls?.gvcn_id,
      });
    }
    await batch("conduct_records", rows);
  }

  /* ---- 10. TH school: TKB + attendance cơ bản ---- */
  if (th) {
    const { count: ttCount } = await supabase.from("timetable_entries")
      .select("id", { count: "exact", head: true })
      .in("class_id", classes.filter((c) => c.school_id === th.id).map((c) => c.id));
    if ((ttCount ?? 0) === 0) {
      const thSubs = subjects.filter((s) => s.school_id === th.id);
      const rows = [];
      for (const cls of classes.filter((c) => c.school_id === th.id)) {
        for (let wd = 2; wd <= 6; wd++) {
          for (let p = 1; p <= 5; p++) {
            rows.push({
              class_id: cls.id, weekday: wd, period: p,
              subject_id: rand(thSubs).id,
              teacher_id: cls.gvcn_id,
              room: `P.${cls.grade}${p}0${wd}`,
            });
          }
        }
      }
      await batch("timetable_entries", rows);
      // attendance tuần này
      const att = [];
      for (const cls of classes.filter((c) => c.school_id === th.id)) {
        for (const st of studentsByClass.get(cls.id) ?? []) {
          for (let d = 0; d < 5; d++) {
            att.push({
              student_id: st.id,
              date: dateAgo(d),
              status: chance(0.94) ? "present" : rand(["excused", "unexcused", "late"]),
              source: "manual",
              recorded_by: cls.gvcn_id,
            });
          }
        }
      }
      await batch("attendance_records", att);
    } else console.log("  timetable TH: đã có - skip");
  }

  console.log("Xong. Dữ liệu demo đủ cho mọi màn hình.");
}

main().catch((e) => { console.error(e); process.exit(1); });
