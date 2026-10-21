/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  PREPARING_CLASS,
  REPORT_LINK_CLASS,
  REPORT_LINK_OUTLINE_CLASS,
  useReportRead,
  type ReportRead,
  type ReportStrings,
} from './report-read'
import type { ReactElement } from 'react'

/**
 * "Report on GitHub", drawn from a report read (`report-read.ts`): the link,
 * the reserved slot while the read is in flight, the blank issue offered when
 * the report could not be had, and the line under it all saying where the
 * link goes, what to do instead, or why there is no report.
 */

/** Whose report a notice offers: the words for "copy the id" name it. */
export type ReportSubject = 'request' | 'run'

/** lucide `external-link`, inline so the chunk carries no icon set. */
function ExternalLinkGlyph(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon="inline-end"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

/** lucide `loader-circle`, turning while the address is prepared. */
function SpinnerGlyph(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

/** A link to an address the server answered, opening GitHub in a new tab. */
function GitHubLink({
  url,
  label,
  strings,
  className,
  describedBy,
}: {
  readonly url: string
  readonly label: string
  readonly strings: ReportStrings
  readonly className: string
  readonly describedBy?: string
}): ReactElement {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-slot="button"
      aria-describedby={describedBy}
      className={className}
    >
      {label}
      <span className="sr-only"> {strings.opensInNewTab}</span>
      <ExternalLinkGlyph />
    </a>
  )
}

/**
 * The blank issue, offered when a failure's report could not be had: the
 * installation's own report, so the operator still lands on the bug form with
 * the facts a maintainer needs, and pastes the id they copied.
 */
function BlankIssueLink({
  strings,
  className,
}: {
  readonly strings: ReportStrings
  readonly className: string
}): ReactElement | null {
  const read = useReportRead('/api/admin/reports/installation')
  if (read.state !== 'ready') return null
  return (
    <GitHubLink
      url={read.url}
      label={strings.blankIssue}
      strings={strings}
      className={className}
    />
  )
}

/**
 * The link itself, the slot it holds while the read is in flight, or — when
 * the report could not be had and `fallback` is set — the blank issue. Nothing
 * on any other outcome: {@link ReportNote} carries those.
 */
export function ReportProblemLink({
  read,
  strings,
  hintId,
  label,
  variant = 'ghost',
  fallback = false,
}: {
  readonly read: ReportRead
  readonly strings: ReportStrings
  /** The id of the line describing where the link goes. */
  readonly hintId?: string
  /** The visible label, when it is not the plain "Report on GitHub". */
  readonly label?: string
  /** `ghost` beside a primary Retry (default); `outline` alone or beside an outline Retry. */
  readonly variant?: 'ghost' | 'outline'
  /** Offer the blank issue when the report could not be had. */
  readonly fallback?: boolean
}): ReactElement | null {
  const className = variant === 'outline' ? REPORT_LINK_OUTLINE_CLASS : REPORT_LINK_CLASS
  if (read.state === 'pending') {
    return (
      <span
        aria-disabled="true"
        data-report-pending="true"
        className={PREPARING_CLASS[variant]}
      >
        <SpinnerGlyph />
        {strings.preparing}
      </span>
    )
  }
  if (read.state === 'failed' && fallback) {
    return (
      <BlankIssueLink
        strings={strings}
        className={className}
      />
    )
  }
  if (read.state !== 'ready') return null
  return (
    <GitHubLink
      url={read.url}
      label={label ?? strings.problem}
      strings={strings}
      className={className}
      {...(hintId === undefined ? {} : { describedBy: hintId })}
    />
  )
}

/** The line under a failure's actions, by what its report read answered. */
const noteOf = (
  read: ReportRead,
  strings: ReportStrings,
  subject: ReportSubject
): { readonly text: string; readonly marker: Readonly<Record<string, string>> } | undefined => {
  switch (read.state) {
    case 'ready':
      return { text: strings.hint, marker: {} }
    case 'fix':
      return { text: strings.fix[read.fix], marker: { 'data-report-fix': read.fix } }
    case 'failed':
      return {
        text: subject === 'run' ? strings.unavailableRun : strings.unavailable,
        marker: { 'data-report-unavailable': 'true' },
      }
    case 'none':
      return {
        text: subject === 'run' ? strings.expiredRun : strings.expired,
        marker: { 'data-report-expired': 'true' },
      }
    case 'pending':
      return undefined
  }
}

/**
 * The line under a failure: where the link goes, what to do instead (a
 * failure the deployment can fix), that the report could not be prepared, or
 * that the error is no longer kept — never silence, so the link never just
 * vanishes.
 */
export function ReportNote({
  read,
  strings,
  id,
  subject = 'request',
}: {
  readonly read: ReportRead
  readonly strings: ReportStrings
  readonly id?: string
  readonly subject?: ReportSubject
}): ReactElement | null {
  const note = noteOf(read, strings, subject)
  if (note === undefined) return null
  return (
    <p
      id={read.state === 'ready' ? id : undefined}
      className={read.state === 'fix' ? 'text-foreground text-xs' : 'text-muted-foreground text-xs'}
      {...note.marker}
    >
      {note.text}
    </p>
  )
}
