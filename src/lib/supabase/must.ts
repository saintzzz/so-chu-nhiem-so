// CR-049 class-kill: "nguon doc loi -> du lieu rong hop le" la class loi
// lap lai suot 20+ round review. Quy tac: MOI nguon nap du lieu cho page
// server component PHAI fail-closed - loi DB throw -> error.tsx boundary
// hien man hinh loi thay vi render form/bang voi du lieu ao, chan moi
// mutation tren nguon sai lech.
//
//   const { data } = await must(supabase.from("classes").select("*"), "classes");
//
// Tra ve nguyen response (data/count/status) nen van destructure duoc count.
// Voi maybeSingle (null = khong co row la hop le): chi error moi throw.
// Voi single(): PGRST116 cung la error - dung must() khi "khong co row" la
// bat hop le, hoac tu bat PGRST116 truoc.

export async function must<T extends { error: { message: string } | null }>(
  q: PromiseLike<T>,
  label = "query",
): Promise<T> {
  const res = await q;
  if (res.error) {
    console.error(`[must:${label}]`, res.error.message);
    throw new Error(`Không tải được dữ liệu nguồn (${label}).`);
  }
  return res;
}

// Ban dong bo cho fetchAllRows (contract {rows,error,truncated}): loi trang
// dau, loi trang sau, hoac bi cat ngang deu la nguon khong day du -> throw.
//   const { rows } = mustRows(await fetchAllRows<T>(...), "students");
export function mustRows<T>(
  r: { rows: T[]; error: string | null; truncated: boolean },
  label = "query",
): { rows: T[] } {
  if (r.error || r.truncated) {
    console.error(`[mustRows:${label}]`, r.error ?? `truncated>${r.rows.length}`);
    throw new Error(`Không tải được dữ liệu nguồn (${label}).`);
  }
  return { rows: r.rows };
}
