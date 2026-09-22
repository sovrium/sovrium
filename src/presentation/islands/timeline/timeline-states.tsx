/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTimelineShellClasses } from '@/presentation/design/timeline-default-classes'
import type { ReactElement } from 'react'

/**
 * Non-chart timeline render states. Every state emits
 * `data-component="data-timeline"` so spec assertions on the canonical
 * timeline attribute resolve in every branch.
 *
 * The LOADING state shares the populated view's shell recipe
 * ({@link computeTimelineShellClasses}), so the frame the skeleton draws is the
 * frame the records arrive into and the chrome never re-draws under them. The
 * error / missing-binding / empty states deliberately do NOT: those are
 * semantic status surfaces on the `error` and `warning` tones, and giving them
 * the neutral data-view shell would make a misconfiguration look like a
 * successfully-rendered timeline that happens to be empty.
 */

export function TimelineLoading(): ReactElement {
  return (
    <div
      className={computeTimelineShellClasses()}
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
      className="border-error-border bg-error-bg text-error-fg text-md rounded border p-3"
      data-component="data-timeline"
      data-timeline-state="error"
      role="alert"
    >
      <p>
        Failed to load timeline records: {error instanceof Error ? error.message : String(error)}
      </p>
      <p className="mt-1 opacity-80">Refresh the page to try again.</p>
    </div>
  )
}

export function TimelineMissingTable(): ReactElement {
  return (
    <div
      className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3"
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
      className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3"
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
      className="border-border bg-background-subtle text-foreground-muted text-md rounded border p-6 text-center"
      data-component="data-timeline"
      data-timeline-state="empty"
      role="status"
    >
      <p>{message ?? 'No records on the timeline yet.'}</p>
      {message === undefined && (
        <p className="mt-1 opacity-80">
          Records with a value in the configured date field will appear here.
        </p>
      )}
    </div>
  )
}
