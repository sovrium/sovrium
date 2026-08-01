/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useCallback, useState } from 'react'
import { satisfiesFieldCondition } from '@/domain/models/shared/condition-operators'
import { BUTTON_REQUEST_FAILED, classifyButtonResponse } from './record-button-outcome'
import { renderToast } from './toast'

export interface RecordButtonConfig {
  readonly label: string
  readonly action: 'url' | 'automation'
  readonly url?: string
  readonly automation?: string
  readonly visibleWhen?: Readonly<Record<string, unknown>>
}

export interface RecordButtonProps {
  readonly config: RecordButtonConfig
  readonly fieldName: string
  readonly table?: string
  readonly recordId?: string
  readonly record?: Readonly<Record<string, unknown>>
  readonly className?: string
  readonly onInvoked?: () => void
}

const BASE_CLASS =
  'text-primary hover:bg-primary-subtle rounded px-2 py-1 text-xs disabled:opacity-50'

const invokeUrl = (table: string, recordId: string, fieldName: string): string =>
  `/api/tables/${encodeURIComponent(table)}/records/${encodeURIComponent(recordId)}/buttons/${encodeURIComponent(fieldName)}`

function passesVisibilityGate(props: RecordButtonProps): boolean {
  if (!props.record) return true
  return satisfiesFieldCondition(
    props.config.visibleWhen as Parameters<typeof satisfiesFieldCondition>[0],
    props.record
  )
}

export function RecordButton(props: RecordButtonProps): React.ReactNode {
  const { config, fieldName, table, recordId, className, onInvoked } = props
  const [pending, setPending] = useState(false)

  const canInvoke = config.action === 'automation' && Boolean(table) && Boolean(recordId)

  const onClick = useCallback(() => {
    if (config.action === 'url') {
      if (config.url) window.location.assign(config.url)
      return
    }
    if (!table || !recordId) return
    setPending(true)
    void fetch(invokeUrl(table, recordId, fieldName), { method: 'POST' })
      .then(classifyButtonResponse)
      .catch(() => BUTTON_REQUEST_FAILED)
      .then((outcome) => {
        renderToast(outcome.message, outcome.variant)
        if (outcome.changed) onInvoked?.()
      })
      .finally(() => {
        setPending(false)
      })
  }, [config.action, config.url, table, recordId, fieldName, onInvoked])

  if (!passesVisibilityGate(props)) return undefined

  const disabled = pending || (config.action === 'automation' && !canInvoke)

  return (
    <button
      type="button"
      className={className ? `${BASE_CLASS} ${className}` : BASE_CLASS}
      data-button-field={fieldName}
      data-button-action={config.action}
      disabled={disabled}
      onClick={onClick}
    >
      {config.label}
    </button>
  )
}
