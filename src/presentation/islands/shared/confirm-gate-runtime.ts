/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

function createConfirmInput(label: string): HTMLInputElement {
  const inputEl = document.createElement('input')
  inputEl.setAttribute('type', 'text')
  inputEl.setAttribute('aria-label', label)
  inputEl.setAttribute('class', INPUT_CLASS)
  return inputEl
}

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

function appendObjectConfirmInput(
  dialog: HTMLDivElement,
  input: NonNullable<ConfirmObject['input']>,
  confirmBtn: HTMLButtonElement
): void {
  const inputEl = createConfirmInput(input.label)
  dialog.append(inputEl)
  if (input.matchValue !== undefined) wireTypeToConfirmGate(inputEl, confirmBtn, input.matchValue)
}

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
