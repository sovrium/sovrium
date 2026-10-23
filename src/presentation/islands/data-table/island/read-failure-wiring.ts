/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isMalformedRead } from '../../runtime/read-failure'
import { clearSearchOn } from '../../runtime/search-input-publisher'

/**
 * What a failed read changes below the notice. A read refused as malformed
 * (400) answers a question the reader is no longer shown the answer to, so the
 * pager stops counting the rows of the read before it; and while a search on
 * the grid's channel narrows it, the notice offers to clear that search — which
 * takes the notice down with it, the question having changed.
 */
export function readFailureWiring(input: {
  readonly error: unknown
  readonly isError: boolean
  readonly rowCount: number
  readonly total: number
  readonly channel: string | undefined
  readonly searching: boolean
  readonly clearReadError: () => void
}) {
  const malformed = input.error !== undefined && isMalformedRead(input.error)
  const { channel } = input
  const failed = input.isError || input.error !== undefined
  return {
    /** The read failed before any row arrived: nothing to say about the data. */
    failedEmpty: input.error !== undefined && input.rowCount === 0,
    totalRecords: malformed ? 0 : input.total,
    unanswered: malformed || (failed && input.rowCount === 0),
    clear:
      input.searching && channel !== undefined
        ? {
            onClearSearch: () => {
              clearSearchOn(channel)
              input.clearReadError()
            },
          }
        : {},
  }
}
