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
import { ViewError, ViewLoading, ViewMissing, type ViewStrings } from '../parts/view-states'
import type { ReactElement } from 'react'

/**
 * What the kanban board draws INSTEAD of itself: its loading skeleton here,
 * and its failure and missing grouping through the shared view states, in
 * the board's own English.
 */

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
export function KanbanLoading({ strings }: { readonly strings: ViewStrings }): ReactElement {
  return (
    <ViewLoading
      className={computeKanbanBoardClasses()}
      label={strings?.['kanban.loading'] ?? 'Loading kanban board...'}
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
    </ViewLoading>
  )
}

/** The board's English for the shared view states. */
const WORDS = {
  'kanban.loadFailed': 'Failed to load kanban records: {error}',
  'kanban.missingGroupBy': 'Kanban board is missing required {setting} configuration.',
} as const

/** The board's failed read. */
export function KanbanFailure({
  error,
  strings,
}: {
  readonly error: unknown
  readonly strings: ViewStrings
}): ReactElement {
  return (
    <ViewError
      of="kanban"
      words={WORDS}
      error={error}
      strings={strings}
    />
  )
}

/** A board with no `kanbanGroupBy`: it names the setting and how to add it. */
export function MissingGroupBy({ strings }: { readonly strings: ViewStrings }): ReactElement {
  return (
    <ViewMissing
      sentence="kanban.missingGroupBy"
      setting="kanbanGroupBy.field"
      hint
      words={WORDS}
      strings={strings}
    />
  )
}
