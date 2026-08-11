/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Vanilla-DOM OBJECT-form confirm gate (GDPR-conversion foundation).
 *
 * The non-React counterpart of the shared React `ObjectConfirmDialog`
 * (`inline-confirm-dialog.tsx`): the richer destructive-confirm the RGPD erasure
 * needs, rendered for a STANDALONE fetch button by the always-loaded client
 * runtime (`presentation/client.ts`). A `role` surface (`dialog`/`alertdialog`)
 * whose accessible NAME is the SEPARATE `title` (distinct from the body
 * `message`), an optional type-to-confirm `input` whose confirm affordance stays
 * disabled until the value equals the resolved `matchValue` (a `$session.email`
 * token resolves to the caller's OWN session value), and `confirmLabel` /
 * `cancelLabel` overrides. Non-modal — a plain `<div>` that never inerts the page.
 *
 * Extracted from `client.ts` so that always-loaded entry stays under its
 * size-limit cap; lives in `islands/shared/` so the imperative DOM construction
 * is written functionally (no `let`, no property assignment — `setAttribute` /
 * `append`) the way the rest of `islands/shared/` is.
 */

import { fetchSessionUser, resolveSessionTemplate } from './session-resolver'
import type { ConfirmObject } from '@/domain/models/app/pages/components/confirm-gate'

const DIALOG_CLASS =
  'border-border bg-background-raised mt-2 flex flex-col gap-2 rounded-md border p-3'
const TITLE_CLASS = 'text-foreground text-sm'
const MESSAGE_CLASS = 'text-foreground-subtle text-xs'
const INPUT_CLASS = 'border-border rounded border px-2 py-1 text-sm'
const BUTTON_ROW_CLASS = 'flex items-center gap-2'
const CONFIRM_BTN_CLASS =
  'bg-error-bg text-error-fg rounded-md px-3 py-1 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50'
const CANCEL_BTN_CLASS =
  'border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-3 py-1 text-sm transition-colors'

/**
 * Parse the `data-confirm-config` blob into the OBJECT-form confirm descriptor.
 * The button schema-fallback overlay serializes an object `confirm` (separate
 * title / dialog role / type-to-confirm input / label overrides) here, distinct
 * from the string `data-confirm`.
 */
export function parseConfirmObjectConfig(raw: string | null): ConfirmObject | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { message?: unknown }).message === 'string'
    ) {
      return parsed as ConfirmObject
    }
    return undefined
  } catch {
    return undefined
  }
}

/** Build a styled gate button (confirm / cancel affordance) without property mutation. */
function createGateButton(opts: {
  readonly label: string
  readonly className: string
  readonly ariaLabel?: string
  readonly onClick: () => void
}): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.setAttribute('type', 'button')
  btn.setAttribute('class', opts.className)
  if (opts.ariaLabel) btn.setAttribute('aria-label', opts.ariaLabel)
  btn.append(opts.label)
  btn.addEventListener('click', opts.onClick)
  return btn
}

/** Build the type-to-confirm textbox (labelled by `input.label`). */
function createConfirmInput(label: string): HTMLInputElement {
  const inputEl = document.createElement('input')
  inputEl.setAttribute('type', 'text')
  inputEl.setAttribute('aria-label', label)
  inputEl.setAttribute('class', INPUT_CLASS)
  return inputEl
}

/**
 * Arm the type-to-confirm gate: the confirm affordance stays DISABLED until the
 * input value equals the resolved `matchValue`. A `$session.<field>` token (e.g.
 * `$session.email`) resolves CLIENT-SIDE from the caller's own session, so the
 * gate clears only when the caller retypes their OWN value. The input listener
 * is attached only ONCE the matchValue is known (no mutable state), and an
 * immediate evaluation handles a value typed before the session resolved.
 */
function wireTypeToConfirmGate(
  inputEl: HTMLInputElement,
  confirmBtn: HTMLButtonElement,
  rawMatch: string
): void {
  confirmBtn.setAttribute('disabled', '')
  const arm = (matchValue: string): void => {
    const evaluate = (): void => {
      if (inputEl.value === matchValue) confirmBtn.removeAttribute('disabled')
      else confirmBtn.setAttribute('disabled', '')
    }
    inputEl.addEventListener('input', evaluate)
    evaluate()
  }
  if (rawMatch.includes('$session.')) {
    void fetchSessionUser().then((user) => arm(resolveSessionTemplate(rawMatch, user)))
  } else {
    arm(rawMatch)
  }
}

/** The dialog shell: role surface + separate title + body message. */
function buildObjectConfirmShell(config: ConfirmObject, title: string): HTMLDivElement {
  const dialog = document.createElement('div')
  dialog.setAttribute('role', config.role ?? 'alertdialog')
  dialog.setAttribute('aria-modal', 'false')
  dialog.setAttribute('aria-label', title)
  dialog.setAttribute('data-confirm-dialog', '')
  dialog.setAttribute('class', DIALOG_CLASS)
  const titleEl = document.createElement('strong')
  titleEl.setAttribute('class', TITLE_CLASS)
  titleEl.append(title)
  dialog.append(titleEl)
  const messageSpan = document.createElement('span')
  messageSpan.setAttribute('class', MESSAGE_CLASS)
  messageSpan.append(config.message)
  dialog.append(messageSpan)
  return dialog
}

/** Append the optional type-to-confirm input, arming the gate when a matchValue is set. */
function appendObjectConfirmInput(
  dialog: HTMLDivElement,
  input: NonNullable<ConfirmObject['input']>,
  confirmBtn: HTMLButtonElement
): void {
  const inputEl = createConfirmInput(input.label)
  dialog.append(inputEl)
  if (input.matchValue !== undefined) wireTypeToConfirmGate(inputEl, confirmBtn, input.matchValue)
}

/** Append the confirm + cancel button row. */
function appendObjectConfirmButtons(
  dialog: HTMLDivElement,
  confirmBtn: HTMLButtonElement,
  cancelLabel: string
): void {
  const row = document.createElement('div')
  row.setAttribute('class', BUTTON_ROW_CLASS)
  row.append(confirmBtn)
  row.append(
    createGateButton({
      label: cancelLabel,
      ariaLabel: cancelLabel,
      className: CANCEL_BTN_CLASS,
      onClick: () => dialog.remove(),
    })
  )
  dialog.append(row)
}

/**
 * Render the OBJECT-form confirm gate after a standalone fetch button. The
 * trigger stays in the DOM (sibling) so the gate can be re-opened after a cancel;
 * a guard prevents stacking a second gate.
 */
export function openFetchConfirmObjectGate(
  trigger: HTMLButtonElement,
  config: ConfirmObject,
  onConfirm: () => void
): void {
  if (trigger.nextElementSibling?.hasAttribute('data-confirm-dialog')) return
  const title = config.title ?? config.message
  const confirmLabel = config.confirmLabel ?? trigger.textContent?.trim() ?? 'Confirmer'
  const cancelLabel = config.cancelLabel ?? 'Annuler'
  const dialog = buildObjectConfirmShell(config, title)
  const confirmBtn = createGateButton({
    label: confirmLabel,
    className: CONFIRM_BTN_CLASS,
    onClick: () => {
      dialog.remove()
      onConfirm()
    },
  })
  if (config.input) appendObjectConfirmInput(dialog, config.input, confirmBtn)
  appendObjectConfirmButtons(dialog, confirmBtn, cancelLabel)
  trigger.insertAdjacentElement('afterend', dialog)
}
