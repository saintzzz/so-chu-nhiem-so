/** 15 thuộc tính NLPC tiểu học theo mẫu CSDL ngành (TT27/2020). */
export const NLPC_ATTRIBUTES = [
  { group: "Năng lực chung", code: "nlc_tuchu", label: "Tự chủ và tự học" },
  { group: "Năng lực chung", code: "nlc_giaotiep", label: "Giao tiếp và hợp tác" },
  { group: "Năng lực chung", code: "nlc_gqvd", label: "Giải quyết vấn đề và sáng tạo" },
  { group: "Năng lực đặc thù", code: "nldt_ngonngu", label: "Ngôn ngữ" },
  { group: "Năng lực đặc thù", code: "nldt_tinhtoan", label: "Tính toán" },
  { group: "Năng lực đặc thù", code: "nldt_khoahoc", label: "Khoa học" },
  { group: "Năng lực đặc thù", code: "nldt_congnghe", label: "Công nghệ" },
  { group: "Năng lực đặc thù", code: "nldt_tinhoc", label: "Tin học" },
  { group: "Năng lực đặc thù", code: "nldt_thammi", label: "Thẩm mĩ" },
  { group: "Năng lực đặc thù", code: "nldt_thechat", label: "Thể chất" },
  { group: "Phẩm chất", code: "pc_yenuoc", label: "Yêu nước" },
  { group: "Phẩm chất", code: "pc_nhanai", label: "Nhân ái" },
  { group: "Phẩm chất", code: "pc_chamchi", label: "Chăm chỉ" },
  { group: "Phẩm chất", code: "pc_trungthuc", label: "Trung thực" },
  { group: "Phẩm chất", code: "pc_trachnhiem", label: "Trách nhiệm" },
] as const;

export const NLPC_LEVEL_LABELS: Record<string, string> = {
  T: "Tốt",
  H: "Hoàn thành",
  C: "Chưa hoàn thành",
};
