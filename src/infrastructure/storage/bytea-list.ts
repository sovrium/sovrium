/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'

/**
 * The `LIKE` pattern matching every key that starts with `prefix`, read
 * literally: `\`, `%` and `_` in the prefix are escaped (`ESCAPE '\'`), so
 * they never act as wildcards.
 */
export const literalPrefixPattern = (prefix: string): string =>
  `${prefix.replace(/[\\%_]/g, (char) => `\\${char}`)}%`

/** How many keys one page of {@link byteaList} reads. */
export const BYTEA_LIST_PAGE = 1000

/**
 * Every key one `readPage(after)` road answers, page after page, each page
 * read after the last key of the one before (`undefined` for the first), until
 * a page comes back shorter than `pageSize`. Each page is appended to one
 * array, so a listing of `n` keys costs `n` copies, never `n²`.
 */
export const readAllPages = async (
  readPage: (after: string | undefined) => Promise<readonly string[]>,
  pageSize: number
): Promise<readonly string[]> => {
  const all: string[] = []
  let after: string | undefined = undefined
  while (true) {
    const page = await readPage(after)
    // eslint-disable-next-line no-restricted-syntax -- sanctioned mutation: appending each page to one array keeps a long listing linear
    all.push(...page)
    const last = page.at(-1)
    if (page.length < pageSize || last === undefined) return all
    after = last
  }
}

/** One page of the keys under `prefix`, in key order, after `after`: at most `size` keys. */
export const byteaListPage = async (
  prefix: string,
  after: string | undefined,
  size: number
): Promise<readonly string[]> => {
  const past = after === undefined ? sql`` : sql` AND key > ${after}`
  const result = (await db.execute(sql`
    SELECT key FROM system.file_storage_metadata
    WHERE storage_provider = 'bytea' AND key LIKE ${literalPrefixPattern(prefix)} ESCAPE '\\'${past}
    ORDER BY key
    LIMIT ${size}
  `)) as readonly Record<string, unknown>[]
  return result.map((r) => (r as { key: string }).key)
}

/**
 * Every key under `prefix`, in key order: the prefix matched literally, and
 * no window cut before a caller's own filter runs (a listing filtered after a
 * cap would hide what sorts after the keys it leaves out).
 */
export const byteaList = (prefix: string): Promise<readonly string[]> =>
  readAllPages((after) => byteaListPage(prefix, after, BYTEA_LIST_PAGE), BYTEA_LIST_PAGE)
