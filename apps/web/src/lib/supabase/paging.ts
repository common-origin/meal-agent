/** Reading a whole table through Supabase, which returns at most 1,000 rows per request. */

/** Supabase returns at most 1,000 rows per request; long tables are read in pages. */
const PAGE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Every row a paged query returns, page by page until a short page. */
export async function readAllPages<T>(query: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}
