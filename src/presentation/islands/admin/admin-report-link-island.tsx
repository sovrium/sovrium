/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useId, type ReactElement } from 'react'
import { ReportNote, ReportProblemLink } from '../parts/report-problem-link'
import {
  RETRY_BUTTON_CLASS,
  reportStringsOf,
  requestReportEndpoint,
  useReportRead,
  type ReportStrings,
} from '../parts/report-read'
import { CopyableId } from '../parts/reported-failure'
import { requestIdOf } from '../runtime/console-request-id'

/**
 * `admin-report-link` — the console's report links drawn from a plain
 * container (`data-island` + `data-island-props`), in three places:
 *
 *  - `{ runId }` — a run page's internal-error callout: "Report on GitHub"
 *    before the page's own Retry, and the line saying where it goes. The page
 *    shows the callout only for a run the engine stopped on an internal error
 *    (`failureKind: 'defect'`).
 *  - `{ runId, part: 'id' }` — the run id the report quotes, with its copy
 *    control, as a fact in the run page's header strip.
 *  - `{ source: 'installation' }` — the Report a problem page's blank report,
 *    prefilled with the installation's facts only. Always offered.
 *  - `{ source: 'request' }` — the console's 500 page: the request id the
 *    engine stamped on the error document, its report before Reload, and the
 *    note; a failure the deployment can fix shows its fix and no report.
 *  - `{ source: 'latest' }` — the same page's last kept internal error: its
 *    request id and its report, or a calm line when the server kept none, so
 *    the page never ends on a dead link.
 *
 * Every address is the server's, linked byte for byte; each read's other
 * outcomes are drawn as the failure notices draw them (a placeholder in flight,
 * a line when the report could not be prepared).
 */

/** The link, then the line saying where it goes. */
function LinkWithNote({
  endpoint,
  strings,
  label,
}: {
  readonly endpoint: string
  readonly strings: ReportStrings
  readonly label?: string
}): ReactElement {
  const read = useReportRead(endpoint)
  const hintId = useId()
  return (
    <div className="flex flex-col items-start gap-2">
      <ReportProblemLink
        read={read}
        strings={strings}
        hintId={hintId}
        variant="outline"
        {...(label === undefined ? {} : { label })}
      />
      <ReportNote
        read={read}
        strings={strings}
        id={hintId}
      />
    </div>
  )
}

/** The last kept internal error: its id and report, or a calm line when none was kept. */
function LatestError({ strings }: { readonly strings: ReportStrings }): ReactElement {
  const read = useReportRead('/api/admin/reports/latest')
  const hintId = useId()
  if (read.state === 'none') {
    return <p className="text-muted-foreground text-sm">{strings.noneKept}</p>
  }
  return (
    <div className="flex flex-col items-start gap-2">
      {read.state === 'ready' && read.requestId !== undefined && (
        <CopyableId
          id={read.requestId}
          label={strings.requestId}
          copyLabel={strings.copyRequestId}
          copiedLabel={strings.copied}
        />
      )}
      <ReportProblemLink
        read={read}
        strings={strings}
        hintId={hintId}
        variant="outline"
        label={strings.lastError}
      />
      <ReportNote
        read={read}
        strings={strings}
        id={hintId}
      />
    </div>
  )
}

/**
 * A run's report, drawn inside its callout's action row (the container is
 * `display: contents`): the link before the page's own Retry, and the note on
 * a line of its own under both.
 */
function RunReport({
  runId,
  strings,
}: {
  readonly runId: string
  readonly strings: ReportStrings
}): ReactElement {
  const read = useReportRead(`/api/admin/reports/runs/${encodeURIComponent(runId)}`)
  const hintId = useId()
  return (
    <>
      <ReportProblemLink
        read={read}
        strings={strings}
        hintId={hintId}
        variant="outline"
        fallback
      />
      <div className="order-last basis-full">
        <ReportNote
          read={read}
          strings={strings}
          id={hintId}
          subject="run"
        />
      </div>
    </>
  )
}

/**
 * The request id the engine stamped on the error document it rendered
 * (`<meta name="sovrium-request-id">`), when it is one `X-Request-Id` admits.
 */
const stampedRequestId = (): string | undefined =>
  requestIdOf(document.querySelector('meta[name="sovrium-request-id"]')?.getAttribute('content'))

/** The console 500 page's body: the id, the report before Reload, and the note. */
function PageFailureReport({ strings }: { readonly strings: ReportStrings }): ReactElement | null {
  const requestId = stampedRequestId()
  const read = useReportRead(requestId === undefined ? undefined : requestReportEndpoint(requestId))
  const hintId = useId()
  if (requestId === undefined) return null
  return (
    <>
      <div className="[&>p]:justify-center">
        <CopyableId
          id={requestId}
          label={strings.requestId}
          copyLabel={strings.copyRequestId}
          copiedLabel={strings.copied}
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <ReportProblemLink
          read={read}
          strings={strings}
          hintId={hintId}
          fallback
        />
        <button
          type="button"
          data-slot="button"
          className={RETRY_BUTTON_CLASS}
          onClick={() => window.location.reload()}
        >
          {strings.reload}
        </button>
      </div>
      <ReportNote
        read={read}
        strings={strings}
        id={hintId}
      />
    </>
  )
}

export default function AdminReportLinkIsland({
  runId,
  source,
  part,
  uiStrings,
}: {
  /** The run whose report is asked for (a run page's route parameter). */
  readonly runId?: string
  /** Which report of the Report a problem page this mount draws. */
  readonly source?: 'installation' | 'latest' | 'request'
  /** On a run page: `id` draws the run id fact with its copy control; otherwise the report. */
  readonly part?: 'id' | 'report'
  /** The words in the page language, where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>>
}): ReactElement | null {
  const strings = reportStringsOf(uiStrings)
  if (source === 'installation') {
    return (
      <LinkWithNote
        endpoint="/api/admin/reports/installation"
        strings={strings}
      />
    )
  }
  if (source === 'latest') return <LatestError strings={strings} />
  if (source === 'request') return <PageFailureReport strings={strings} />
  if (runId === undefined || runId === '') return null
  if (part === 'id') {
    return (
      <CopyableId
        id={runId}
        label={strings.runId}
        copyLabel={strings.copyRunId}
        copiedLabel={strings.copied}
        layout="stacked"
      />
    )
  }
  return (
    <RunReport
      runId={runId}
      strings={strings}
    />
  )
}
