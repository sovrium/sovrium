/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { latestUpdatedAtToken } from './save-retry-policy'

/** The cached shape of one records page, narrowed to the part read here. */
interface CachedRecordsPage {
  readonly records?: readonly Readonly<Record<string, unknown>>[]
}

/** Read a row's `updatedAt` out of whichever cached page currently holds it. */
function readCachedToken(
  pages: readonly (readonly [readonly unknown[], CachedRecordsPage | undefined])[],
  rowId: string | number
): string | undefined {
  const rows = pages.flatMap(([, page]) => page?.records ?? [])
  const token = rows.find((row) => String(row['id'] ?? '') === String(rowId))?.['updatedAt']
  return typeof token === 'string' ? token : undefined
}

/** Read the token off a successful save's response envelope. */
function readResponseToken(response: unknown): string | undefined {
  if (typeof response !== 'object' || response === null) return undefined
  const { updatedAt } = response as { updatedAt?: unknown }
  return typeof updatedAt === 'string' ? updatedAt : undefined
}

/**
 * Tracks the newest `updated_at` this client has seen per record, so a save can
 * declare which version of the row it was written against.
 *
 * The token is sourced from two places that race, and the newer always wins:
 *
 *   - the records query cache, read at save time rather than closed over at
 *     render time, so a refetch that lands mid-edit is picked up;
 *   - the response to this component's own previous save, which is newer than
 *     anything the query has returned yet. Without it, a second edit to the
 *     same row would be written against a version the first edit had already
 *     superseded — the row would conflict with itself.
 *
 * The cache is read through the same `['table-records', table]` key that
 * `useUpdateRecord` invalidates, so the read and the write stay on one key.
 */
export function useSaveTokens(tableName: string) {
  const queryClient = useQueryClient()
  const savedTokensRef = useRef<Readonly<Record<string, string>>>({})

  const resolveToken = useCallback(
    (rowId: string | number): string | undefined => {
      const pages = queryClient.getQueriesData<CachedRecordsPage>({
        queryKey: ['table-records', tableName],
      })
      return latestUpdatedAtToken(
        readCachedToken(pages, rowId),
        savedTokensRef.current[String(rowId)]
      )
    },
    [queryClient, tableName]
  )

  const rememberToken = useCallback((rowId: string | number, response: unknown): void => {
    const token = readResponseToken(response)
    if (token === undefined) return
    // eslint-disable-next-line functional/immutable-data -- Ref holds the newest token per row, learned from our own writes
    savedTokensRef.current = { ...savedTokensRef.current, [String(rowId)]: token }
  }, [])

  return { resolveToken, rememberToken }
}
