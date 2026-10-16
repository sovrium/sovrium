/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pressable half of a `type: 'button'` field — what it says, and what
 * pressing it does — with no gate of its own and no class merging.
 *
 * Split out of `record-button.tsx` so a surface that has ALREADY decided the
 * button belongs (a record page's `record-field`, decided on the server) mounts
 * it without the condition matcher and the class merger the grid needs: those
 * two cost a lazy island ~100 KB it would never run. `RecordButton` composes
 * this with its `visibleWhen` gate and the host's classes, so every surface
 * still draws and runs the same button.
 */

import { useCallback, useState } from 'react'
import { pendingControlProps } from '@/presentation/design/pending-state'
import { renderPendingContent } from '@/presentation/design/spinner-mark'
import { followAddress } from './follow-address'
import {
  buttonRequestFailed,
  classifyButtonResponse,
  type ButtonStrings,
} from './record-button-outcome'
import { renderToast } from './toast'

/** The button field's config, carried from the table schema to the client. */
export interface RecordButtonConfig {
  readonly label: string
  readonly action: 'url' | 'automation'
  readonly url?: string
  readonly automation?: string
  readonly visibleWhen?: Readonly<Record<string, unknown>>
}

export interface RecordButtonCoreProps {
  readonly config: RecordButtonConfig
  readonly fieldName: string
  /** Table name — required to invoke an automation button. */
  readonly table?: string
  /** Record the button sits on. Absent on a create form, where no record exists yet. */
  readonly recordId?: string
  /** See `RecordButtonProps.onInvoked`. */
  readonly onInvoked?: () => void
  /** The caption while the automation runs, in the page language; English when absent. */
  readonly pendingLabel?: string
  /** The `action.*` words (in-flight caption, the run's outcome) where they differ from English. */
  readonly strings?: ButtonStrings
  /** The button's classes, idle and pending; the defaults below when absent. */
  readonly classFor?: (pending: boolean) => string
}

export const RECORD_BUTTON_CLASS =
  'text-primary hover:bg-primary-subtle rounded px-2 py-1 text-sm disabled:opacity-50'

/**
 * While its run is in flight the button keeps its full ink: the 50 % fade above
 * means "cannot be pressed here", which a pending button is not — it is working.
 */
export const RECORD_BUTTON_PENDING_CLASS = 'text-primary rounded px-2 py-1 text-sm cursor-progress'

const invokeUrl = (table: string, recordId: string, fieldName: string): string =>
  `/api/tables/${encodeURIComponent(table)}/records/${encodeURIComponent(recordId)}/buttons/${encodeURIComponent(fieldName)}`

/** The caption while the run is in flight: the host's, else the page's word, else English. */
const pendingWord = (pendingLabel: string | undefined, strings: ButtonStrings): string =>
  pendingLabel ?? strings?.['action.running'] ?? 'Running…'

export function RecordButtonCore(props: RecordButtonCoreProps): React.ReactNode {
  const { config, fieldName, table, recordId, onInvoked, classFor, strings } = props
  const [pending, setPending] = useState(false)

  const canInvoke = config.action === 'automation' && Boolean(table) && Boolean(recordId)

  const onClick = useCallback(() => {
    if (config.action === 'url') {
      if (config.url) followAddress(config.url)
      return
    }
    if (!table || !recordId || pending) return
    setPending(true)
    void fetch(invokeUrl(table, recordId, fieldName), { method: 'POST' })
      .then((response) => classifyButtonResponse(response, strings))
      .catch(() => buttonRequestFailed(strings))
      .then((outcome) => {
        // The outcome goes to the shared toaster — an `aria-live` region — so
        // it is announced rather than left in a `title` attribute that only a
        // hovering mouse ever finds.
        renderToast(outcome.message, outcome.variant)
        if (outcome.changed) onInvoked?.()
      })
      .finally(() => {
        setPending(false)
      })
  }, [config.action, config.url, table, recordId, fieldName, onInvoked, pending, strings])

  const disabled = config.action === 'automation' && !canInvoke
  const className =
    classFor?.(pending) ?? (pending ? RECORD_BUTTON_PENDING_CLASS : RECORD_BUTTON_CLASS)

  return (
    <button
      type="button"
      className={className}
      data-button-field={fieldName}
      data-button-action={config.action}
      disabled={disabled}
      {...pendingControlProps(pending)}
      onClick={onClick}
    >
      {pending ? renderPendingContent(pendingWord(props.pendingLabel, strings)) : config.label}
    </button>
  )
}
