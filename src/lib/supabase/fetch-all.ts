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
  concurrency = 4,
): Promise<{ rows: T[]; error: string | null; truncated: boolean }> {
  // Trang dau tuan tu de biet co them data khong; cac trang sau doc
  // song song theo dot `concurrency` (PostgREST chap nhan nhieu request).
  const firstWant = Math.min(pageSize, maxRows);
  const first = await run(0, firstWant - 1);
  if (first.error) return { rows: [], error: first.error.message, truncated: false };
  if (!first.data?.length) return { rows: [], error: null, truncated: false };
  const rows: T[] = [...first.data];
  if (first.data.length < firstWant) return { rows, error: null, truncated: false };

  for (let from = pageSize; from < maxRows; from += concurrency * pageSize) {
    const jobs: PromiseLike<QueryResult<T>>[] = [];
    for (let i = 0; i < concurrency && from + i * pageSize < maxRows; i++) {
      const f = from + i * pageSize;
      jobs.push(run(f, f + Math.min(pageSize, maxRows - f) - 1));
    }
    const results = await Promise.all(jobs);
    let done = false;
    for (const { data, error } of results) {
      if (error) return { rows, error: error.message, truncated: rows.length > 0 };
      if (!data?.length) { done = true; break; }
      rows.push(...data);
      if (data.length < pageSize) { done = true; break; }
    }
    if (done) return { rows, error: null, truncated: false };
  }
  return { rows, error: null, truncated: rows.length >= maxRows };
}
