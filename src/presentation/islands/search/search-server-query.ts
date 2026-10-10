/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'

/**
 * The `searchEngine: 'fts'` half of the `search-list` island: each applied
 * query is asked of the records endpoint (`GET /api/tables/<t>/records?q=…`)
 * within the binding's own filter, and the island renders what it answers —
 * the database's word search, ranked, instead of a substring filter over the
 * rows the page happened to ship.
 */

/** Where and how to ask, as the server stamped it on the island (`_searchServer`). */
export interface ServerSearch {
  readonly table: string
  /** The page size asked for — the binding's `limit`. */
  readonly limit: number
  /** The binding's `filter`, already in the records API's `filter` JSON form. */
  readonly filter?: string
}

type Row = Readonly<Record<string, unknown>>

/** The rows a records-API answer carries, flattened as the page sends them. */
const rowsOf = (json: unknown): readonly Row[] => {
  const records = (json as { readonly records?: unknown } | null)?.records
  if (!Array.isArray(records)) return []
  return records.map((record: { readonly id?: unknown; readonly fields?: Row }) => ({
    id: record.id,
    ...(record.fields ?? {}),
  }))
}

/** The records-endpoint URL for one query. */
const searchUrl = (server: ServerSearch, query: string): string => {
  const params = new URLSearchParams({ q: query, limit: String(server.limit) })
  if (server.filter !== undefined) params.set('filter', server.filter)
  return `/api/tables/${encodeURIComponent(server.table)}/records?${params.toString()}`
}

/**
 * The rows the database answers for `query`, or `undefined` when the island
 * should show the rows it was sent: no `server` (a browser-side engine) or an
 * empty query (the first rows). While a query is in flight the previous answer
 * stays on screen; a refused or failed read shows no row rather than stale ones.
 */
export function useServerSearch(
  server: ServerSearch | null | undefined,
  query: string
): readonly Row[] | undefined {
  const [answer, setAnswer] = useState<readonly Row[]>([])
  // The URL IS the question: one string the effect can depend on, so a new
  // query, filter or page size asks again and nothing else does.
  const url =
    server !== null && server !== undefined && query !== '' ? searchUrl(server, query) : ''

  useEffect(() => {
    if (url === '') return undefined
    const controller = new AbortController()
    fetch(url, { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => (response.ok ? rowsOf(await response.json()) : []))
      .then(setAnswer)
      // A read is aborted only when a newer query supersedes it; any other failure
      // leaves nothing to show for this one.
      .catch(() => {
        if (!controller.signal.aborted) setAnswer([])
      })
    return () => controller.abort()
  }, [url])

  return url === '' ? undefined : answer
}
