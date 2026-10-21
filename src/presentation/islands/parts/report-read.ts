/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { requestIdOf } from '../runtime/console-request-id'

/**
 * The report read behind "Report on GitHub" — the console's link to the prefilled bug report the
 * SERVER answers for a failure that is the engine's fault — an internal error
 * answered under a request id, or a run the engine closed as a defect — and
 * the line saying where it goes, and the states of the report read itself.
 * The link is drawn by `report-problem-link.tsx`; the request id and the
 * composed notice by `reported-failure.tsx`.
 *
 * The console never builds the address. It asks the report read
 * (`/api/admin/reports/requests/:id`, `/api/admin/reports/runs/:id`) and links
 * what it answers, byte for byte. The read has five outcomes, and each one is
 * drawn rather than guessed:
 *
 *  - in flight — a quiet placeholder the size of the link, so nothing shifts
 *    when the answer lands;
 *  - an address — the link, with the line saying it opens a public issue and
 *    sends nothing until the reader submits it;
 *  - a 404 — there is nothing to report (a request or a run the server kept
 *    nothing under, or a failure that is not the engine's): nothing is drawn;
 *  - `{ fix }` — the failure is one the deployment can fix (a missing table,
 *    an unset variable, an unreachable database): no report is offered, and
 *    the line says what to do instead;
 *  - anything else (a dropped connection, a server error) — the report exists
 *    but could not be had, so a muted line says so and points at the request
 *    id, which the reader can still copy.
 *
 * The address is checked before it becomes an `href`: it must be a new-issue
 * address of Sovrium's own tracker, or it counts as a read that failed.
 */

/**
 * The causes a deployment can fix on its own, which the request read answers
 * as `{ fix }` instead of a report address (the server's `OperatorFix`,
 * `domain/errors/operator-fixable-error.ts`). Spelled here so the client
 * bundle does not import a server module; a code it does not know reads as a
 * failed read.
 */
const OPERATOR_FIX_CODES = [
  'missing-env',
  'invalid-env',
  'database-schema-drift',
  'database-unreachable',
  'database-resources',
] as const

/** One code the console words what to do for. */
export type OperatorFixCode = (typeof OPERATOR_FIX_CODES)[number]

const fixCodeOf = (body: unknown): OperatorFixCode | undefined => {
  const fix = (body as { readonly fix?: unknown } | null | undefined)?.fix
  return OPERATOR_FIX_CODES.find((code) => code === fix)
}

/** What a report read answered, as the parts around the link draw it. */
export type ReportRead =
  | { readonly state: 'pending' }
  | { readonly state: 'ready'; readonly url: string; readonly requestId?: string }
  | { readonly state: 'none' }
  | { readonly state: 'failed' }
  | { readonly state: 'fix'; readonly fix: OperatorFixCode }

/**
 * The English the report parts are written in, keyed by their catalogue word
 * (`report.<word>`, `report.fix.<code>`); a page sends only what differs.
 */
const REPORT_WORDS_EN = {
  /** The link's visible label (catalogue key `report.problem`). */
  problem: 'Report on GitHub',
  /** Read after the label by a screen reader: the link leaves the console. */
  opensInNewTab: '(opens GitHub in a new tab)',
  /** Under a drawn link: where it goes, and that nothing is sent yet. */
  hint: 'Opens a prefilled GitHub issue — nothing is sent until you submit it; review it first.',
  /** The read-failure notice's second line, when the server kept a report. */
  readFailed:
    'Sovrium hit an internal error while reading it. Retry; if it fails again, report it so it gets fixed.',
  /** The link's reserved slot while the read is in flight. */
  preparing: 'Preparing the report…',
  /** A request's report could not be had (a failed read). */
  unavailable:
    'Couldn’t prepare the report. Copy the request ID and include it when you open an issue.',
  /** A run's report could not be had. */
  unavailableRun: 'Couldn’t prepare the report. Copy the run ID and add it to an issue on GitHub.',
  /** The blank issue offered when a report could not be had. */
  blankIssue: 'Open a blank issue',
  /** A request's error is no longer kept (the read answered 404). */
  expired:
    'This error is no longer kept on the server, so the report can’t be prefilled. Copy the request ID; the server log still has it.',
  /** A run's error is no longer kept. */
  expiredRun:
    'This run’s error details are no longer kept, so it can’t be reported from here. Copy the run ID instead.',
  requestId: 'Request ID',
  copyRequestId: 'Copy request ID',
  runId: 'Run ID',
  copyRunId: 'Copy run ID',
  /** Announced once an id is on the clipboard. */
  copied: 'Copied',
  /** The console 500 page's recovery. */
  reload: 'Reload',
  /** The Report a problem page's last-error link. */
  lastError: 'Report the last internal error',
  /** The same page, when the server kept no internal error. */
  noneKept:
    'No internal error has been kept. If something looks wrong, describe it in a new report.',
} as const

/** What to do, for a failure the deployment can fix: no report is offered. */
const REPORT_FIXES_EN: Readonly<Record<OperatorFixCode, string>> = {
  'missing-env':
    'A required environment variable isn’t set. Set it in the instance environment, then restart.',
  'invalid-env':
    'An environment variable has a value Sovrium can’t use. Correct it in the instance environment, then restart.',
  'database-schema-drift':
    'A table this app declares is missing from the database. Restore it, or restart Sovrium so it migrates the schema, then reload.',
  'database-unreachable':
    'The database can’t be reached. Check that it’s running and that DATABASE_URL is right, then reload.',
  'database-resources':
    'The database ran out of room. Free disk space or connections, or fix the permissions of the database file.',
}

/** The words of the report parts, in the page language. */
export type ReportStrings = Readonly<Record<keyof typeof REPORT_WORDS_EN, string>> & {
  readonly fix: Readonly<Record<OperatorFixCode, string>>
}

/** The report words from a page's `report.*` overrides, English where it sent none. */
export const reportStringsOf = (
  lookup: Readonly<Record<string, string>> | undefined
): ReportStrings => {
  const words = Object.fromEntries(
    Object.entries(REPORT_WORDS_EN).map(([word, english]) => [
      word,
      lookup?.[`report.${word}`] ?? english,
    ])
  ) as Record<keyof typeof REPORT_WORDS_EN, string>
  const fix = Object.fromEntries(
    OPERATOR_FIX_CODES.map((code) => [
      code,
      lookup?.[`report.fix.${code}`] ?? REPORT_FIXES_EN[code],
    ])
  ) as Record<OperatorFixCode, string>
  return { ...words, fix }
}

/**
 * The buttons of a failure notice, as base-nova's `buttonVariants` draws them
 * (`presentation/design/button-variant-classes.ts`). Spelled here rather than
 * composed from that module: every grid mounts this notice, and importing the
 * variant table moves it into a chunk other islands pay for at mount.
 *
 * Beside a Retry the report link is the ghost button and the Retry the primary
 * one, so recovery is the heavier action; where no Retry sits beside it (the
 * Report a problem page) or beside an outline Retry (a run's callout), the
 * link is the outline button at `sm`.
 */
const BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center gap-1 border bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 no-underline'

const SIZE_DEFAULT =
  "h-8 gap-1.5 rounded-lg px-2.5 text-sm has-data-[icon=inline-end]:pr-2 [&_svg:not([class*='size-'])]:size-4"

const SIZE_SM =
  "h-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 [&_svg:not([class*='size-'])]:size-3.5"

const GHOST =
  'border-transparent text-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50'

const OUTLINE =
  'border-border bg-background text-foreground hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50'

/** The Retry beside a report link: the primary button — the recovery, drawn last. */
export const RETRY_BUTTON_CLASS = `${BUTTON_BASE} ${SIZE_DEFAULT} border-transparent bg-primary text-primary-foreground hover:bg-primary/80`

/** The report link beside a primary Retry: ghost, lighter than the recovery. */
export const REPORT_LINK_CLASS = `${BUTTON_BASE} ${SIZE_DEFAULT} ${GHOST}`

/** The report link where it stands alone or beside an outline Retry: outline at `sm`. */
export const REPORT_LINK_OUTLINE_CLASS = `${BUTTON_BASE} ${SIZE_SM} ${OUTLINE}`

/** The reserved slot while the read is in flight, at either weight. */
export const PREPARING_CLASS = {
  ghost: `${BUTTON_BASE} ${SIZE_DEFAULT} ${GHOST} pointer-events-none opacity-50`,
  outline: `${BUTTON_BASE} ${SIZE_SM} ${OUTLINE} pointer-events-none opacity-50`,
} as const

/** The copy control beside an id: ghost at `icon-xs`. */
export const COPY_BUTTON_CLASS = `${BUTTON_BASE} size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3 ${GHOST} text-muted-foreground`

/**
 * The answered address, when it is one of the bug form's; `null` for anything
 * else. The prefix is the server builder's `ISSUES_NEW_URL`
 * (`domain/kernel/url/issue-report-url.ts`), spelled here so the client bundle
 * does not pull that module into a chunk the other islands share.
 */
const reportAddressOf = (body: unknown): string | null => {
  const url = (body as { readonly url?: unknown } | null | undefined)?.url
  return typeof url === 'string' && url.startsWith('https://github.com/sovrium/sovrium/issues/new?')
    ? url
    : null
}

/** Ask a report read for its address: `'none'` on a 404, `'failed'` on any other miss. */
const readReportAddress = async (endpoint: string): Promise<ReportRead> => {
  const response = await fetch(endpoint, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (response.status === 404) return { state: 'none' }
  if (!response.ok) return { state: 'failed' }
  const body: unknown = await response.json().catch(() => undefined)
  const fix = fixCodeOf(body)
  if (fix !== undefined) return { state: 'fix', fix }
  const url = reportAddressOf(body)
  if (url === null) return { state: 'failed' }
  const requestId = requestIdOf((body as { readonly requestId?: unknown }).requestId)
  return requestId === undefined ? { state: 'ready', url } : { state: 'ready', url, requestId }
}

/** The report read of an internal error answered under `requestId`. */
export const requestReportEndpoint = (requestId: string): string =>
  `/api/admin/reports/requests/${encodeURIComponent(requestId)}`

/** One failure's report read; an `undefined` endpoint means there is none to ask. */
export function useReportRead(endpoint: string | undefined): ReportRead {
  const { data, isError } = useQuery({
    queryKey: ['report-address', endpoint],
    queryFn: () => readReportAddress(endpoint ?? ''),
    enabled: endpoint !== undefined,
    retry: false,
    staleTime: Infinity,
  })
  if (endpoint === undefined) return { state: 'none' }
  if (isError) return { state: 'failed' }
  return data ?? { state: 'pending' }
}
