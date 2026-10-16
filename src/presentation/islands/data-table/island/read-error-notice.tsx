/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useContext, useEffect } from 'react'
import { dispatch } from '../../runtime/event-bus'
import {
  isRateLimitedRead,
  isSessionEndedRead,
  RateLimitedNotice,
} from '../../runtime/read-failure'
import { GridStringsContext, useGridString } from './grid-strings'

/**
 * What the grid says when a records read failed.
 *
 * The STATUS chooses the sentence and the response body is never read for
 * display: a body names the server's internals (a stack frame, a pool name, a
 * raw envelope), which tells an operator nothing they can act on and tells an
 * attacker something. So:
 *
 *  - 401 — the session ended. The page cannot be read again until the reader
 *    signs in, so the grid announces it (`sovrium:session-ended`); a console
 *    shell answers by leaving for its sign-in page. The generic line stands
 *    meanwhile, so nothing raw is on screen for the frame before it leaves.
 *  - 429 — the shared rate-limit line, with its own Retry.
 *  - a refused SORT — names the column, because the sort was undone and the
 *    reader needs to know why the header went back.
 *  - anything else — "Couldn’t load records." with a Retry that reads again.
 */
function LoadFailedNotice({
  onRetry,
  sortColumnLabel,
}: {
  readonly onRetry: () => void
  readonly sortColumnLabel: string | undefined
}) {
  const loadFailed = useGridString('datatable.loadFailed', 'Couldn’t load records.')
  const sortFailed = useGridString('datatable.sortFailed', 'Couldn’t sort by {column}.', {
    column: sortColumnLabel ?? '',
  })
  const retry = useGridString('datatable.retry', 'Retry')
  return (
    <div
      role="alert"
      data-read-error="true"
      className="border-destructive/30 bg-destructive/5 text-foreground flex items-center justify-between gap-4 rounded-md border px-4 py-3 text-sm"
    >
      <p className="font-medium">{sortColumnLabel === undefined ? loadFailed : sortFailed}</p>
      {sortColumnLabel === undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="hover:bg-muted shrink-0 rounded-md border px-3 py-1 font-medium"
        >
          {retry}
        </button>
      )}
    </div>
  )
}

/** The read-failure notice above the grid, chosen by the failed read's status. */
export function ReadErrorNotice({
  error,
  onRetry,
  sortColumnLabel,
}: {
  readonly error: unknown
  readonly onRetry: () => void
  /** The label of the column whose refused sort this read undid, if it undid one. */
  readonly sortColumnLabel: string | undefined
}) {
  const strings = useContext(GridStringsContext)
  const sessionEnded = isSessionEndedRead(error)
  useEffect(() => {
    if (sessionEnded) {
      dispatch('sovrium:session-ended', {
        path: `${window.location.pathname}${window.location.search}`,
      })
    }
  }, [sessionEnded, error])
  if (isRateLimitedRead(error)) {
    return (
      <RateLimitedNotice
        onRetry={onRetry}
        strings={strings}
      />
    )
  }
  return (
    <LoadFailedNotice
      onRetry={onRetry}
      sortColumnLabel={sessionEnded ? undefined : sortColumnLabel}
    />
  )
}
