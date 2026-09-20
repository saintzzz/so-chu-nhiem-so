import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { AdvisorChat } from "@/components/school/advisor-chat";

export default async function AiAssistantPage() {
  await requireRoles(["bgh", "pht"]);
  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Trợ lý điều hành"
        description="Hỏi đáp trên số liệu thật của trường - chuyên cần, sự cố, phê duyệt, cảnh báo sớm."
      />
      <AdvisorChat />
    </div>
  );
}
