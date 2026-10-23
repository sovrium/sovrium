/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useContext, useEffect } from 'react'
import { RETRY_BUTTON_CLASS, reportStringsOf } from '../../parts/report-read'
import { AlertGlyph, FAILURE_ALERT_CLASS, ReportedFailure } from '../../parts/reported-failure'
import { dispatch } from '../../runtime/event-bus'
import {
  isMalformedRead,
  isNotFoundRead,
  isRateLimitedRead,
  isSessionEndedRead,
  RateLimitedNotice,
} from '../../runtime/read-failure'
import { consoleRequestIdOfRead } from '../read-failure-request'
import { GridStringsContext, useGridString } from './grid-strings'

/** The notice's sentence: the refused sort's, else the table's failed or missing read. */
function useFailureSentence(
  sortColumnLabel: string | undefined,
  named: { readonly loadFailed: string; readonly notFound: string } | undefined,
  notFound: boolean
): string {
  const genericFailed = useGridString('datatable.loadFailed', 'Couldn’t load records.')
  const genericNotFound = useGridString('datatable.notFound', 'These records aren’t available.')
  const sortFailed = useGridString('datatable.sortFailed', 'Couldn’t sort by {column}.', {
    column: sortColumnLabel ?? '',
  })
  if (sortColumnLabel !== undefined) return sortFailed
  return notFound ? (named?.notFound ?? genericNotFound) : (named?.loadFailed ?? genericFailed)
}

/**
 * The notice's one action: Retry, or — for a malformed read (400), which the
 * same request cannot change — Clear search while a search narrows the grid,
 * and nothing otherwise.
 */
function useNoticeAction(
  onRetry: () => void,
  onClearSearch: (() => void) | false | undefined
): { readonly label: string; readonly onClick: () => void } | undefined {
  const retry = useGridString('datatable.retry', 'Retry')
  const clearSearch = useGridString('datatable.clearSearch', 'Clear search')
  if (onClearSearch === false) return { label: retry, onClick: onRetry }
  return onClearSearch && { label: clearSearch, onClick: onClearSearch }
}

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
 *  - 404 — the table is not there for this reader. Asking again cannot change
 *    that, so the sentence says so and no Retry is offered.
 *  - 400 — the server refused the reader's own search, filter or sort as
 *    malformed. The same request would be refused again, so there is no Retry;
 *    while a search narrows the grid, "Clear search" takes it out instead.
 *  - a refused SORT — names the column, because the sort was undone and the
 *    reader needs to know why the header went back.
 *  - anything else — "Couldn’t load <table>." with a Retry that reads again.
 *    On the console, a server error whose body named the request it was
 *    answered under is drawn as a {@link ReportedFailure}: that id with its
 *    copy control, and "Report on GitHub", the prefilled bug report the
 *    server answers for it, before the Retry.
 *
 * A grid bound to a table names it (`tableReadFailure`, worded server-side):
 * on a page that may show any of an app's tables, "records" says nothing
 * about which read failed.
 */
function LoadFailedNotice({
  onRetry,
  sortColumnLabel,
  named,
  notFound,
  requestId,
  onClearSearch,
}: {
  readonly onRetry: () => void
  readonly sortColumnLabel: string | undefined
  readonly named: { readonly loadFailed: string; readonly notFound: string } | undefined
  readonly notFound: boolean
  /** The request a console's server error was answered under, when it named one. */
  readonly requestId: string | undefined
  readonly onClearSearch: (() => void) | false | undefined
}) {
  const failure = useFailureSentence(sortColumnLabel, named, notFound)
  const strings = useContext(GridStringsContext)
  const action = useNoticeAction(onRetry, onClearSearch)
  const retryButton = sortColumnLabel === undefined && !notFound && action !== undefined && (
    <button
      type="button"
      onClick={action.onClick}
      data-slot="button"
      className={RETRY_BUTTON_CLASS}
    >
      {action.label}
    </button>
  )
  const reported = requestId !== undefined && sortColumnLabel === undefined
  return (
    <div
      role={reported ? undefined : 'alert'}
      data-slot="alert"
      data-variant="destructive"
      data-read-error="true"
      className={FAILURE_ALERT_CLASS}
    >
      <AlertGlyph />
      {reported ? (
        <ReportedFailure
          sentence={failure}
          requestId={requestId}
          strings={reportStringsOf(strings)}
          actions={retryButton}
        />
      ) : (
        <>
          <p
            data-slot="alert-title"
            className="text-destructive col-start-2 font-medium tracking-tight"
          >
            {failure}
          </p>
          {retryButton !== false && <div className="col-start-2 flex pt-2">{retryButton}</div>}
        </>
      )}
    </div>
  )
}

/** The read-failure notice above the grid, chosen by the failed read's status. */
export function ReadErrorNotice({
  error,
  onRetry,
  sortColumnLabel,
  named,
  onClearSearch,
}: {
  readonly error: unknown
  readonly onRetry: () => void
  /** The label of the column whose refused sort this read undid, if it undid one. */
  readonly sortColumnLabel: string | undefined
  /** The table-naming sentences of a grid bound to a table. */
  readonly named?: { readonly loadFailed: string; readonly notFound: string } | undefined
  /** Takes the search narrowing the grid out, when one does. */
  readonly onClearSearch?: () => void
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
      named={named}
      notFound={isNotFoundRead(error)}
      requestId={consoleRequestIdOfRead(error)}
      onClearSearch={isMalformedRead(error) && onClearSearch}
    />
  )
}
