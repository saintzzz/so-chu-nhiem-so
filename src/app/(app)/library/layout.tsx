import { requireRoles } from "@/lib/auth";
import { requireModule } from "@/lib/modules";

// CR-066: thu vien - admin|bgh quan ly (thu thu kiem nhiem).
export default async function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoles(["bgh", "admin"]);
  await requireModule("thu_vien");
  return children;
}
