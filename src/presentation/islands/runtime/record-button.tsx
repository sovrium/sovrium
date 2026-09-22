/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rendered affordance for a `type: 'button'` table field.
 *
 * One component serves every surface a record shows up on — the data-table
 * cell, the CRUD form, and the record drawer — because a button field means
 * the same thing in all three and a per-surface copy would drift.
 *
 * It is a real `<button>`, never an anchor, on both branches. A `url` button
 * is an action the author attached to a record, not a document link: it reads
 * as a button, sits in a button's tab order, and is found as one by assistive
 * technology.
 */

import { useCallback, useState } from 'react'
import { satisfiesFieldCondition } from '@/domain/models/app/tables/condition-operators'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { BUTTON_REQUEST_FAILED, classifyButtonResponse } from './record-button-outcome'
import { renderToast } from './toast'

/** The button field's config, carried from the table schema to the client. */
export interface RecordButtonConfig {
  readonly label: string
  readonly action: 'url' | 'automation'
  readonly url?: string
  readonly automation?: string
  readonly visibleWhen?: Readonly<Record<string, unknown>>
}

export interface RecordButtonProps {
  readonly config: RecordButtonConfig
  readonly fieldName: string
  /** Table name — required to invoke an automation button. */
  readonly table?: string
  /** Record the button sits on. Absent on a create form, where no record exists yet. */
  readonly recordId?: string
  /** Record values, used to evaluate `visibleWhen`. Absent means "no gate to apply". */
  readonly record?: Readonly<Record<string, unknown>>
  readonly className?: string
  /**
   * Called once a run has got far enough to have touched the record, so the
   * host surface can re-read whatever it is showing.
   *
   * Optional on purpose. A button whose automation writes back to its own row
   * leaves a listing showing pre-run data, but only one of this component's
   * three surfaces — the data-table cell — has a query cache to invalidate.
   * Taking the refresh as a callback keeps that surface's knowledge in that
   * surface: the CRUD form and the record drawer simply pass nothing, and the
   * button never has to assume a query client is in scope.
   */
  readonly onInvoked?: () => void
}

const BASE_CLASS =
  'text-primary hover:bg-primary-subtle rounded px-2 py-1 text-sm disabled:opacity-50'

const invokeUrl = (table: string, recordId: string, fieldName: string): string =>
  `/api/tables/${encodeURIComponent(table)}/records/${encodeURIComponent(recordId)}/buttons/${encodeURIComponent(fieldName)}`

/**
 * A button field renders only on records satisfying its `visibleWhen`
 * predicate. Evaluated through the shared domain matcher — the same one a
 * data-table action column spends — so the two grammars cannot drift.
 *
 * With no record in hand there is nothing to evaluate against, so the button
 * renders: a create form has no row to test, and hiding it there would make
 * the affordance vanish for reasons the author never asked for.
 */
function passesVisibilityGate(props: RecordButtonProps): boolean {
  if (!props.record) return true
  return satisfiesFieldCondition(
    props.config.visibleWhen as Parameters<typeof satisfiesFieldCondition>[0],
    props.record
  )
}

export function RecordButton(props: RecordButtonProps): React.ReactNode {
  const { config, fieldName, table, recordId, className, onInvoked } = props
  const [pending, setPending] = useState(false)

  const canInvoke = config.action === 'automation' && Boolean(table) && Boolean(recordId)

  const onClick = useCallback(() => {
    if (config.action === 'url') {
      if (config.url) window.location.assign(config.url)
      return
    }
    if (!table || !recordId) return
    setPending(true)
    void fetch(invokeUrl(table, recordId, fieldName), { method: 'POST' })
      .then(classifyButtonResponse)
      .catch(() => BUTTON_REQUEST_FAILED)
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
  }, [config.action, config.url, table, recordId, fieldName, onInvoked])

  if (!passesVisibilityGate(props)) return undefined

  const disabled = pending || (config.action === 'automation' && !canInvoke)

  return (
    <button
      type="button"
      className={resolveClasses(BASE_CLASS, className)}
      data-button-field={fieldName}
      data-button-action={config.action}
      disabled={disabled}
      onClick={onClick}
    >
      {config.label}
    </button>
  )
}
