import { requireRoles } from "@/lib/auth";
import { requireModule } from "@/lib/modules";

// CR-064: ke_toan/bgh/admin/so_gd vao xem; ghi han che qua action.
export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoles(["ke_toan", "bgh", "admin", "so_gd"]);
  await requireModule("khoan_thu");
  return children;
}
