// PostgREST mac dinh gioi han ~1000 rows/request - query khong phan trang
// se bi cat ngam va lam sai bao cao/dashboard. fetchAllRows doc het bang
// cach paging .range() tren mot khoa sap xep on dinh (query phai .order()).
interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

const MAX_ROWS = 100_000;

export async function fetchAllRows<T>(
  run: (from: number, to: number) => PromiseLike<QueryResult<T>>,
  pageSize = 1000,
  maxRows = MAX_ROWS,
): Promise<{ rows: T[]; error: string | null; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const want = Math.min(pageSize, maxRows - rows.length);
    const { data, error } = await run(from, from + want - 1);
    if (error) return { rows, error: error.message, truncated: rows.length > 0 };
    if (!data?.length) return { rows, error: null, truncated: false };
    rows.push(...data);
    if (data.length < want) return { rows, error: null, truncated: false };
  }
  return { rows, error: null, truncated: rows.length >= maxRows };
}
