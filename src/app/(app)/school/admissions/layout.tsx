import { requireModule } from "@/lib/modules";

// CR-062: module guard tuyen_sinh - truong tat module thi chan toan bo
// cay route tuyen sinh (nav cung da an muc tuong ung).
export default async function ModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("tuyen_sinh");
  return <>{children}</>;
}
