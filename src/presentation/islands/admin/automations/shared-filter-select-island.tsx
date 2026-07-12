/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useCallback, useState, type ReactElement } from 'react'
import { AutomationFilter, StatusFilter } from './admin-automation-runs-list'

interface SharedFilterSelectIslandProps {
  readonly sourceId: string
  readonly automationNames?: ReadonlyArray<string>
}

const EMPTY_NAMES: ReadonlyArray<string> = []

function toQueryStatus(status: string): string {
  return status === 'success' ? 'completed' : status
}

function emitSystemQuery(sourceId: string, automationName: string, status: string): void {
  if (typeof document === 'undefined') return
  const params: Record<string, string> = {
    automationName,
    status: status === '' ? '' : toQueryStatus(status),
  }
  document.dispatchEvent(new CustomEvent('island:system-query', { detail: { sourceId, params } }))
}

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
