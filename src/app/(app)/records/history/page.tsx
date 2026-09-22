import { redirect } from "next/navigation";
import { requireRoles } from "@/lib/auth";

export default async function RecordsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRoles(["gvcn", "bgh"]);
  const sp = await searchParams;
  const params = new URLSearchParams({ type: "records" });
  for (const [k, v] of Object.entries(sp)) {
    if (v) params.set(k, v);
  }
  redirect(`/register/audit?${params.toString()}`);
}
