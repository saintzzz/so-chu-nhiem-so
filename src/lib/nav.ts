import type { Role } from "@/types";

export interface NavItem {
  label: string;
  href: string;
}

export interface NavSection {
  label: string;
  href?: string;
  children?: NavItem[];
}

/** Sidebar structure per role - mirrors target sitemap. */
export const NAV: Record<Role, NavSection[]> = {
  gvcn: [
    { label: "Dashboard", href: "/dashboard" },
    {
      label: "I. Hồ sơ lớp học",
      children: [
        { label: "Tiếp nhận lớp", href: "/records/intake" },
        { label: "Upload danh sách học sinh", href: "/records/upload" },
        { label: "Chi tiết hồ sơ học sinh", href: "/records/students" },
        { label: "Lịch sử cập nhật hồ sơ", href: "/records/history" },
        { label: "Báo cáo tổng hợp (AI)", href: "/records/report" },
      ],
    },
    {
      label: "II. Chuyên cần",
      children: [
        { label: "Điểm danh hàng ngày", href: "/attendance/daily" },
        { label: "Nghỉ học / đi muộn", href: "/attendance/leaves" },
        { label: "Thông báo phụ huynh", href: "/attendance/notify" },
        { label: "Theo dõi tình trạng", href: "/attendance/tracking" },
        { label: "Lịch sử chuyên cần", href: "/attendance/history" },
      ],
    },
    {
      label: "III. Học tập",
      children: [
        { label: "Nhập / đồng bộ điểm", href: "/academics/grades" },
        { label: "Phân tích kết quả", href: "/academics/analysis" },
        { label: "Học sinh cần hỗ trợ", href: "/academics/support" },
        { label: "Trao đổi với GVBM", href: "/academics/teacher-chat" },
        { label: "Trao đổi phụ huynh", href: "/academics/parent-chat" },
        { label: "Kế hoạch hỗ trợ & tiến bộ", href: "/academics/plans" },
      ],
    },
    {
      label: "IV. Rèn luyện",
      children: [
        { label: "Nhận xét & vi phạm/khen thưởng", href: "/conduct/records" },
        { label: "Đánh giá & xếp loại", href: "/conduct/evaluation" },
        { label: "Trao đổi học sinh", href: "/conduct/student-chat" },
      ],
    },
    {
      label: "V. Tư vấn học sinh",
      children: [
        { label: "Tiếp nhận & phát hiện", href: "/counseling/intake" },
        { label: "Đánh giá mức độ", href: "/counseling/assessment" },
        { label: "Chuyển tuyến chuyên gia", href: "/counseling/referral" },
      ],
    },
    {
      label: "VI. Phụ huynh",
      children: [
        { label: "Soạn & gửi thông báo", href: "/parents/compose" },
        { label: "Hộp thư phản hồi", href: "/parents/inbox" },
        { label: "Lịch hẹn trao đổi", href: "/parents/appointments" },
        { label: "Cổng thông tin phụ huynh", href: "/parents/portal" },
      ],
    },
    {
      label: "VII. Hoạt động GD",
      children: [
        { label: "Lập kế hoạch & phê duyệt", href: "/activities/plan" },
        { label: "Thông báo & đăng ký", href: "/activities/announce" },
        { label: "Điểm danh & đánh giá", href: "/activities/attendance" },
      ],
    },
    {
      label: "VIII. An toàn HS",
      children: [
        { label: "Ghi nhận sự cố", href: "/safety/report" },
        { label: "Báo cáo BGH", href: "/safety/bgh" },
        { label: "Theo dõi & nhắc", href: "/safety/followup" },
        { label: "Lưu trữ & tra cứu", href: "/safety/archive" },
      ],
    },
    {
      label: "IX. Sổ chủ nhiệm",
      children: [
        { label: "Danh sách học sinh & Tổ", href: "/register/roster" },
        { label: "Sơ đồ lớp", href: "/register/seating" },
        { label: "Lịch sử phiên bản sơ đồ", href: "/register/seating-history" },
        { label: "Upload lịch năm học", href: "/register/year-events" },
        { label: "Gợi ý công việc (AI)", href: "/register/suggestions" },
        { label: "Kế hoạch tháng / sơ kết tuần", href: "/register/plans" },
        { label: "Đăng ký KPI", href: "/register/kpi" },
        { label: "Ký duyệt sổ chủ nhiệm", href: "/register/signoff" },
        { label: "Duyệt & khóa sổ học bạ", href: "/register/lock-records" },
        { label: "Xuất sổ", href: "/register/export" },
        { label: "Nhật ký thao tác", href: "/register/audit" },
      ],
    },
    {
      label: "XIII. Thời khóa biểu & Sổ đầu bài",
      children: [
        { label: "Thời khóa biểu", href: "/schedule/timetable" },
        { label: "Sổ đầu bài", href: "/schedule/period-log" },
      ],
    },
    {
      label: "X. Thi đua",
      children: [
        { label: "Thu thập & tính điểm", href: "/emulation/scoring" },
        { label: "Xếp hạng & khen thưởng", href: "/emulation/ranking" },
      ],
    },
    {
      label: "XII. Năng lực GVCN",
      children: [
        { label: "Tự đánh giá & kế hoạch", href: "/competency/self-assessment" },
        { label: "Minh chứng & đánh giá cuối năm", href: "/competency/evidence" },
      ],
    },
  ],
  gvbm: [
    {
      label: "III. Học tập",
      children: [
        { label: "Nhập / đồng bộ điểm", href: "/academics/grades" },
        { label: "Trao đổi với GVCN", href: "/academics/teacher-chat" },
      ],
    },
    {
      label: "XIII. Thời khóa biểu & Sổ đầu bài",
      children: [
        { label: "Thời khóa biểu", href: "/schedule/timetable" },
        { label: "Sổ đầu bài", href: "/schedule/period-log" },
      ],
    },
  ],
  to_truong: [
    {
      label: "Tổ chuyên môn",
      children: [
        { label: "Trang chủ", href: "/team/home" },
        { label: "Danh sách giáo viên", href: "/team/teachers" },
        { label: "Duyệt đánh giá năng lực", href: "/team/review" },
        { label: "Sinh hoạt chuyên môn", href: "/team/meetings" },
      ],
    },
  ],
  bgh: [
    {
      label: "Quản trị",
      children: [
        { label: "Dashboard cấp trường", href: "/school/dashboard" },
        { label: "Radar cảnh báo sớm", href: "/school/radar" },
      ],
    },
    {
      label: "VII. Hoạt động GD",
      children: [{ label: "Duyệt kế hoạch", href: "/activities/plan" }],
    },
    {
      label: "VIII. An toàn HS",
      children: [{ label: "Sự cố toàn trường", href: "/safety/bgh" }],
    },
    {
      label: "IX. Sổ chủ nhiệm",
      children: [
        { label: "Ký duyệt sổ chủ nhiệm", href: "/register/signoff" },
        { label: "Duyệt & khóa sổ học bạ", href: "/register/lock-records" },
      ],
    },
    {
      label: "XIII. Thời khóa biểu & Sổ đầu bài",
      children: [{ label: "Thời khóa biểu", href: "/schedule/timetable" }],
    },
    {
      label: "X. Thi đua",
      children: [{ label: "Xếp hạng & khen thưởng", href: "/emulation/ranking" }],
    },
  ],
  so_gd: [
    {
      label: "Quản trị",
      children: [
        { label: "Quản trị người dùng", href: "/dept/users" },
        { label: "Dashboard cấp Sở GD&ĐT", href: "/dept/dashboard" },
        { label: "XI. Quản trị dữ liệu", href: "/dept/data" },
      ],
    },
  ],
  admin: [
    {
      label: "Quản trị",
      children: [
        { label: "Quản trị người dùng", href: "/dept/users" },
        { label: "Dashboard cấp Sở GD&ĐT", href: "/dept/dashboard" },
      ],
    },
  ],
  phu_huynh: [],
  hoc_sinh: [],
};

export const ROLE_LABELS: Record<Role, string> = {
  gvcn: "GVCN (Giáo viên chủ nhiệm)",
  gvbm: "GVBM (Giáo viên bộ môn)",
  to_truong: "Tổ trưởng chuyên môn",
  bgh: "BGH (Ban Giám Hiệu)",
  so_gd: "Quản trị viên Sở GD&ĐT",
  phu_huynh: "Phụ huynh",
  hoc_sinh: "Học sinh",
  admin: "Quản trị hệ thống",
};
