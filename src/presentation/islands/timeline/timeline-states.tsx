/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'


export function TimelineLoading(): ReactElement {
  return (
    <div
      className="border-border bg-background-raised w-full rounded-lg border p-4"
      data-component="data-timeline"
      data-timeline-state="loading"
      role="status"
      aria-label="Loading timeline..."
    >
      <div className="bg-background-subtle mb-3 h-4 w-40 animate-pulse rounded" />
      <div className="space-y-2">
        <div className="bg-background-subtle h-6 w-3/4 animate-pulse rounded" />
        <div className="bg-background-subtle h-6 w-1/2 animate-pulse rounded" />
        <div className="bg-background-subtle h-6 w-2/3 animate-pulse rounded" />
      </div>
    </div>
  )
}

export function TimelineError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="border-error-border bg-error-bg text-error-fg rounded border p-3 text-sm"
      data-component="data-timeline"
      data-timeline-state="error"
      role="alert"
    >
      Failed to load timeline records: {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

export function TimelineMissingTable(): ReactElement {
  return (
    <div
      className="border-warning-border bg-warning-bg text-warning-fg rounded border p-3 text-sm"
      data-component="data-timeline"
      data-timeline-state="missing-table"
      role="alert"
    >
      data-timeline is missing a dataSource.table binding.
    </div>
  )
}

export function TimelineMissingStartField(): ReactElement {
  return (
    <div
      className="border-warning-border bg-warning-bg text-warning-fg rounded border p-3 text-sm"
      data-component="data-timeline"
      data-timeline-state="missing-start-field"
      role="alert"
    >
      data-timeline is missing a required <code>startField</code> binding.
    </div>
  )
}

export function TimelineEmpty({ message }: { readonly message?: string }): ReactElement {
  return (
    <div
      className="border-border bg-background-subtle text-foreground-muted rounded border p-6 text-center text-sm"
      data-component="data-timeline"
      data-timeline-state="empty"
      role="status"
    >
      {message ?? 'No records to display on the timeline.'}
    </div>
  )
}
