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
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeFieldDescriptionClasses,
  computeFieldLabelClasses,
} from '@/presentation/design/field-default-classes'
import {
  computeInputGroupActionClasses,
  computeInputGroupAddonClasses,
  computeInputGroupClasses,
  computeInputGroupFieldClasses,
} from '@/presentation/design/input-group-default-classes'
import type { ReactElement } from 'react'

interface ApiKeyRevealProps {
  /** The plaintext credential. Held in memory only, never re-fetchable. */
  readonly value: string
  /** Discard the secret — the parent drops it from state, so it leaves the DOM. */
  readonly onDismiss: () => void
}

const PANEL_CLASS =
  'bg-card text-card-foreground ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 text-sm ring-1'

/** The value, set in the group's field: one mono line that scrolls rather than wraps. */
const VALUE_CLASS = `${computeInputGroupFieldClasses()} flex items-center overflow-x-auto font-mono whitespace-nowrap select-all`

const COPY_ADDON_CLASS = computeInputGroupAddonClasses({ align: 'inline-end' })

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
      <p className={computeFieldLabelClasses()}>
        Copy this key now — it is shown once and cannot be recovered.
      </p>
      <div
        data-slot="input-group"
        role="group"
        aria-label="API key value"
        className={computeInputGroupClasses()}
      >
        <code
          data-testid="api-key-reveal"
          data-slot="input-group-control"
          className={VALUE_CLASS}
        >
          {value}
        </code>
        <div
          data-slot="input-group-addon"
          data-align="inline-end"
          className={COPY_ADDON_CLASS}
        >
          <button
            type="button"
            data-slot="input-group-button"
            onClick={copy}
            className={computeInputGroupActionClasses()}
          >
            Copy
          </button>
        </div>
      </div>
      {copyState !== '' && (
        <p
          role="status"
          className={computeFieldDescriptionClasses()}
        >
          {copyState}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          data-slot="button"
          onClick={onDismiss}
          className={computeButtonDefaultClasses({ size: 'sm' })}
        >
          Done
        </button>
      </div>
    </div>
  )
}
