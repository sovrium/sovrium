/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useDragPermission } from './use-drag-permission'
import type { KanbanIslandProps } from './kanban-island'
import type { KanbanDrag } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'

/**
 * Whether a board's cards may be picked up, and whether a drop may be
 * written back to the table — two legs gated separately.
 */

/**
 * Resolve whether a DROP MAY BE WRITTEN BACK.
 *
 * Persistence is enabled when the schema configures `drag` AND `enabled !==
 * false` (`enabled` defaults to true when omitted per the schema docstring) —
 * but NEVER for a system source: a system source is READ-ONLY (there is no
 * records table to persist a drop to), so DB-table-only writes are gated off
 * regardless of any `drag` config. Column grouping (a read-side op over the
 * envelope) stays.
 *
 * Extracted from `KanbanIsland` so the composition root stays under the
 * cyclomatic-complexity cap (mirrors the gallery island's helper extraction).
 */
function resolvePersistEnabled(isSystemSource: boolean, drag: KanbanDrag | undefined): boolean {
  return !isSystemSource && Boolean(drag) && drag?.enabled !== false
}

/**
 * Resolve whether A CARD MAY BE PICKED UP — the gesture, not the write.
 *
 * These were ONE flag until it was noticed that gating the gesture on the write
 * leaves a read-only board announcing a drag it refuses to perform: `DndContext`
 * still mounts its screen-reader description regions, so an assistive-technology
 * user is told to press the space bar to pick up a card that no `useSortable`
 * will answer. Telling a reader to do something impossible is worse than saying
 * nothing.
 *
 * So the two legs separate on what a drop DOES rather than on where the rows
 * came from. A board that can write needs `drag` declared, exactly as before. A
 * board bound to a read-only system source can only ever reorder in the
 * reader's own browser — there is no table to write to, so there is nothing for
 * a `drag` block to authorise and nothing a permission could protect. The
 * gesture is therefore on there by default, and `drag.enabled: false` is still
 * the one way an author switches it off, in either mode.
 *
 * Nothing survives the reader closing the tab: the reorder lives in
 * `localRecords`, and the next load re-reads the endpoint.
 */
function resolveLocalDragEnabled(isSystemSource: boolean, drag: KanbanDrag | undefined): boolean {
  if (drag?.enabled === false) return false
  return isSystemSource || Boolean(drag)
}

/** What a board may do with a drag: make the gesture, and keep its result. */
interface KanbanDragGate {
  /** A card may be picked up. */
  readonly draggableEnabled: boolean
  /** A settled drop may be written back to a table. */
  readonly persistEnabled: boolean
}

/**
 * Resolve both drag legs, including the permission probe the write leg needs.
 *
 * The probe is keyed on PERSISTENCE rather than on the gesture, and that is
 * load-bearing in the read-only direction: a drag that writes nothing needs no
 * write permission, and asking for one would fail CLOSED. The permissions query
 * is disabled without a `tableName`, a disabled TanStack query reports
 * `pending`, and `resolveDragPermission` reads pending as unresolved and
 * refuses — so a board with nothing to protect would have been protected hardest.
 *
 * BOTH axis fields are gated on the write leg, not just the first: a drop on a
 * two-axis board can write either field, so a reader who may set `status` but
 * not `team` must not be handed a board whose vertical drags fail at the API.
 *
 * `persistEnabled` implies `draggableEnabled`, which is why the composition
 * below is a choice between the two gates rather than a conjunction of them.
 *
 * Its own hook so the composition root stays inside the per-function line cap,
 * the reason `useBoardRecords` above is one too.
 */
export function useKanbanDragGate(
  dataSource: KanbanIslandProps['dataSource'],
  drag: KanbanDrag | undefined,
  writeFields: readonly (string | undefined)[]
): KanbanDragGate {
  const isSystemSource = Boolean(dataSource?.system)
  const persistEnabled = resolvePersistEnabled(isSystemSource, drag)
  const localDragEnabled = resolveLocalDragEnabled(isSystemSource, drag)
  const { canDrag } = useDragPermission(dataSource?.table, writeFields, persistEnabled)
  return { draggableEnabled: persistEnabled ? canDrag : localDragEnabled, persistEnabled }
}
