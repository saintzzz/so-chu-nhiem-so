import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Goi khi user co session hop le nhung khong doc duoc profile (trigger
 * handle_new_user chua chay / loi DB) - sign out de thoat vong lap
 * / -> /login -> / rồi dua ve form dang nhap.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL("/login", request.url);
  url.searchParams.set("err", "profile");
  return NextResponse.redirect(url);
}
