/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

export function KanbanMissingGroupBy(): ReactElement {
  return (
    <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
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
          className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-20 animate-pulse rounded bg-white" />
        </div>
      ))}
    </div>
  )
}

export function KanbanError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
      role="alert"
    >
      Failed to load kanban records: {error instanceof Error ? error.message : String(error)}
    </div>
  )
}
