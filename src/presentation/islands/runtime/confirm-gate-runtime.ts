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
 * `cancelLabel` overrides. A gate WITHOUT an input is non-modal — a plain `<div>`
 * after its trigger that never inerts the page. A gate WITH one guards the most
 * serious gestures a page offers, so it opens MODAL on the platform's own
 * `<dialog>`: focus moves inside, its field carries a visible label, and Escape
 * or Cancel closes it without firing.
 *
 * Extracted from `client.ts` so that always-loaded entry stays under its
 * size-limit cap; lives in `islands/shared/` so the imperative DOM construction
 * is written functionally (no `let`, no property assignment — `setAttribute` /
 * `append`) the way the rest of `islands/shared/` is.
 */

import {
  CONFIRM_AFFIRM_LABEL_ATTR,
  CONFIRM_AFFIRM_LABEL_FALLBACK,
  CONFIRM_CANCEL_LABEL_ATTR,
  CONFIRM_CANCEL_LABEL_FALLBACK,
} from '@/domain/models/app/pages/confirm-gate-labels'
import {
  joinPartButtonClasses,
  PART_BUTTON_OUTLINE,
  PART_BUTTON_SM,
} from '@/presentation/design/button-variant-classes'
import {
  computeDialogDescriptionClasses,
  computeDialogTitleClasses,
  NATIVE_ALERT_DIALOG_CONTENT,
  NATIVE_ALERT_DIALOG_FOOTER,
  NATIVE_ALERT_DIALOG_HEADER,
} from '@/presentation/design/dialog-default-classes'
import { FIELD_LABEL_PLAIN, FIELD_STACK_PLAIN } from '@/presentation/design/field-default-classes'
import { computeInputRecipeClasses } from '@/presentation/design/input-default-classes'
import { restoreInertTemplateValue } from '@/presentation/design/session-template'
import { fetchSessionUser, resolveSessionTemplate } from './session-resolver'
import type { ConfirmObject } from '@/domain/models/app/pages/components/confirm-gate'

/**
 * The inline gate draws on shadcn/ui's alert-dialog anatomy without its modality:
 * a card-ground panel, the alert-dialog title and description, the `Input`
 * recipe for the type-to-confirm textbox, and base-nova's `buttonVariants` for
 * the two affordances (the confirm in the weight the server stamped, outline cancel), both at `sm`. The
 * part-button recipe rather than the `button` component's: this runtime ships to
 * every page, and the component recipe carries the schema's variant table. For
 * the same reason it reads the two variant strings and the size it draws, and
 * the bare input recipe, rather than the tables they are picked from.
 */
const DIALOG_CLASS = 'mt-2 flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground'
const TITLE_CLASS = computeDialogTitleClasses('alert-dialog')
const MESSAGE_CLASS = computeDialogDescriptionClasses('alert-dialog')
const INPUT_CLASS = computeInputRecipeClasses()
const BUTTON_ROW_CLASS = 'flex items-center gap-2'
const CANCEL_BTN_CLASS = joinPartButtonClasses(PART_BUTTON_OUTLINE, PART_BUTTON_SM)
/** The modal gate: base-nova's alert-dialog content, header, field and footer. */
const MODAL_CLASS = NATIVE_ALERT_DIALOG_CONTENT
const MODAL_HEADER_CLASS = NATIVE_ALERT_DIALOG_HEADER
const MODAL_FOOTER_CLASS = NATIVE_ALERT_DIALOG_FOOTER
const FIELD_CLASS = FIELD_STACK_PLAIN
const FIELD_LABEL_CLASS = FIELD_LABEL_PLAIN

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

/** Build the type-to-confirm textbox, named by the visible `<label>` drawn above it. */
function createConfirmField(label: string): {
  readonly field: HTMLDivElement
  readonly inputEl: HTMLInputElement
} {
  const id = `confirm-input-${Math.random().toString(36).slice(2)}`
  const field = document.createElement('div')
  field.setAttribute('class', FIELD_CLASS)
  const labelEl = document.createElement('label')
  labelEl.setAttribute('for', id)
  labelEl.setAttribute('class', FIELD_LABEL_CLASS)
  labelEl.append(label)
  const inputEl = document.createElement('input')
  inputEl.setAttribute('id', id)
  inputEl.setAttribute('type', 'text')
  inputEl.setAttribute('class', INPUT_CLASS)
  field.append(labelEl, inputEl)
  return { field, inputEl }
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
  // A value the server filled in is restored LAST, after every token resolved.
  if (rawMatch.includes('$session.')) {
    void fetchSessionUser().then((user) =>
      arm(restoreInertTemplateValue(resolveSessionTemplate(rawMatch, user)))
    )
  } else {
    arm(restoreInertTemplateValue(rawMatch))
  }
}

/**
 * The dialog shell: role surface + separate title + body message. A modal gate
 * is a `<dialog>` (opened with `showModal`) whose title and message sit in the
 * alert-dialog header; an inline one a `<div>` after its trigger.
 */
function buildObjectConfirmShell(
  config: ConfirmObject,
  title: string,
  modal: boolean
): HTMLElement {
  const dialog = document.createElement(modal ? 'dialog' : 'div')
  dialog.setAttribute('role', config.role ?? 'alertdialog')
  dialog.setAttribute('aria-modal', modal ? 'true' : 'false')
  dialog.setAttribute('aria-label', title)
  dialog.setAttribute('data-confirm-dialog', '')
  dialog.setAttribute('class', modal ? MODAL_CLASS : DIALOG_CLASS)
  if (modal) dialog.setAttribute('data-size', 'default')
  const titleEl = document.createElement('strong')
  titleEl.setAttribute('class', TITLE_CLASS)
  titleEl.append(title)
  const messageSpan = document.createElement('span')
  messageSpan.setAttribute('class', MESSAGE_CLASS)
  messageSpan.append(config.message)
  if (modal) {
    const header = document.createElement('div')
    header.setAttribute('class', MODAL_HEADER_CLASS)
    header.append(titleEl, messageSpan)
    dialog.append(header)
  } else {
    dialog.append(titleEl, messageSpan)
  }
  return dialog
}

/** Append the type-to-confirm field, arming the gate when a matchValue is set. */
function appendObjectConfirmInput(
  dialog: HTMLElement,
  input: NonNullable<ConfirmObject['input']>,
  confirmBtn: HTMLButtonElement
): void {
  const { field, inputEl } = createConfirmField(input.label)
  dialog.append(field)
  if (input.matchValue !== undefined) wireTypeToConfirmGate(inputEl, confirmBtn, input.matchValue)
}

/**
 * Append the two affordances: confirm then cancel inline; in a modal gate the
 * alert-dialog footer, cancel first as base-nova orders them.
 */
function appendObjectConfirmButtons(
  dialog: HTMLElement,
  confirmBtn: HTMLButtonElement,
  cancel: { readonly label: string; readonly dismiss: () => void; readonly modal: boolean }
): void {
  const row = document.createElement('div')
  row.setAttribute('class', cancel.modal ? MODAL_FOOTER_CLASS : BUTTON_ROW_CLASS)
  const cancelBtn = createGateButton({
    label: cancel.label,
    ariaLabel: cancel.label,
    className: CANCEL_BTN_CLASS,
    onClick: cancel.dismiss,
  })
  if (cancel.modal) row.append(cancelBtn, confirmBtn)
  else row.append(confirmBtn, cancelBtn)
  dialog.append(row)
}

/** Close a modal gate (the top layer lets go of it), then take it out of the page. */
function dismissGate(dialog: HTMLElement): void {
  if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close()
  dialog.remove()
}

/**
 * Resolve the gate's two affordance labels.
 *
 * Precedence, for each:
 *
 *   1. the caller's explicit override (see below);
 *   2. (affirm only) the trigger's own visible text — "Delete note" reads better
 *      inside the dialog than a generic "Confirm";
 *   3. the interpreter's language-resolved string, stamped on the trigger
 *      server-side as {@link CONFIRM_AFFIRM_LABEL_ATTR} /
 *      {@link CONFIRM_CANCEL_LABEL_ATTR};
 *   4. the ENGLISH catalog default.
 *
 * Step 4 is English on purpose. `DEFAULT_INTERPRETER_LANG` is `'en'`, so a
 * French last resort here would be two fallback chains that disagree — and that
 * disagreement is what put an "Annuler" beside an author's English "Retry" on
 * every console dialog, in an app of any language.
 *
 * ## Why both gates call THIS, and the override is a parameter
 *
 * The two vanilla-DOM gates run an identical chain and differ only in where the
 * step-1 override comes from: the OBJECT gate reads `confirmLabel` / `cancelLabel`
 * off the parsed `data-confirm-config`, while the STRING gate in
 * `presentation/client.ts` reads the `data-confirm-label` attribute. Taking the
 * override as an argument is what lets one chain serve both — and the chain is
 * the thing that must not fork, because a fork is precisely how the two ends
 * came to disagree in the first place.
 *
 * @param trigger   - the server-rendered trigger carrying the stamped attributes
 * @param overrides - highest-precedence labels; `undefined` / absent falls through
 */
export function resolveGateLabels(
  trigger: HTMLButtonElement,
  overrides: {
    readonly confirmLabel?: string | null | undefined
    readonly cancelLabel?: string | null | undefined
  }
): { readonly confirm: string; readonly cancel: string } {
  return {
    confirm:
      overrides.confirmLabel ??
      trigger.textContent?.trim() ??
      trigger.getAttribute(CONFIRM_AFFIRM_LABEL_ATTR) ??
      CONFIRM_AFFIRM_LABEL_FALLBACK,
    cancel:
      overrides.cancelLabel ??
      trigger.getAttribute(CONFIRM_CANCEL_LABEL_ATTR) ??
      CONFIRM_CANCEL_LABEL_FALLBACK,
  }
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
  const { confirm: confirmLabel, cancel: cancelLabel } = resolveGateLabels(trigger, config)
  const modal = config.input !== undefined
  const dialog = buildObjectConfirmShell(config, title, modal)
  const dismiss = (): void => dismissGate(dialog)
  const confirmBtn = createGateButton({
    label: confirmLabel,
    // In the weight of the action, decided on the server (`data-confirm-class`).
    className: trigger.getAttribute('data-confirm-class') ?? '',
    onClick: () => {
      dismiss()
      onConfirm()
    },
  })
  if (config.input) appendObjectConfirmInput(dialog, config.input, confirmBtn)
  appendObjectConfirmButtons(dialog, confirmBtn, { label: cancelLabel, dismiss, modal })
  trigger.insertAdjacentElement('afterend', dialog)
  if (dialog instanceof HTMLDialogElement) {
    // Escape closes the dialog natively; it leaves the page with it, unfired.
    dialog.addEventListener('close', () => dialog.remove())
    dialog.showModal()
  }
}
