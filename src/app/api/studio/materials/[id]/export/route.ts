import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { docToDocx } from "@/lib/tvc/docx";
import type { DocContent, Material } from "@/types/tvc";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fmt = req.nextUrl.searchParams.get("fmt") ?? "docx";
  if (fmt !== "docx") {
    return NextResponse.json(
      { error: "Định dạng chưa hỗ trợ." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId)
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

  const { data } = await supabase
    .from("tvc_materials")
    .select("*")
    .eq("id", id)
    .single();
  const material = data as Material | null;
  if (!material)
    return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", userId)
    .single();
  const staff = ["gvcn", "gvbm", "to_truong", "bgh", "pht", "admin"].includes(
    profile?.role ?? "",
  );
  const canView =
    material.author_id === userId ||
    staff ||
    material.status === "published";
  if (!canView)
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });

  const { data: author } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", material.author_id)
    .single();

  const buf = await docToDocx(
    material.content as DocContent,
    author?.full_name ?? "giáo viên",
  );
  const filename = encodeURIComponent(
    `${material.title.replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 60)}.docx`,
  );

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
