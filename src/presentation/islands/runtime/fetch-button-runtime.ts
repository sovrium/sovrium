/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { executeFetchAction } from '@/presentation/islands/runtime/action-executor'
import {
  openFetchConfirmObjectGate,
  parseConfirmObjectConfig,
  resolveGateLabels,
} from '@/presentation/islands/runtime/confirm-gate-runtime'
import { bindActionButtons, parseActionInput } from './client-event-delegate'
import { showToast } from './client-toast'
import type { FetchAction } from '@/domain/models/app/pages/components/action'

/**
 * Standalone `type: 'fetch'` buttons: their config, their dispatch through
 * the shared `executeFetchAction` runtime, the toast they answer with, and
 * the inline confirm gate a prompted button opens first.
 */

// ─── Fetch button handling ──────────────────────────────────────────────────

type FetchToastResponse = {
  type: 'toast'
  message: string
  variant?: string
  duration?: number
  actionLabel?: string
  actionUrl?: string
}

export function dispatchToastResponse(response: FetchToastResponse | undefined): void {
  if (!response) return
  showToast(response.message, {
    variant: response.variant,
    duration: response.duration,
    actionLabel: response.actionLabel,
    actionUrl: response.actionUrl,
  })
}

/**
 * Parse the `data-action-config` blob into a `FetchAction`. The standalone
 * button serializes the WHOLE action object (mode / confirm / filename / …) as a
 * single JSON attribute, so the client hands it verbatim to the shared executor
 * instead of reconstructing the request from flat attributes.
 */
function parseFetchActionConfig(raw: string | null): FetchAction | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && (parsed as { type?: unknown }).type === 'fetch') {
      return parsed as FetchAction
    }
    return undefined
  } catch {
    return undefined
  }
}

/** Build a styled gate button (the confirm / cancel affordance) for the inline alertdialog. */
function createGateButton(opts: {
  label: string
  className: string
  ariaLabel?: string
  onClick: () => void
}): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = opts.className
  if (opts.ariaLabel) btn.setAttribute('aria-label', opts.ariaLabel)
  btn.textContent = opts.label
  btn.addEventListener('click', opts.onClick)
  return btn
}

/**
 * The inline destructive-confirm `alertdialog` shown when a standalone fetch
 * button carries a top-level `confirm`. Mirrors the data-table per-row gate
 * (`islands/data-table/action-cell.tsx`): a non-modal `role="alertdialog"`
 * (plain `<div>`, never inerts the page) whose accessible name IS the prompt and
 * whose confirm affordance re-uses the button's label; confirming dispatches,
 * cancelling dismisses the gate WITHOUT firing the action. The trigger button
 * stays in the DOM so the gate can be re-opened after a cancel.
 *
 * The two affordance labels arrive together in `labels` because they are one
 * decision — the gate's language — and passing them as separate positional
 * arguments is how a caller ends up supplying one and defaulting the other.
 */
function openFetchConfirmGate(
  trigger: HTMLButtonElement,
  message: string,
  labels: { readonly confirm: string; readonly cancel: string },
  onConfirm: () => void
): void {
  const { confirm: confirmLabel, cancel: cancelLabel } = labels
  // Guard against stacking a second gate when the trigger is clicked twice.
  if (trigger.nextElementSibling?.hasAttribute('data-confirm-dialog')) return

  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'alertdialog')
  dialog.setAttribute('aria-modal', 'false')
  dialog.setAttribute('aria-label', message)
  dialog.setAttribute('data-confirm-dialog', '')
  dialog.className =
    'border-border bg-background-raised mt-2 flex items-center gap-2 rounded-md border p-2'

  const messageSpan = document.createElement('span')
  messageSpan.className = 'text-foreground-subtle text-sm'
  messageSpan.textContent = message
  dialog.appendChild(messageSpan)

  dialog.appendChild(
    createGateButton({
      label: confirmLabel,
      className:
        'bg-error-bg text-error-fg rounded-md px-2 py-1 text-sm font-medium transition-opacity hover:opacity-90',
      onClick: () => {
        dialog.remove()
        onConfirm()
      },
    })
  )
  // The visible text and the accessible name are set from the SAME resolved
  // string, never two separate literals, which would be two places for the
  // language to drift independently.
  dialog.appendChild(
    createGateButton({
      label: cancelLabel,
      ariaLabel: cancelLabel,
      className:
        'border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-2 py-1 text-sm transition-colors',
      onClick: () => dialog.remove(),
    })
  )

  trigger.insertAdjacentElement('afterend', dialog)
}

export function setupFetchButtonHandlers(): void {
  // A `type: 'toast'` button is the fetch button with nothing to fetch: it
  // raises the toast its action carries, through the same toast path.
  bindActionButtons('toast', (button) => {
    const config = parseActionInput(button.getAttribute('data-action-config'))
    if (typeof config['message'] === 'string') dispatchToastResponse(config as FetchToastResponse)
  })
  bindActionButtons('fetch', (button) => {
    const config = parseFetchActionConfig(button.getAttribute('data-action-config'))
    if (!config) return

    // Dispatch through the SHARED action runtime so every dispatch mode (the default
    // `fetch`, plus `navigate` / `download` / `oauth`) behaves identically to the
    // data-table action path. No `renderToast` is injected: the executor reports
    // success via its returned `{ ok }`, and the rich `onSuccess` / `onError`
    // toast (incl. `duration` / `actionLabel` / `actionUrl`) is rendered here so
    // those fields — which the executor's bare `renderToast(message, variant)`
    // would drop — are preserved. The executor itself applies the additive
    // `onSuccess.status` / `onSuccess.refetch` client-state effects on success.
    const dispatch = async (): Promise<void> => {
      const result = await executeFetchAction(config)
      if (result) dispatchToastResponse(result.ok ? config.onSuccess : config.onError)
    }

    // A top-level button `confirm` rides on `data-confirm` (string form) or
    // `data-confirm-config` (object form). It is a button-level gate distinct from
    // the action's own `confirm` flag, so it opens the inline gate before dispatch.
    const confirmObject = parseConfirmObjectConfig(button.getAttribute('data-confirm-config'))
    if (confirmObject) {
      openFetchConfirmObjectGate(button, confirmObject, () => void dispatch())
      return
    }
    const confirmMessage = button.getAttribute('data-confirm')
    if (confirmMessage) {
      // Same precedence chain as the OBJECT gate, resolved by the SAME function —
      // this gate's only difference is that its highest-priority override is the
      // renderer's `data-confirm-label` attribute rather than a config field. The
      // chain must not fork: a fork is how the two ends came to disagree and put
      // an "Annuler" beside an author's English affirm label.
      const labels = resolveGateLabels(button, {
        confirmLabel: button.getAttribute('data-confirm-label'),
      })
      openFetchConfirmGate(button, confirmMessage, labels, () => void dispatch())
      return
    }

    void dispatch()
  })
}
