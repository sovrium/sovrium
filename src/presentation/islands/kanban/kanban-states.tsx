/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

export function KanbanMissingGroupBy(): ReactElement {
  return (
    <div className="border-warning-border bg-warning-bg text-warning-fg rounded border p-3 text-sm">
      Kanban board is missing required <code>kanbanGroupBy.field</code> configuration.
    </div>
  )
}

export function KanbanLoading(): ReactElement {
  return (
    <div
      className="flex w-full gap-4 overflow-x-auto p-2"
      aria-label="Loading kanban board..."
      role="status"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`kanban-loading-col-${String(i)}`}
          className="border-border bg-bg-subtle flex w-72 shrink-0 flex-col gap-2 rounded-lg border p-3"
        >
          <div className="bg-bg-subtle h-5 w-24 animate-pulse rounded" />
          <div className="bg-bg-raised h-20 animate-pulse rounded" />
        </div>
      ))}
    </div>
  )
}

export function KanbanError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="border-error-border bg-error-bg text-error-fg rounded border p-3 text-sm"
      role="alert"
    >
      Failed to load kanban records: {error instanceof Error ? error.message : String(error)}
    </div>
  )
}
