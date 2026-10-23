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

import { satisfiesFieldCondition } from '@/domain/models/app/tables/condition-match-service'
import { disabledOnRecord } from '@/presentation/design/disabled-verdict'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  RECORD_BUTTON_CLASS,
  RECORD_BUTTON_PENDING_CLASS,
  RecordButtonCore,
  type RecordButtonConfig,
} from './record-button-core'

export type { RecordButtonConfig } from './record-button-core'

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
  /** The caption while the automation runs, in the page language; English when absent. */
  readonly pendingLabel?: string
  /** The `action.*` words in the page language, where they differ from English. */
  readonly strings?: Readonly<Record<string, string>>
}

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
  if (!passesVisibilityGate(props)) return undefined
  const { className, record: _record, ...core } = props
  // Disabled on this record by the server's verdict, its id in the record's `_disabled`.
  const verdict = disabledOnRecord(
    props.record,
    `field:${props.fieldName}`,
    props.config.disabledReason
  )
  return (
    <RecordButtonCore
      {...core}
      {...(verdict === undefined ? {} : { disabledOnRecord: verdict })}
      classFor={(pending) =>
        resolveClasses(pending ? RECORD_BUTTON_PENDING_CLASS : RECORD_BUTTON_CLASS, className)
      }
    />
  )
}
