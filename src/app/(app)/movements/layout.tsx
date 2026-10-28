import { requireRoles } from "@/lib/auth";
import { requireModule } from "@/lib/modules";

// CR-067: bien dong hoc sinh - gvcn tao yeu cau, bgh|admin duyet.
export default async function MovementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoles(["gvcn", "bgh", "admin"]);
  await requireModule("bien_dong_hs");
  return children;
}
