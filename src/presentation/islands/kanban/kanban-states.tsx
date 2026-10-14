/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeKanbanBoardClasses,
  computeKanbanColumnClasses,
} from '@/presentation/design/kanban-default-classes'
import type { ReactElement } from 'react'

export function KanbanMissingGroupBy(): ReactElement {
  return (
    <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
      <p>
        Kanban board is missing required <code>kanbanGroupBy.field</code> configuration.
      </p>
      <p className="mt-1 opacity-80">Add it to this component in your app config, then redeploy.</p>
    </div>
  )
}

/**
 * The kanban board's loading state.
 *
 * Board and column chrome come from the SAME recipes the hydrated board uses,
 * so the columns do not re-draw at the moment the records arrive: the pulsing
 * bars are replaced inside wells whose fill, radius, padding and gutter never
 * move. The skeleton bar tone changes with them — a `bg-muted` bar
 * on a `bg-muted` well was invisible, which is what made the
 * loading board look like three empty boxes.
 */
export function KanbanLoading(): ReactElement {
  return (
    <div
      className={computeKanbanBoardClasses()}
      aria-label="Loading kanban board..."
      role="status"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`kanban-loading-col-${String(i)}`}
          className={`${computeKanbanColumnClasses()} w-72 shrink-0`}
        >
          <div
            data-slot="skeleton"
            className="bg-background h-4 w-24 animate-pulse rounded-md"
          />
          <div
            data-slot="skeleton"
            className="bg-card ring-foreground/10 h-20 animate-pulse rounded-xl ring-1"
          />
        </div>
      ))}
    </div>
  )
}

export function KanbanError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm"
      role="alert"
    >
      <p>Failed to load kanban records: {error instanceof Error ? error.message : String(error)}</p>
      <p className="mt-1 opacity-80">Refresh the page to try again.</p>
    </div>
  )
}
