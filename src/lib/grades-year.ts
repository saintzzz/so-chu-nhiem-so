/** CR-049 r9 M8: mot che do loc nam hoc DUY NHAT cho moi query grades.
 *  Quy tac: giu row NULL-legacy (du lieu cu chua gan nam) + row dung
 *  nam hoc cua lop HS; loai row nam khac. */

/** PostgREST `.or()` value cho query 1 lop/1 HS da biet nam hoc.
 *  classYearId null -> chi con legacy rows (fail closed theo nam). */
export function gradeYearOr(classYearId: string | null | undefined): string {
  return classYearId
    ? `academic_year_id.is.null,academic_year_id.eq.${classYearId}`
    : "academic_year_id.is.null";
}

/** Filter in-code cho query nhieu lop (PostgREST khong the per-row).
 *  yearOf: student_id -> academic_year_id cua lop HS do. */
export function gradeInYear<T extends { academic_year_id?: string | null }>(
  row: T,
  year: string | null | undefined,
): boolean {
  return row.academic_year_id == null || row.academic_year_id === (year ?? null);
}
