import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasFeature } from "@/lib/permissions";
import { docToDocx } from "@/lib/tvc/docx";
import { docToPptx } from "@/lib/tvc/pptx";
import type { DocContent, Material } from "@/types/tvc";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fmt = req.nextUrl.searchParams.get("fmt") ?? "docx";
  if (fmt !== "docx" && fmt !== "pptx") {
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
  // CR-034: xuat file chiu feature studio.export
  if (!(await hasFeature("studio.export")))
    return NextResponse.json({ error: "Tính năng xuất file đã bị quản trị tắt." }, { status: 403 });

  const { data: author } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", material.author_id)
    .single();

  const isPptx = fmt === "pptx";
  const buf = isPptx
    ? await docToPptx(
        material.content as DocContent,
        author?.full_name ?? "giáo viên",
      )
    : await docToDocx(
        material.content as DocContent,
        author?.full_name ?? "giáo viên",
      );
  const filename = encodeURIComponent(
    `${material.title.replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 60)}.${fmt}`,
  );

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": isPptx
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
