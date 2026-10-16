/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

/**
 * Non-chart timeline render states. None carries `data-component`: the
 * island host names the timeline once, whatever state is drawn inside it.
 *
 * The LOADING state draws no frame: the host's shell
 * (`TIMELINE_SHELL_CLASSES`) frames it — the same frame the records arrive
 * into, so the chrome never re-draws under them. The error / missing-binding /
 * empty states are semantic status surfaces on the `error` and `warning` tones,
 * and the host's shell steps out of the box around them: the neutral data-view
 * frame would make a misconfiguration look like a successfully-rendered
 * timeline that happens to be empty.
 */

/** The timeline's own words in the page language (`timeline.*`, `component.*`), where they differ from English. */
export type TimelineStrings = Readonly<Record<string, string>> | undefined

export function TimelineLoading({ strings }: { readonly strings: TimelineStrings }): ReactElement {
  return (
    <div
      data-timeline-state="loading"
      role="status"
      data-loading-status=""
      aria-label={strings?.['timeline.loading'] ?? 'Loading timeline...'}
    >
      <div className="bg-muted mb-3 h-4 w-40 animate-pulse rounded" />
      <div className="space-y-2">
        <div className="bg-muted h-6 w-3/4 animate-pulse rounded" />
        <div className="bg-muted h-6 w-1/2 animate-pulse rounded" />
        <div className="bg-muted h-6 w-2/3 animate-pulse rounded" />
      </div>
    </div>
  )
}

export function TimelineError({
  error,
  strings,
}: {
  readonly error: unknown
  readonly strings: TimelineStrings
}): ReactElement {
  return (
    <div
      className="border-error-border bg-error-bg text-error-fg text-md rounded border p-3"
      data-timeline-state="error"
      role="alert"
    >
      <p>
        {(strings?.['timeline.loadFailed'] ?? 'Failed to load timeline records: {error}').replace(
          '{error}',
          () => (error instanceof Error ? error.message : String(error))
        )}
      </p>
      <p className="mt-1 opacity-80">
        {strings?.['component.refreshToRetry'] ?? 'Refresh the page to try again.'}
      </p>
    </div>
  )
}

export function TimelineMissingTable({
  strings,
}: {
  readonly strings: TimelineStrings
}): ReactElement {
  return (
    <div
      className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3"
      data-timeline-state="missing-table"
      role="alert"
    >
      {strings?.['timeline.missingTable'] ?? 'data-timeline is missing a dataSource.table binding.'}
    </div>
  )
}

export function TimelineMissingStartField({
  strings,
}: {
  readonly strings: TimelineStrings
}): ReactElement {
  const [before, after] = (
    strings?.['timeline.missingStartField'] ??
    'data-timeline is missing a required {setting} binding.'
  ).split('{setting}')
  return (
    <div
      className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3"
      data-timeline-state="missing-start-field"
      role="alert"
    >
      {before}
      <code>startField</code>
      {after}
    </div>
  )
}

export function TimelineEmpty({
  message,
  strings,
}: {
  readonly message?: string
  readonly strings: TimelineStrings
}): ReactElement {
  return (
    <div
      className="border-border bg-muted text-muted-foreground text-md rounded border p-6 text-center"
      data-timeline-state="empty"
      role="status"
    >
      <p>{message ?? strings?.['timeline.empty'] ?? 'No records on the timeline yet.'}</p>
      {message === undefined && (
        <p className="mt-1 opacity-80">
          {strings?.['timeline.emptyHint'] ??
            'Records with a value in the configured date field will appear here.'}
        </p>
      )}
    </div>
  )
}
