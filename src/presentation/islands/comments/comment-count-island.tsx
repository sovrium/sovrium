/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

/**
 * Comment count island — fetches the total comment count for a record
 * from the existing comments API (`GET /api/tables/:tableName/records/
 * :recordId/comments?limit=0`) and renders the user-facing label.
 *
 * Props (from SSR `data-island-props` JSON):
 * - `tableName` — table identifier (name OR id; the API resolves both)
 * - `recordId`  — record identifier
 * - `format`    — display template, e.g. "{count} comments"
 * - `emptyText` — copy when count === 0
 * - `emptyTextWasCustomized` — true when the page author explicitly set
 *   `emptyText`. When false the renderer falls back to substituting `0`
 *   into the default format (so "0 comments" appears on first paint).
 *
 * When `tableName` or `recordId` is missing the island shows the
 * already-rendered SSR label (it cannot fetch a count without both).
 *
 * @see [internal ref] … 035 in
 * `[internal ref]`
 */
interface CommentCountIslandProps {
  readonly tableName?: string
  readonly recordId?: string
  readonly format: string
  readonly emptyText: string
  readonly emptyTextWasCustomized: boolean
  readonly 'data-testid'?: string
}

interface CommentsListResponse {
  readonly comments: ReadonlyArray<{ readonly id: string }>
  readonly pagination?: {
    readonly total: number
    readonly limit: number
    readonly offset: number
    readonly hasMore: boolean
  }
}

function resolveCountLabel(
  count: number,
  format: string,
  emptyText: string,
  emptyTextWasCustomized: boolean
): string {
  if (count === 0 && emptyTextWasCustomized) return emptyText
  if (count === 0 && format === '{count} comments') return emptyText
  return format.replace('{count}', String(count))
}

export default function CommentCountIsland({
  tableName,
  recordId,
  format,
  emptyText,
  emptyTextWasCustomized,
  'data-testid': testId,
}: CommentCountIslandProps): ReactElement {
  const enabled = Boolean(tableName && recordId)
  const { data } = useQuery<CommentsListResponse>({
    // Stable key shape — see TanStack Query best practices for query-key conventions.
    queryKey: ['comment-count', tableName, recordId],
    enabled,
    queryFn: async () => {
      const response = await fetch(
        `/api/tables/${tableName}/records/${recordId}/comments?limit=1&offset=0`,
        { credentials: 'include' }
      )
      if (!response.ok) {
        // Permission denial / not found surfaces as zero; matches the
        // anti-enumeration 404 contract on the comments list endpoint.
        return { comments: [], pagination: { total: 0, limit: 1, offset: 0, hasMore: false } }
      }
      return (await response.json()) as CommentsListResponse
    },
    staleTime: 30_000,
  })

  const count = data?.pagination?.total ?? data?.comments?.length ?? 0
  const label = resolveCountLabel(count, format, emptyText, emptyTextWasCustomized)

  return (
    // UNNAMED on purpose: `createRoot(host)` renders this INSIDE the SSR
    // `<span>` that already carries the author's `props.id`, so stamping it
    // here too would put the same id on two nested elements from the moment the
    // island mounts — making a `#count` assertion pass before hydration and
    // fail after it.
    //
    // The same holds for the accessible NAME, which stayed here by oversight
    // when the id moved: a lookup by that name found one element before
    // hydration and two nested ones after it. The host is the element that
    // exists whether or not this subtree ever mounts, so it keeps both.
    <span
      data-component="comment-count"
      data-component-type="comment-count"
      data-comment-count-format={format}
      data-comment-count-table={tableName}
      data-comment-count-record-id={recordId}
      data-testid={testId}
      className="comment-count text-foreground-muted text-xs"
    >
      {label}
    </span>
  )
}
