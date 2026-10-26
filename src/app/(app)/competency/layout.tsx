import { requireModule } from "@/lib/modules";

// CR-060: route guard cap module - truong tat module thi chan toan bo
// cay route nay (nav cung da an muc tuong ung).
export default async function ModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("thi_dua");
  return <>{children}</>;
}
