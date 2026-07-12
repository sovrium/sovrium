/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { useEffect, useState, type ReactElement } from 'react'
import { fetchSessionUser, resolveSessionTemplate } from './session-resolver'
import type { ConfirmObject } from '@/domain/models/app/pages/components/confirm-gate'

const CONTAINER_CLASS =
  'border-border bg-background-raised flex items-center gap-2 rounded-md border p-2'
const CONFIRM_BUTTON_CLASS =
  'bg-error-bg text-error-fg rounded-md px-2 py-1 text-xs font-medium transition-opacity hover:opacity-90'
const CANCEL_BUTTON_CLASS =
  'border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-2 py-1 text-xs transition-colors'

export interface InlineConfirmDialogProps {
  readonly prompt: string
  readonly confirmLabel: string
  readonly confirmDataActionType?: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly className?: string
}

export function InlineConfirmDialog({
  prompt,
  confirmLabel,
  confirmDataActionType,
  onConfirm,
  onCancel,
  className,
}: InlineConfirmDialogProps): ReactElement {
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-label={prompt}
      className={className ?? CONTAINER_CLASS}
    >
      <span className="text-foreground-subtle text-xs">{prompt}</span>
      <button
        type="button"
        data-action-type={confirmDataActionType}
        className={CONFIRM_BUTTON_CLASS}
        onClick={() => {
          onCancel()
          onConfirm()
        }}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        aria-label="Annuler"
        className={CANCEL_BUTTON_CLASS}
        onClick={onCancel}
      >
        Annuler
      </button>
    </div>
  )
}


const OBJECT_CONTAINER_CLASS =
  'border-border bg-background-raised flex flex-col gap-2 rounded-md border p-3'
const OBJECT_CONFIRM_BUTTON_CLASS =
  'bg-error-bg text-error-fg rounded-md px-3 py-1 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50'
const OBJECT_CANCEL_BUTTON_CLASS =
  'border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-3 py-1 text-sm transition-colors'
const OBJECT_INPUT_CLASS = 'border-border rounded border px-2 py-1 text-sm'

export interface ObjectConfirmDialogProps {
  readonly config: ConfirmObject
  readonly confirmDataActionType?: string
  readonly record?: Record<string, unknown>
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly fallbackConfirmLabel: string
}

function resolveRecordTemplate(
  template: string,
  record: Record<string, unknown> | undefined
): string {
  if (record === undefined || !template.includes('$record.')) return template
  return template.replaceAll(/\$record\.(\w+)/g, (_full, field: string) => {
    const cell = record[field]
    return cell === undefined || cell === null ? '' : String(cell)
  })
}

function useResolvedMatchValue(
  rawMatch: string | undefined,
  record: Record<string, unknown> | undefined
): string | undefined {
  const [matchValue, setMatchValue] = useState<string | undefined>(() =>
    rawMatch !== undefined && !rawMatch.includes('$session.')
      ? resolveRecordTemplate(rawMatch, record)
      : undefined
  )
  useEffect(() => {
    if (rawMatch === undefined || !rawMatch.includes('$session.')) return
    void fetchSessionUser().then((user) => {
      setMatchValue(resolveRecordTemplate(resolveSessionTemplate(rawMatch, user), record))
    })
  }, [rawMatch, record])
  return matchValue
}

export function ObjectConfirmDialog({
  config,
  confirmDataActionType,
  record,
  onConfirm,
  onCancel,
  fallbackConfirmLabel,
}: ObjectConfirmDialogProps): ReactElement {
  const title = config.title ?? config.message
  const confirmLabel = config.confirmLabel ?? fallbackConfirmLabel
  const cancelLabel = config.cancelLabel ?? 'Annuler'
  const rawMatch = config.input?.matchValue

  const [inputValue, setInputValue] = useState('')
  const matchValue = useResolvedMatchValue(rawMatch, record)
  const confirmDisabled =
    rawMatch !== undefined && (matchValue === undefined || inputValue !== matchValue)

  return (
    <div
      role={config.role ?? 'alertdialog'}
      aria-modal="false"
      aria-label={title}
      className={OBJECT_CONTAINER_CLASS}
    >
      <strong className="text-foreground text-sm">{title}</strong>
      <span className="text-foreground-subtle text-xs">{config.message}</span>
      {config.input && (
        <input
          type="text"
          aria-label={config.input.label}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          className={OBJECT_INPUT_CLASS}
        />
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-action-type={confirmDataActionType}
          disabled={confirmDisabled}
          className={OBJECT_CONFIRM_BUTTON_CLASS}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          aria-label={cancelLabel}
          className={OBJECT_CANCEL_BUTTON_CLASS}
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  )
}
