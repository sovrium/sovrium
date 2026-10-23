/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `clipboard` client action: write a value to the reader's clipboard on
 * the click, then run `onSuccess`, or `onError` when the browser refuses the
 * write (an insecure context with no clipboard, a denied permission).
 *
 * The value reaches the button already resolved by the server, a field the
 * reader may not read resolved to empty, so this side copies text and never
 * sees a `$record.` token. The clipboard is only ever written, never read.
 */

import { runErrorOutcome, runSuccessOutcome } from './action-outcome'
import { bindActionButtons } from './client-event-delegate'
import { showToast } from './client-toast'
import { readActionConfig } from './fill-runtime'

/**
 * Write `text` to the clipboard: `true` once the browser accepted it, `false`
 * when it refused or has no clipboard to write to. Never throws.
 */
export function writeClipboard(text: string): Promise<boolean> {
  try {
    // `navigator.clipboard` is absent outside a secure context.
    const clipboard = navigator.clipboard as Clipboard | undefined
    if (clipboard === undefined) return Promise.resolve(false)
    return clipboard.writeText(text).then(
      () => true,
      () => false
    )
  } catch {
    // A synchronous refusal is a refusal like the rejected one.
    return Promise.resolve(false)
  }
}

/** Show the toast a button's `data-on-<outcome>-*` attributes declare, if any. */
function showOutcomeToast(button: Element, outcome: 'success' | 'error'): void {
  const message = button.getAttribute(`data-on-${outcome}-message`)
  if (message) {
    showToast(message, { variant: button.getAttribute(`data-on-${outcome}-variant`) ?? undefined })
  }
}

/** Bind every clipboard button on the page, present and future. */
export function setupClipboardHandlers(): void {
  bindActionButtons('clipboard', async (button) => {
    // A grid's row action names its type too, and copies its own row's value
    // (`clipboard-row-action.ts`): only a button carrying its copy is ours.
    if (!button.hasAttribute('data-action-config')) return
    const value = readActionConfig<{ readonly value: string }>(button)?.value
    const copied = await writeClipboard(typeof value === 'string' ? value : '')
    if (!copied) return runErrorOutcome(button, () => showOutcomeToast(button, 'error'))
    runSuccessOutcome(button, { toast: () => showOutcomeToast(button, 'success') })
  })
}
