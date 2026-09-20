import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { generateTextDetailed } from "@/lib/ai";
import { fallbackToDevin } from "@/lib/devin";

interface SuggestedTask {
  title: string;
  due_date: string;
}

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "gvcn") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let classId: string | undefined;
  try {
    const body = (await req.json()) as { classId?: string };
    classId = body.classId;
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!classId) {
    return NextResponse.json({ error: "Thiếu classId" }, { status: 400 });
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: classData }, { data: eventsData }, { data: tasksData }] =
    await Promise.all([
      supabase.from("classes").select("id,name").eq("id", classId).single(),
      supabase
        .from("school_year_events")
        .select("title,event_date,category")
        .gte("event_date", today)
        .order("event_date")
        .limit(30),
      supabase
        .from("tasks")
        .select("title")
        .eq("class_id", classId)
        .neq("status", "dismissed"),
    ]);

  const className = (classData as { name: string } | null)?.name ?? "";
  const existing = new Set(
    ((tasksData ?? []) as { title: string }[]).map((t) => t.title),
  );

  const prompt = `Lớp: ${className}. Ngày hôm nay: ${today}.
Sự kiện năm học sắp tới (JSON): ${JSON.stringify(eventsData ?? [])}.
Công việc đã có (không được trùng): ${JSON.stringify([...existing])}.

Hãy đề xuất 5-8 công việc cụ thể mà giáo viên chủ nhiệm cần chuẩn bị cho lớp trong 4 tuần tới, dựa trên sự kiện và nghiệp vụ chủ nhiệm (điểm danh, sổ đầu bài, liên lạc phụ huynh, rèn luyện, thu chi, an toàn). Trả về CHỈ JSON array, mỗi phần tử {"title": "...", "due_date": "YYYY-MM-DD"}, due_date trong tương lai gần, không markdown.`;

  const aiRes = await generateTextDetailed(prompt, {
    system:
      "Bạn là trợ lý nghiệp vụ cho giáo viên chủ nhiệm trường phổ thông Việt Nam. Chỉ trả về JSON hợp lệ.",
    maxTokens: 1500,
    temperature: 0.5,
  });
  const text = aiRes.text;

  if (!text) {
    if (aiRes.error === "quota") {
      const job = await fallbackToDevin({
        supabase,
        kind: "suggest-tasks",
        prompt: `Bạn là trợ lý nghiệp vụ cho giáo viên chủ nhiệm trường phổ thông Việt Nam.\n\n${prompt}`,
        expectedShape: '[{"title": "...", "due_date": "YYYY-MM-DD"}]',
        createdBy: profile.id,
        req,
      });
      if (job) {
        return NextResponse.json({
          pending: true,
          jobId: job.jobId,
          devinUrl: job.devinUrl,
        });
      }
    }
    return NextResponse.json({ suggestions: null });
  }

  let parsed: SuggestedTask[] = [];
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const arr = JSON.parse(cleaned) as SuggestedTask[];
    parsed = arr
      .filter(
        (t) =>
          t &&
          typeof t.title === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) &&
          t.due_date >= today &&
          !existing.has(t.title),
      )
      .slice(0, 10);
  } catch {
    parsed = [];
  }

  return NextResponse.json({ suggestions: parsed });
}
