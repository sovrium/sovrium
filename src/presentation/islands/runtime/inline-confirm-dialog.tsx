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

import { useState, type ReactElement } from 'react'
import { gateTexts, useResolvedMatchValue } from './confirm-gate-texts'
import type { ConfirmObject } from '@/domain/models/app/pages/components/confirm-gate'

const CONTAINER_CLASS = 'border-border bg-card flex items-center gap-2 rounded-md border p-2'
const CONFIRM_BUTTON_CLASS =
  'bg-error-bg text-error-fg rounded-md px-2 py-1 text-sm font-medium transition-opacity hover:opacity-90'
const CANCEL_BUTTON_CLASS =
  'border-border text-foreground-subtle hover:bg-muted rounded-md border px-2 py-1 text-sm transition-colors'

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
  /**
   * Dismiss-button label — the host's language-resolved `confirmGate.cancel`.
   * Defaults to the ENGLISH catalog value, matching `DEFAULT_INTERPRETER_LANG`;
   * a French default here would be a second fallback chain disagreeing with the
   * server's, which is exactly how an "Annuler" ended up beside an author's
   * English affirm on every console dialog.
   */
  readonly cancelLabel?: string
  /** Override the container className (defaults to the inline-gate chrome). */
  readonly className?: string
}

/** The ENGLISH catalog value for `confirmGate.cancel`, per `DEFAULT_INTERPRETER_LANG`. */
const DEFAULT_GATE_CANCEL_LABEL = 'Cancel'

/** The inline confirm gate shown while a `confirm`-bearing action is armed. */
export function InlineConfirmDialog({
  prompt,
  confirmLabel,
  confirmDataActionType,
  onConfirm,
  onCancel,
  cancelLabel = DEFAULT_GATE_CANCEL_LABEL,
  className,
}: InlineConfirmDialogProps): ReactElement {
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-label={prompt}
      className={className ?? CONTAINER_CLASS}
    >
      <span className="text-foreground-subtle text-sm">{prompt}</span>
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
        aria-label={cancelLabel}
        className={CANCEL_BUTTON_CLASS}
        onClick={onCancel}
      >
        {cancelLabel}
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Object-form confirm gate (separate title / dialog role / type-to-confirm input)
// ──────────────────────────────────────────────────────────────────────────────

const OBJECT_CONTAINER_CLASS = 'border-border bg-card flex flex-col gap-2 rounded-md border p-3'
const OBJECT_CONFIRM_BUTTON_CLASS =
  'bg-error-bg text-error-fg rounded-md px-3 py-1 text-md font-medium transition-opacity hover:opacity-90 disabled:opacity-50'
const OBJECT_CANCEL_BUTTON_CLASS =
  'border-border text-foreground-subtle hover:bg-muted rounded-md border px-3 py-1 text-md transition-colors'
const OBJECT_INPUT_CLASS = 'border-border rounded border px-2 py-1 text-md'

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
  /**
   * Fired when the user confirms, with the confirm button pressed — the gate
   * unmounts before the action answers, so a host that closes from what was
   * pressed reads its place now.
   */
  readonly onConfirm: (pressed: Element) => void
  /** Fired when the user cancels. */
  readonly onCancel: () => void
  /** Confirm-button label fallback when the config omits `confirmLabel`. */
  readonly fallbackConfirmLabel: string
  /**
   * Dismiss-button label fallback when the config omits `cancelLabel` — the
   * host's language-resolved `confirmGate.cancel`. Defaults to the ENGLISH
   * catalog value; see {@link InlineConfirmDialogProps.cancelLabel}.
   */
  readonly fallbackCancelLabel?: string
}

/**
 * The OBJECT-form confirm gate — the richer destructive-confirm the RGPD erasure
 * needs. A non-modal `role` surface (`dialog` / `alertdialog`) whose accessible
 * NAME is the SEPARATE `title` (distinct from the body `message`), an optional
 * type-to-confirm `input` whose confirm affordance stays DISABLED until the value
 * equals the resolved `matchValue`, and `confirmLabel` / `cancelLabel` overrides.
 *
 * Its title and message name the row it was armed for: `$record.*` is filled in
 * as TEXT (React escapes it), never parsed as markup.
 */
export function ObjectConfirmDialog({
  config,
  confirmDataActionType,
  record,
  onConfirm,
  onCancel,
  fallbackConfirmLabel,
  fallbackCancelLabel = DEFAULT_GATE_CANCEL_LABEL,
}: ObjectConfirmDialogProps): ReactElement {
  const texts = gateTexts(config, record, fallbackConfirmLabel, fallbackCancelLabel)
  const rawMatch = config.input?.matchValue

  const [inputValue, setInputValue] = useState('')
  const matchValue = useResolvedMatchValue(rawMatch, record)
  // Disabled only when a type-to-confirm `matchValue` is armed and unmet.
  const confirmDisabled =
    rawMatch !== undefined && (matchValue === undefined || inputValue !== matchValue)

  return (
    <div
      role={config.role ?? 'alertdialog'}
      aria-modal="false"
      aria-label={texts.title}
      className={OBJECT_CONTAINER_CLASS}
    >
      <strong className="text-foreground text-md">{texts.title}</strong>
      <span className="text-foreground-subtle text-sm">{texts.message}</span>
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
          onClick={(event) => onConfirm(event.currentTarget)}
        >
          {texts.confirmLabel}
        </button>
        <button
          type="button"
          aria-label={texts.cancelLabel}
          className={OBJECT_CANCEL_BUTTON_CLASS}
          onClick={onCancel}
        >
          {texts.cancelLabel}
        </button>
      </div>
    </div>
  )
}
