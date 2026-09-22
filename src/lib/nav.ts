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
      label: "Quản lý học sinh",
      children: [
        { label: "Danh sách học sinh & Tổ", href: "/register/roster" },
        { label: "Chi tiết hồ sơ học sinh", href: "/records/students" },
        { label: "Sơ đồ lớp", href: "/register/seating" },
        { label: "Nhận xét & vi phạm/khen thưởng", href: "/conduct/records" },
        { label: "Đánh giá & xếp loại", href: "/conduct/evaluation" },
        { label: "Trao đổi học sinh", href: "/conduct/student-chat" },
      ],
    },
    {
      label: "Chuyên cần",
      children: [
        { label: "Điểm danh hàng ngày", href: "/attendance/daily" },
        { label: "Báo cáo ngày cho Ban Giám Hiệu", href: "/attendance/daily-report" },
        { label: "Nghỉ học / đi muộn", href: "/attendance/leaves" },
        { label: "Thông báo phụ huynh", href: "/attendance/notify" },
        { label: "Theo dõi tình trạng", href: "/attendance/tracking" },
        { label: "Lịch sử chuyên cần", href: "/attendance/history" },
      ],
    },
    {
      label: "Giảng dạy & học tập",
      children: [
        { label: "Thời khóa biểu", href: "/schedule/timetable" },
        { label: "Sổ đầu bài", href: "/schedule/period-log" },
        { label: "Nhập / đồng bộ điểm", href: "/academics/grades" },
        { label: "Giáo án / Kế hoạch bài dạy", href: "/academics/lesson-plans" },
        { label: "Quản lý kỳ thi", href: "/academics/exams" },
        { label: "Phân tích kết quả", href: "/academics/analysis" },
        { label: "Học sinh cần hỗ trợ", href: "/academics/support" },
        { label: "Kế hoạch hỗ trợ & tiến bộ", href: "/academics/plans" },
        { label: "Trao đổi với giáo viên bộ môn", href: "/academics/teacher-chat" },
      ],
    },
    {
      label: "Phụ huynh & hoạt động",
      children: [
        { label: "Soạn & gửi thông báo", href: "/parents/compose" },
        { label: "Hộp thư phản hồi", href: "/parents/inbox" },
        { label: "Lịch hẹn trao đổi", href: "/parents/appointments" },
        { label: "Ban đại diện cha mẹ học sinh", href: "/parents/cmhs" },
        { label: "Trao đổi phụ huynh", href: "/academics/parent-chat" },
        { label: "Lập kế hoạch & phê duyệt", href: "/activities/plan" },
        { label: "Thông báo & đăng ký", href: "/activities/announce" },
        { label: "Điểm danh & đánh giá", href: "/activities/attendance" },
      ],
    },
    {
      label: "Tư vấn & an toàn",
      children: [
        { label: "Ghi nhận sự cố", href: "/safety/report" },
        { label: "Báo cáo Ban Giám Hiệu", href: "/safety/bgh" },
        { label: "Theo dõi & nhắc", href: "/safety/followup" },
        { label: "Lưu trữ & tra cứu", href: "/safety/archive" },
        { label: "Tiếp nhận & phát hiện", href: "/counseling/intake" },
        { label: "Đánh giá mức độ", href: "/counseling/assessment" },
        { label: "Chuyển tuyến chuyên gia", href: "/counseling/referral" },
      ],
    },
    {
      label: "Sổ chủ nhiệm",
      children: [
        { label: "Tiếp nhận lớp", href: "/records/intake" },
        { label: "Upload danh sách học sinh", href: "/records/upload" },
        { label: "Upload lịch năm học", href: "/register/year-events" },
        { label: "Kế hoạch tháng / sơ kết tuần", href: "/register/plans" },
        { label: "Đăng ký chỉ tiêu hiệu suất", href: "/register/kpi" },
        { label: "Ký duyệt sổ chủ nhiệm", href: "/register/signoff" },
        { label: "Duyệt & khóa sổ học bạ", href: "/register/lock-records" },
        { label: "Xuất sổ", href: "/register/export" },
        { label: "Lịch sử phiên bản sơ đồ", href: "/register/seating-history" },
        { label: "Lịch sử cập nhật hồ sơ", href: "/records/history" },
        { label: "Báo cáo tổng hợp (AI)", href: "/records/report" },
        { label: "Gợi ý công việc (AI)", href: "/register/suggestions" },
        { label: "Cổng thông tin phụ huynh", href: "/parents/portal" },
        { label: "Nhật ký thao tác", href: "/register/audit" },
      ],
    },
    {
      label: "Thi đua & năng lực",
      children: [
        { label: "Thu thập & tính điểm", href: "/emulation/scoring" },
        { label: "Xếp hạng & khen thưởng", href: "/emulation/ranking" },
        { label: "Tự đánh giá & kế hoạch", href: "/competency/self-assessment" },
        { label: "Minh chứng & đánh giá cuối năm", href: "/competency/evidence" },
      ],
    },
  ],
  gvbm: [
    {
      label: "Giảng dạy bộ môn",
      children: [
        { label: "Thời khóa biểu", href: "/schedule/timetable" },
        { label: "Sổ đầu bài", href: "/schedule/period-log" },
        { label: "Nhập / đồng bộ điểm", href: "/academics/grades" },
        { label: "Giáo án / Kế hoạch bài dạy", href: "/academics/lesson-plans" },
        { label: "Lịch thi", href: "/academics/exams" },
        { label: "Trao đổi với giáo viên chủ nhiệm", href: "/academics/teacher-chat" },
      ],
    },
    {
      label: "Năng lực giáo viên",
      children: [
        { label: "Tự đánh giá & kế hoạch", href: "/competency/self-assessment" },
        { label: "Minh chứng & đánh giá cuối năm", href: "/competency/evidence" },
      ],
    },
    { label: "Hồ sơ cá nhân", href: "/profile" },
  ],
  to_truong: [
    {
      label: "Tổ chuyên môn",
      children: [
        { label: "Trang chủ", href: "/team/home" },
        { label: "Danh sách giáo viên", href: "/team/teachers" },
        { label: "Duyệt giáo án", href: "/team/lesson-plans" },
        { label: "Duyệt đánh giá năng lực", href: "/team/review" },
        { label: "Sinh hoạt chuyên môn", href: "/team/meetings" },
      ],
    },
    {
      label: "Thời khóa biểu & Sổ đầu bài",
      children: [
        { label: "Thời khóa biểu", href: "/schedule/timetable" },
        { label: "Sổ đầu bài", href: "/schedule/period-log" },
        { label: "Lịch thi", href: "/academics/exams" },
      ],
    },
    { label: "Hồ sơ cá nhân", href: "/profile" },
  ],
  bgh: [
    {
      label: "Quản trị",
      children: [
        { label: "Dashboard cấp trường", href: "/school/dashboard" },
        { label: "Trung tâm phê duyệt", href: "/school/approvals" },
        { label: "Báo cáo ngày các lớp", href: "/school/daily-reports" },
        { label: "Điều động dạy thay", href: "/school/substitutes" },
        { label: "Radar cảnh báo sớm", href: "/school/radar" },
        { label: "Trợ lý điều hành (AI)", href: "/school/ai-assistant" },
        { label: "Cơ sở & đánh giá TT15", href: "/school/campuses" },
        { label: "Nhân sự trường", href: "/school/staff" },
        { label: "Định mức biên chế Nghị quyết 37", href: "/school/nq37" },
        { label: "Phân công năm học", href: "/school/assignments" },
        { label: "Quản lý kỳ thi", href: "/academics/exams" },
        { label: "Ban đại diện cha mẹ học sinh", href: "/parents/cmhs" },
        { label: "Tài khoản giáo viên", href: "/school/users" },
        { label: "Học sinh toàn trường", href: "/school/students" },
        { label: "Chiến lược & chỉ tiêu", href: "/school/strategy" },
        { label: "Thiết bị & cơ sở vật chất", href: "/school/equipment" },
        { label: "Thông báo toàn trường", href: "/school/announce" },
        { label: "Xếp thời khóa biểu", href: "/schedule/manage" },
      ],
    },
    {
      label: "Giám sát & báo cáo",
      children: [
        { label: "Sự cố toàn trường", href: "/safety/bgh" },
        { label: "Ký duyệt sổ chủ nhiệm", href: "/register/signoff" },
        { label: "Duyệt & khóa sổ học bạ", href: "/register/lock-records" },
        { label: "Thời khóa biểu", href: "/schedule/timetable" },
        { label: "Sổ đầu bài toàn trường", href: "/school/journals" },
        { label: "Phân tích điểm thi", href: "/school/exam-analytics" },
        { label: "Xếp hạng & khen thưởng", href: "/emulation/ranking" },
      ],
    },
    { label: "Hồ sơ cá nhân", href: "/profile" },
  ],
  pht: [
    {
      label: "Quản trị",
      children: [
        { label: "Dashboard cấp trường", href: "/school/dashboard" },
        { label: "Trung tâm phê duyệt", href: "/school/approvals" },
        { label: "Báo cáo ngày các lớp", href: "/school/daily-reports" },
        { label: "Điều động dạy thay", href: "/school/substitutes" },
        { label: "Radar cảnh báo sớm", href: "/school/radar" },
        { label: "Trợ lý điều hành (AI)", href: "/school/ai-assistant" },
        { label: "Nhân sự trường", href: "/school/staff" },
        { label: "Định mức biên chế Nghị quyết 37", href: "/school/nq37" },
        { label: "Học sinh toàn trường", href: "/school/students" },
        { label: "Chiến lược & chỉ tiêu", href: "/school/strategy" },
        { label: "Thiết bị & cơ sở vật chất", href: "/school/equipment" },
        { label: "Thông báo toàn trường", href: "/school/announce" },
        { label: "Xếp thời khóa biểu", href: "/schedule/manage" },
      ],
    },
    {
      label: "Giám sát & báo cáo",
      children: [
        { label: "Sự cố toàn trường", href: "/safety/bgh" },
        { label: "Thời khóa biểu", href: "/schedule/timetable" },
        { label: "Sổ đầu bài phân hiệu", href: "/school/journals" },
        { label: "Phân tích điểm thi", href: "/school/exam-analytics" },
      ],
    },
    { label: "Hồ sơ cá nhân", href: "/profile" },
  ],
  ke_toan: [
    {
      label: "Quản trị",
      children: [
        { label: "Nhân sự trường", href: "/school/staff" },
        { label: "Định mức biên chế Nghị quyết 37", href: "/school/nq37" },
        { label: "Cơ sở & đánh giá TT15", href: "/school/campuses" },
        { label: "Thiết bị & cơ sở vật chất", href: "/school/equipment" },
      ],
    },
    { label: "Hồ sơ cá nhân", href: "/profile" },
  ],
  phong_gd: [
    {
      label: "Quản trị",
      children: [
        { label: "Dashboard Phòng Giáo dục", href: "/dept/dashboard" },
        { label: "Đơn vị hành chính", href: "/dept/wards" },
        { label: "Báo cáo tổng hợp", href: "/dept/reports" },
        { label: "Cơ sở vật chất", href: "/dept/facilities" },
      ],
    },
    { label: "Hồ sơ cá nhân", href: "/profile" },
  ],
  ubnd: [
    {
      label: "Quản trị",
      children: [
        { label: "Dashboard địa bàn UBND", href: "/dept/dashboard" },
        { label: "Đơn vị hành chính", href: "/dept/wards" },
        { label: "Báo cáo tổng hợp", href: "/dept/reports" },
        { label: "Cơ sở vật chất", href: "/dept/facilities" },
      ],
    },
    { label: "Hồ sơ cá nhân", href: "/profile" },
  ],
  so_gd: [
    {
      label: "Quản trị",
      children: [
        { label: "Quản trị người dùng", href: "/dept/users" },
        { label: "Dashboard cấp Sở Giáo dục và Đào tạo", href: "/dept/dashboard" },
        { label: "Quản trị dữ liệu", href: "/dept/data" },
        { label: "Đơn vị hành chính", href: "/dept/wards" },
        { label: "Báo cáo tổng hợp", href: "/dept/reports" },
        { label: "Cơ sở vật chất", href: "/dept/facilities" },
      ],
    },
    { label: "Hồ sơ cá nhân", href: "/profile" },
  ],
  admin: [
    {
      label: "Quản trị",
      children: [
        { label: "Quản trị người dùng", href: "/dept/users" },
        { label: "Dashboard cấp Sở Giáo dục và Đào tạo", href: "/dept/dashboard" },
      ],
    },
  ],
  phu_huynh: [],
  hoc_sinh: [],
};

export const ROLE_LABELS: Record<Role, string> = {
  gvcn: "Giáo viên chủ nhiệm",
  gvbm: "Giáo viên bộ môn",
  to_truong: "Tổ trưởng chuyên môn",
  bgh: "Hiệu trưởng / BGH",
  pht: "Phó Hiệu trưởng (cơ sở)",
  ke_toan: "Kế toán",
  so_gd: "Quản trị viên Sở Giáo dục và Đào tạo",
  phong_gd: "Phòng Giáo dục và Đào tạo",
  ubnd: "Cán bộ giáo dục UBND",
  phu_huynh: "Phụ huynh",
  hoc_sinh: "Học sinh",
  admin: "Quản trị hệ thống",
};
