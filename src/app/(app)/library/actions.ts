"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole } from "@/lib/auth";
import type { Role } from "@/types";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

// CR-066: thu vien - admin|bgh quan ly danh muc + muon/tra.
const ROLES: Role[] = ["bgh", "admin"];

async function guard() {
  const deny = await checkActionRole(ROLES);
  if (deny) return deny;
  return assertModule("thu_vien");
}

function mapRpcError(message: string): string {
  if (message.includes("module_disabled")) return "Module thư viện đã tắt.";
  if (message.includes("invalid_title")) return "Tên sách không được để trống.";
  if (message.includes("book_not_found")) return "Không tìm thấy sách.";
  if (message.includes("copy_not_found")) return "Không tìm thấy bản sao.";
  if (message.includes("not_available")) return "Bản sao đang được mượn hoặc không khả dụng.";
  if (message.includes("borrower_xor")) return "Chọn học sinh hoặc giáo viên - chỉ một.";
  if (message.includes("student_not_found")) return "Học sinh không thuộc trường.";
  if (message.includes("teacher_not_found")) return "Giáo viên không thuộc trường.";
  if (message.includes("loan_not_found")) return "Không tìm thấy lượt mượn.";
  if (message.includes("already_returned")) return "Lượt mượn đã trả.";
  if (message.includes("invalid_condition")) return "Tình trạng trả không hợp lệ.";
  if (message.includes("forbidden")) return "Bạn không có quyền thực hiện thao tác này.";
  return message;
}

export async function addBook(input: {
  title: string;
  author?: string;
  publisher?: string;
  pub_year?: number | null;
  isbn?: string;
  category?: string;
  price?: number | null;
  copies: number;
  source?: string;
}) {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lib_add_book", {
    p_title: input.title,
    p_author: input.author ?? null,
    p_publisher: input.publisher ?? null,
    p_year: input.pub_year ?? null,
    p_isbn: input.isbn ?? null,
    p_category: input.category ?? null,
    p_price: input.price ?? null,
    p_copies: input.copies,
    p_source: input.source ?? null,
  });
  if (error) return { error: mapRpcError(error.message) };
  revalidatePath("/library");
  revalidatePath("/library/register");
  const d = data as { book_id?: string; copies?: number } | null;
  return { ok: true, bookId: d?.book_id, copies: d?.copies ?? 0 };
}

export async function addCopies(bookId: string, count: number, source?: string) {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lib_add_copies", {
    p_book: bookId,
    p_count: count,
    p_source: source ?? null,
  });
  if (error) return { error: mapRpcError(error.message) };
  revalidatePath("/library");
  revalidatePath("/library/register");
  const d = data as { added?: number; first_no?: number } | null;
  return { ok: true, added: d?.added ?? 0, firstNo: d?.first_no };
}

export async function checkout(input: {
  copy_id: string;
  student_id?: string | null;
  teacher_id?: string | null;
  days: number;
  note?: string;
}) {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lib_checkout", {
    p_copy: input.copy_id,
    p_student: input.student_id ?? null,
    p_teacher: input.teacher_id ?? null,
    p_days: input.days,
    p_note: input.note ?? null,
  });
  if (error) return { error: mapRpcError(error.message) };
  revalidatePath("/library/loans");
  const d = data as { loan_id?: string } | null;
  return { ok: true, loanId: d?.loan_id };
}

export async function returnLoan(loanId: string, condition: "ok" | "damaged" | "lost", note?: string) {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { error } = await supabase.rpc("lib_return", {
    p_loan: loanId,
    p_condition: condition,
    p_note: note ?? null,
  });
  if (error) return { error: mapRpcError(error.message) };
  revalidatePath("/library/loans");
  return { ok: true };
}
