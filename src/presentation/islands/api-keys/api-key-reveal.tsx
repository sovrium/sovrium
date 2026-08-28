/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The show-once credential panel (F1).
 *
 * WHY THIS IS A COMPONENT AND NOT A DECLARATIVE `onSuccess` KIND — this was
 * investigated and settled, so it is recorded rather than re-derived. The three
 * shipped `onSuccess` effects cannot express it:
 *
 *  - `toast.message` / `status.message` interpolate CONFIGURED `$variable`
 *    references. Neither has any concept of a field of the RESPONSE BODY, so
 *    `response.key` is simply unreachable from config.
 *  - `status` promotes its target to a `role="status"` live region, which would
 *    make a screen reader ANNOUNCE the secret out loud. That is a worse outcome
 *    than not showing it at all.
 *  - The interaction is stateful — reveal, copy, acknowledge, discard — and
 *    `onSuccess` has no state model to hang that on.
 *
 * The panel is deliberately NOT a live region and NOT auto-focused. It is a
 * plain group whose accessible name says what it holds; the operator reads it
 * because they just asked for it.
 */

import { useCallback, useState } from 'react'
import type { ReactElement } from 'react'

interface ApiKeyRevealProps {
  /** The plaintext credential. Held in memory only, never re-fetchable. */
  readonly value: string
  /** Discard the secret — the parent drops it from state, so it leaves the DOM. */
  readonly onDismiss: () => void
}

const PANEL_CLASS =
  'border-border bg-background-raised flex flex-col gap-3 rounded-md border p-4 mt-4'

/**
 * Copy to the clipboard, reporting the outcome inline.
 *
 * `navigator.clipboard` is unavailable on an insecure origin and can be refused
 * by permission policy. A copy button that silently does nothing is worse than
 * one that says it failed, because the operator walks away believing they have
 * the key — so the failure is stated and the value stays selectable.
 */
function useCopy(value: string): readonly [string, () => void] {
  const [state, setState] = useState('')
  const copy = useCallback(() => {
    navigator.clipboard?.writeText(value).then(
      () => setState('Copied to your clipboard.'),
      () => setState('Could not copy — select the key above and copy it manually.')
    )
  }, [value])
  return [state, copy]
}

/**
 * Render the one-time reveal.
 *
 * `data-testid="api-key-reveal"` carries the value as TEXT CONTENT, not as an
 * attribute: an attribute would survive in `page.content()` after dismissal if
 * anything ever cached the node, and the contract is that the secret leaves the
 * document entirely.
 */
export function ApiKeyReveal({ value, onDismiss }: ApiKeyRevealProps): ReactElement {
  const [copyState, copy] = useCopy(value)
  return (
    <div
      role="group"
      aria-label="Your new API key"
      className={PANEL_CLASS}
    >
      <p className="text-foreground text-sm font-medium">
        Copy this key now — it is shown once and cannot be recovered.
      </p>
      <code
        data-testid="api-key-reveal"
        className="border-border bg-background text-foreground overflow-x-auto rounded-md border p-3 font-mono text-sm break-all"
      >
        {value}
      </code>
      {copyState !== '' && <p className="text-foreground-subtle text-xs">{copyState}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="border-border text-foreground hover:bg-background-subtle rounded-md border px-3 py-1.5 text-sm transition-colors"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  )
}
