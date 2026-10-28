import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

// CR-060: registry module ban kem theo truong = ban do doanh thu.
// Mac dinh BAT; admin/so_gd tat trong school_features -> menu + route +
// action deu mat. Module moi: them key + tag nav + guard route/action.
// CORE (khong liet ke): dashboard, ho so, quan ly HS co ban, TKB/diem/
// so dau bai, so chu nhiem, nhan su co ban, notifications.
export const MODULES = [
  { key: "chuyen_can", label: "Chuyên cần & điểm danh" },
  { key: "khoan_thu", label: "Khoản thu & học phí" },
  { key: "hoc_ba", label: "Sổ học bạ số" },
  { key: "ky_thi_danh_gia", label: "Kỳ thi & phân tích đánh giá" },
  { key: "lms_lite", label: "Bài tập & kiểm tra trực tuyến" },
  { key: "phu_huynh_hoat_dong", label: "Phụ huynh & hoạt động" },
  { key: "tu_van_an_toan", label: "Tư vấn & an toàn học đường" },
  { key: "thi_dua", label: "Thi đua & năng lực giáo viên" },
  { key: "thu_vien", label: "Thư viện" },
  { key: "bien_dong_hs", label: "Biến động học sinh" },
  { key: "xet_tot_nghiep", label: "Xét tốt nghiệp" },
  { key: "dieu_dong", label: "Điều động giáo viên" },
  { key: "y_te_bhyt", label: "Y tế & BHYT học sinh" },
  { key: "van_thu", label: "Văn thư & công văn" },
  { key: "tich_hop", label: "Tích hợp & kết nối" },
  { key: "to_chuyen_mon", label: "Tổ chuyên môn" },
  { key: "studio", label: "Công cụ soạn học liệu & ngân hàng câu hỏi" },
  { key: "tuyen_sinh", label: "Tuyển sinh đầu cấp" },
  { key: "van_hanh_nang_cao", label: "Vận hành nâng cao (radar, NQ37, AI, CSVC)" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

// CR-073: packaging theo 4 phan he kinh doanh. Entitlement thuc van la
// school_features per-module; suite = gom nhom de ban goi + bat/tat hang loat
// trong /dept/modules. Dashboard/report cot loi nam trong CORE (khong liet ke).
export const SUITES = [
  {
    key: "quan_ly",
    label: "Quản lý trường & hành chính",
    modules: [
      "tuyen_sinh", "khoan_thu", "bien_dong_hs", "thu_vien", "hoc_ba",
      "xet_tot_nghiep", "chuyen_can", "dieu_dong", "y_te_bhyt", "van_thu",
      "van_hanh_nang_cao",
    ],
  },
  {
    key: "day_hoc",
    label: "Hỗ trợ dạy & học",
    modules: ["studio", "lms_lite", "ky_thi_danh_gia", "to_chuyen_mon"],
  },
  {
    key: "ph_hocsinh",
    label: "Chăm sóc PH-HS & giữ chân",
    modules: ["phu_huynh_hoat_dong", "tu_van_an_toan", "thi_dua"],
  },
  {
    key: "baocao_tichhop",
    label: "Dashboard, báo cáo & tích hợp",
    modules: ["tich_hop"],
  },
] as const;
export type SuiteKey = (typeof SUITES)[number]["key"];
export const suiteOf = (m: ModuleKey): SuiteKey | null =>
  SUITES.find((s) => (s.modules as readonly string[]).includes(m))?.key ?? null;

// Set cac module bi TAT cua truong hien tai. Dedupe theo request.
export const disabledModules = cache(async (): Promise<Set<string>> => {
  const profile = await getProfile();
  if (!profile?.school_id) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_features")
    .select("module")
    .eq("school_id", profile.school_id)
    .eq("enabled", false);
  if (error) throw new Error(`school_features failed: ${error.message}`);
  return new Set((data ?? []).map((r) => r.module as string));
});

export async function requireModule(key: ModuleKey) {
  if ((await disabledModules()).has(key)) redirect("/dashboard");
}

export async function assertModule(key: ModuleKey): Promise<string | null> {
  return (await disabledModules()).has(key)
    ? "Trường chưa kích hoạt module này."
    : null;
}
