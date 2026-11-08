import {
  Award,
  BarChart3,
  Blocks,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileCheck,
  ListChecks,
  Map,
  MessageSquare,
  NotebookPen,
  PenLine,
  Plug,
  Radar,
  Receipt,
  School,
  Send,
  Star,
  Users,
} from "lucide-react";
import type { QuickAction } from "@/components/quick-actions";
import type { Role } from "@/types";

// CR-116-W2: cau hinh the "Chuc nang hay dung" theo vai tro.
// Chon theo tan suat dung hang ngay/thang cua vai tro (xem audit DM4).
export const QUICK_ACTIONS: Partial<Record<Role, QuickAction[]>> = {
  gvcn: [
    {
      href: "/attendance/daily",
      label: "Điểm danh hàng ngày",
      desc: "Đánh dấu có mặt/vắng/muộn cho lớp",
      icon: ClipboardCheck,
    },
    {
      href: "/attendance/daily-report",
      label: "Báo cáo ngày cho BGH",
      desc: "Tổng hợp chuyên cần gửi Ban Giám Hiệu",
      icon: Send,
    },
    {
      href: "/academics/grades",
      label: "Sổ điểm",
      desc: "Nhập và theo dõi điểm lớp chủ nhiệm",
      icon: BookOpen,
    },
    {
      href: "/schedule/period-log",
      label: "Sổ đầu bài",
      desc: "Ghi nhận tiết dạy, vắng theo tiết",
      icon: NotebookPen,
    },
    {
      href: "/conduct/records",
      label: "Nhận xét rèn luyện",
      desc: "Ghi tuyên dương, vi phạm, hạnh kiểm",
      icon: Star,
    },
    {
      href: "/parents/compose",
      label: "Tin nhắn phụ huynh",
      desc: "Gửi thông báo, trao đổi với PHHS",
      icon: MessageSquare,
    },
  ],
  bgh: [
    {
      href: "/school/daily-reports",
      label: "Báo cáo ngày các lớp",
      desc: "Tổng hợp chuyên cần toàn trường hôm nay",
      icon: ClipboardList,
    },
    {
      href: "/register/signoff",
      label: "Ký duyệt sổ chủ nhiệm",
      desc: "Duyệt/khóa sổ GVCN đã nộp",
      icon: PenLine,
    },
    {
      href: "/school/approvals",
      label: "Phê duyệt",
      desc: "Đơn từ, hoạt động, yêu cầu chờ duyệt",
      icon: CheckCircle2,
    },
    {
      href: "/schedule/manage",
      label: "Thời khóa biểu trường",
      desc: "Xếp và điều chỉnh TKB toàn trường",
      icon: CalendarDays,
    },
    {
      href: "/school/radar",
      label: "Radar chất lượng",
      desc: "Cảnh báo sớm lớp/HS rủi ro",
      icon: Radar,
    },
    {
      href: "/school/staff",
      label: "Nhân sự",
      desc: "Hồ sơ, phân công giáo viên",
      icon: Users,
    },
  ],
  to_truong: [
    {
      href: "/team/lesson-plans",
      label: "Duyệt giáo án",
      desc: "Giáo án GVBM trong tổ chờ duyệt",
      icon: FileCheck,
    },
    {
      href: "/team/review",
      label: "Đánh giá năng lực",
      desc: "Chấm năng lực, minh chứng GV tổ",
      icon: Award,
    },
    {
      href: "/team/meetings",
      label: "Sinh hoạt chuyên môn",
      desc: "Lịch họp, biên bản, dự giờ",
      icon: Users,
    },
    {
      href: "/team/teachers",
      label: "Giáo viên trong tổ",
      desc: "Danh sách, phân công GVBM",
      icon: BookOpen,
    },
  ],
  gvbm: [
    {
      href: "/schedule/timetable",
      label: "Lịch dạy trong tuần",
      desc: "Tiết dạy, lớp, phòng học của bạn",
      icon: CalendarDays,
    },
    {
      href: "/academics/grades",
      label: "Nhập / đồng bộ điểm",
      desc: "Nhập điểm cột, đồng bộ sổ điểm",
      icon: BookOpen,
    },
    {
      href: "/schedule/period-log",
      label: "Sổ đầu bài",
      desc: "Ghi nhận tiết đã dạy",
      icon: NotebookPen,
    },
    {
      href: "/lms",
      label: "Bài tập trực tuyến",
      desc: "Giao bài, thi trực tuyến, chấm điểm",
      icon: ClipboardList,
    },
    {
      href: "/academics/lesson-plans",
      label: "Giáo án / KHBD",
      desc: "Soạn, nộp giáo án cho tổ trưởng",
      icon: FileCheck,
    },
    {
      href: "/academics/teacher-chat",
      label: "Trao đổi GVCN",
      desc: "Trao đổi với giáo viên chủ nhiệm",
      icon: MessageSquare,
    },
  ],
  ke_toan: [
    {
      href: "/finance/invoices",
      label: "Hóa đơn & thu tiền",
      desc: "Lập hóa đơn, ghi nhận thu",
      icon: Receipt,
    },
    {
      href: "/finance/periods",
      label: "Đợt thu",
      desc: "Mở đợt thu theo kỳ/lớp",
      icon: CalendarRange,
    },
    {
      href: "/finance/items",
      label: "Danh mục khoản thu",
      desc: "Học phí, BHYT, bán trú, dịch vụ",
      icon: ListChecks,
    },
    {
      href: "/finance/reports",
      label: "Báo cáo thu chi",
      desc: "Tổng hợp thu chi, công nợ",
      icon: BarChart3,
    },
    {
      href: "/finance/integrations",
      label: "Tích hợp thanh toán",
      desc: "Cổng thanh toán, đối soát",
      icon: Plug,
    },
  ],
};

// Dept/admin dung chung mot strip (so_gd, ubnd, admin).
export const DEPT_QUICK_ACTIONS: QuickAction[] = [
  {
    href: "/dept/schools",
    label: "Trường học",
    desc: "Danh sách trường thuộc địa bàn",
    icon: School,
  },
  {
    href: "/dept/data",
    label: "Dữ liệu & báo cáo",
    desc: "Tổng hợp, xuất báo cáo địa bàn",
    icon: Database,
  },
  {
    href: "/dept/wards",
    label: "Xã / phường",
    desc: "Dữ liệu theo đơn vị hành chính",
    icon: Map,
  },
  {
    href: "/dept/users",
    label: "Người dùng",
    desc: "Tài khoản cán bộ, quản trị trường",
    icon: Users,
  },
  {
    href: "/dept/modules",
    label: "Module theo trường",
    desc: "Bật/tắt module cho từng trường",
    icon: Blocks,
  },
];
