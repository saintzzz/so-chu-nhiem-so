// CR-030: registry khoa chuc nang dung chung client + server
export const FEATURES = [
  { key: "studio", label: "Công cụ soạn học liệu (Studio)" },
  { key: "studio.questions", label: "Ngân hàng câu hỏi" },
  { key: "studio.review", label: "Duyệt câu hỏi / học liệu" },
  { key: "studio.export", label: "Xuất Word/PDF/PPTX" },
  { key: "studio.ai", label: "Sinh nội dung bằng AI" },
  { key: "school.users", label: "Quản trị tài khoản trường" },
] as const;
