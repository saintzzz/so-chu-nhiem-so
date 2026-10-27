import { requireRoles } from "@/lib/auth";
import { requireModule } from "@/lib/modules";

// CR-065: GV/gvcn/to_truong/bgh/admin thao tac; so_gd chi xem ket qua.
export default async function LmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoles(["gvbm", "gvcn", "to_truong", "bgh", "admin", "so_gd"]);
  await requireModule("lms_lite");
  return children;
}
