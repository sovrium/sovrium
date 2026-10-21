/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useId, useState, type ReactElement, type ReactNode } from 'react'
import { ReportNote, ReportProblemLink } from './report-problem-link'
import {
  COPY_BUTTON_CLASS,
  requestReportEndpoint,
  useReportRead,
  type ReportStrings,
} from './report-read'

/**
 * One failure anatomy for every console read and write the server answered
 * with an internal error: the sentence, the request id it was answered under
 * (with a copy control), the report link when the server kept a report, and
 * the recovery action — drawn the same on a grid, a list, a card or a drawer.
 *
 * Only the sentence is the alert. The report link arrives after its own read,
 * so an alert spanning the whole notice would be announced before its action
 * existed; the sentence is what a screen reader needs to hear at once, and
 * every control after it is reached in tab order — the report first, the
 * Retry last, as the primary action.
 *
 * Text, then actions, then the note, always stacked: at phone width the
 * sentence and the id get the full line instead of a sliver beside the
 * buttons, and at desktop width the actions sit where the eye ends.
 */

/** lucide `copy`, then `check` once copied — inline for the same reason. */
function CopyGlyph({ copied }: { readonly copied: boolean }): ReactElement {
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
    >
      {copied ? (
        <path d="M20 6 9 17l-5-5" />
      ) : (
        <>
          <rect
            width="14"
            height="14"
            x="8"
            y="8"
            rx="2"
            ry="2"
          />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </>
      )}
    </svg>
  )
}

/** True for two seconds after `flip` is called: the copy control's feedback. */
function useCopiedFlag(): readonly [boolean, () => void] {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return [copied, () => setCopied(true)]
}

/** The id line's classes, inline under a sentence or stacked as a header fact. */
const ID_LAYOUT = {
  inline: {
    line: 'text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs',
    label: undefined,
    id: 'text-foreground font-mono break-all',
  },
  stacked: {
    line: 'flex min-w-0 flex-col gap-0.5',
    label: 'text-muted-foreground text-xs',
    id: 'text-foreground font-mono text-sm break-all',
  },
} as const

/**
 * "<label> <id> [copy]": an id a report quotes — a request's, a run's — stays
 * useful with or without a report (an operator quotes it, or finds it in the
 * server logs), so it always carries its copy control.
 */
export function CopyableId({
  id,
  label,
  copyLabel,
  copiedLabel,
  layout = 'inline',
}: {
  readonly id: string
  /** "Request ID", "Run ID". */
  readonly label: string
  /** The copy control's accessible name. */
  readonly copyLabel: string
  /** Announced once the id is on the clipboard. */
  readonly copiedLabel: string
  /** `stacked` draws the label above the id, as a fact in a header strip. */
  readonly layout?: 'inline' | 'stacked'
}): ReactElement {
  const [copied, flip] = useCopiedFlag()
  const copy = () => {
    void navigator.clipboard
      ?.writeText(id)
      .then(flip)
      .catch(() => undefined)
  }
  return (
    <p className={ID_LAYOUT[layout].line}>
      <span className={ID_LAYOUT[layout].label}>{label}</span>
      <span className="inline-flex min-w-0 items-center gap-1">
        <code className={ID_LAYOUT[layout].id}>{id}</code>
        <button
          type="button"
          onClick={copy}
          aria-label={copyLabel}
          data-slot="button"
          data-copied={copied ? 'true' : undefined}
          className={COPY_BUTTON_CLASS}
        >
          <CopyGlyph copied={copied} />
        </button>
      </span>
      <span
        role="status"
        className="sr-only"
      >
        {copied ? copiedLabel : ''}
      </span>
    </p>
  )
}

/**
 * shadcn's destructive Alert, as the console draws every failure notice: the
 * icon in its own column, the title and the description beside it.
 */
export const FAILURE_ALERT_CLASS =
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border bg-card px-4 py-3 text-left text-sm text-destructive has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4"

/** lucide `circle-alert`, the destructive Alert's icon. */
export function AlertGlyph(): ReactElement {
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
    >
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <line
        x1="12"
        x2="12"
        y1="8"
        y2="12"
      />
      <line
        x1="12"
        x2="12.01"
        y1="16"
        y2="16"
      />
    </svg>
  )
}

/**
 * The title and description of a server error answered under a request id,
 * inside a {@link FAILURE_ALERT_CLASS} alert: what failed, that it was
 * Sovrium's, the request id, then the report link before the recovery, then
 * the line saying where the link goes (or what to do instead).
 */
export function ReportedFailure({
  sentence,
  requestId,
  strings,
  actions,
  detail,
}: {
  /** What failed, in one sentence. */
  readonly sentence: string
  /** The request the error was answered under. */
  readonly requestId: string
  readonly strings: ReportStrings
  /** The recovery actions (a Retry), drawn after the report link. */
  readonly actions?: ReactNode
  /**
   * The line under the sentence: what happened and what to do — the read
   * failure's by default, `null` for none (a write's sentence says it).
   */
  readonly detail?: string | null
}): ReactElement {
  const read = useReportRead(requestReportEndpoint(requestId))
  const hintId = useId()
  return (
    <>
      <p
        role="alert"
        data-slot="alert-title"
        className="text-destructive col-start-2 font-medium tracking-tight"
      >
        {sentence}
      </p>
      <div
        data-slot="alert-description"
        className="text-muted-foreground col-start-2 flex flex-col gap-1 text-sm"
      >
        {detail !== null && read.state !== 'fix' && <p>{detail ?? strings.readFailed}</p>}
        <CopyableId
          id={requestId}
          label={strings.requestId}
          copyLabel={strings.copyRequestId}
          copiedLabel={strings.copied}
        />
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <ReportProblemLink
            read={read}
            strings={strings}
            hintId={hintId}
            fallback
          />
          {actions}
        </div>
        <ReportNote
          read={read}
          strings={strings}
          id={hintId}
        />
      </div>
    </>
  )
}
