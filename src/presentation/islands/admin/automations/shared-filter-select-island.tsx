/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared-filter PUBLISHER for the CONVERTED automation-runs directory
 *: the config expression of
 * the previously bespoke `admin-automation-runs-filters` event-bus island.
 *
 * The run-history LIST is a config `data-table` bound by `dataSource.system` to
 * `GET /api/admin/automations/runs`. The two server-side filters
 * ("Filter by automation" / "Filter by status") live OUTSIDE the
 * data-table toolbar (they are domain-specific dropdowns, not the generic
 * field-filter overlay). This island is now a config shared-filter PUBLISHER: it
 * publishes its combined `{ automationName, status }` selection on the shared
 * `island:system-query` bus tagged with its OWN `sourceId` (the publisher id),
 * and the grid declares `dataSource.system.bindTo: <publisher id>` +
 * `sharedFilter` so the runtime subscribes it to this publisher and re-reads with
 * the params merged (`?automationName=` / `?status=`). The grid↔filter coupling
 * is now config (`bindTo` + `sharedFilter`), not the bespoke grid-id wiring.
 *
 * Reuses the existing combobox sub-components (`AutomationFilter` /
 * `StatusFilter`).
 */

import { useCallback, useState, type ReactElement } from 'react'
import { AutomationFilter, StatusFilter } from './admin-automation-runs-list'

interface SharedFilterSelectIslandProps {
  /** This publisher's id — the value a subscriber grid's `bindTo` references. */
  readonly sourceId: string
  /** The operator's automation names — the options for the automation filter. */
  readonly automationNames?: ReadonlyArray<string>
}

const EMPTY_NAMES: ReadonlyArray<string> = []

/**
 * Map the operator-facing status value to the engine's persisted status. The
 * "Success" option carries `success` (operator vocabulary); the runs endpoint
 * persists a successful run as `completed`, so `?status=` must use `completed`.
 * Every other value forwards verbatim.
 */
function toQueryStatus(status: string): string {
  return status === 'success' ? 'completed' : status
}

/** Publish the current filter selection on the shared-filter bus (own id). */
function emitSystemQuery(sourceId: string, automationName: string, status: string): void {
  if (typeof document === 'undefined') return
  const params: Record<string, string> = {
    automationName,
    status: status === '' ? '' : toQueryStatus(status),
  }
  document.dispatchEvent(new CustomEvent('island:system-query', { detail: { sourceId, params } }))
}

/** The automation + status shared-filter publisher for the runs directory. */
export default function SharedFilterSelectIsland({
  sourceId,
  automationNames = EMPTY_NAMES,
}: SharedFilterSelectIslandProps): ReactElement {
  const [automation, setAutomation] = useState('')
  const [status, setStatus] = useState('')

  const onAutomation = useCallback(
    (next: string) => {
      setAutomation(next)
      emitSystemQuery(sourceId, next, status)
    },
    [sourceId, status]
  )
  const onStatus = useCallback(
    (next: string) => {
      setStatus(next)
      emitSystemQuery(sourceId, automation, next)
    },
    [sourceId, automation]
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <AutomationFilter
        value={automation}
        onChange={onAutomation}
        names={automationNames}
      />
      <StatusFilter
        value={status}
        onChange={onStatus}
      />
    </div>
  )
}
