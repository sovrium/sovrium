/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared inline destructive-confirm `alertdialog` (the campaign-1 confirm gate).
 *
 * The single React confirm-gate primitive: a non-modal `role="alertdialog"`
 * (plain `<div>`, never inerts the page) whose accessible NAME is the prompt and
 * whose confirm affordance re-uses the action's own label; confirming dispatches,
 * cancelling dismisses without firing. Extracted from the data-table per-row
 * action cell (`islands/data-table/action-cell.tsx`) so the data-table action
 * column AND the record-drawer footer slot share ONE confirm implementation
 * instead of each re-inventing the gate. The vanilla-DOM standalone-button gate
 * (`presentation/client.ts` `openFetchConfirmGate`) renders the byte-identical
 * markup for non-React buttons.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop -- conventional confirm-gate event handlers (confirm/cancel close over the armed action); a transient dialog rendered only while a confirm is armed, not a hot path. Mirrors the same exemption in action-cell.tsx + client.ts. */

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
  /** Confirmation prompt — the alertdialog's accessible name AND visible text. */
  readonly prompt: string
  /** Confirm-button label (re-uses the triggering action's own label). */
  readonly confirmLabel: string
  /**
   * Optional `data-action-type` stamped on the confirm button — the data-table
   * action cell uses it to surface the dispatched action's type; the record-drawer
   * footer omits it.
   */
  readonly confirmDataActionType?: string
  /** Fired when the user confirms (after `onCancel` dismisses the gate). */
  readonly onConfirm: () => void
  /** Fired when the user cancels (or as the first step of confirming). */
  readonly onCancel: () => void
  /** Override the container className (defaults to the inline-gate chrome). */
  readonly className?: string
}

/** The inline confirm gate shown while a `confirm`-bearing action is armed. */
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

// ──────────────────────────────────────────────────────────────────────────────
// Object-form confirm gate (separate title / dialog role / type-to-confirm input)
// ──────────────────────────────────────────────────────────────────────────────

const OBJECT_CONTAINER_CLASS =
  'border-border bg-background-raised flex flex-col gap-2 rounded-md border p-3'
const OBJECT_CONFIRM_BUTTON_CLASS =
  'bg-error-bg text-error-fg rounded-md px-3 py-1 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50'
const OBJECT_CANCEL_BUTTON_CLASS =
  'border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-3 py-1 text-sm transition-colors'
const OBJECT_INPUT_CLASS = 'border-border rounded border px-2 py-1 text-sm'

export interface ObjectConfirmDialogProps {
  /** The rich destructive-confirm descriptor (object form of a `confirm` gate). */
  readonly config: ConfirmObject
  /**
   * Optional `data-action-type` stamped on the confirm button — the data-table
   * action cell surfaces the dispatched action's type; other hosts omit it.
   */
  readonly confirmDataActionType?: string
  /** Row / detail record for `$record.<field>` resolution in `input.matchValue`. */
  readonly record?: Record<string, unknown>
  /** Fired when the user confirms. */
  readonly onConfirm: () => void
  /** Fired when the user cancels. */
  readonly onCancel: () => void
  /** Confirm-button label fallback when the config omits `confirmLabel`. */
  readonly fallbackConfirmLabel: string
}

/** Resolve `$record.<field>` references in a `matchValue` against the row record. */
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

/**
 * Resolve a type-to-confirm `matchValue` against the caller's own session (for a
 * `$session.<field>` token) and the row record (`$record.<field>`). A non-session
 * matchValue resolves synchronously; a `$session.` token resolves once the
 * session fetch returns. `undefined` means "not yet resolved / no gate".
 */
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
    // setState after the transient gate unmounts is a harmless no-op (React 18+).
    void fetchSessionUser().then((user) => {
      setMatchValue(resolveRecordTemplate(resolveSessionTemplate(rawMatch, user), record))
    })
  }, [rawMatch, record])
  return matchValue
}

/**
 * The OBJECT-form confirm gate — the richer destructive-confirm the RGPD erasure
 * needs. A non-modal `role` surface (`dialog` / `alertdialog`) whose accessible
 * NAME is the SEPARATE `title` (distinct from the body `message`), an optional
 * type-to-confirm `input` whose confirm affordance stays DISABLED until the value
 * equals the resolved `matchValue` (a `$session.<field>` token resolves to the
 * caller's OWN session value), and `confirmLabel` / `cancelLabel` overrides. The
 * vanilla-DOM `client.ts` gate renders the equivalent markup for non-React buttons.
 */
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
  // Disabled only when a type-to-confirm `matchValue` is armed and unmet (a
  // free-text input with no matchValue never gates).
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
