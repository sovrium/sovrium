/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lockedOnRecord } from '@/presentation/design/locks-verdict'
import type { RecordDrawerField, RawRecord } from './record-drawer-field'
import type { ReactElement } from 'react'

/**
 * Why an editable drawer draws some of its fields as values: the message of
 * each lock rule holding one of them on the record (its `_locks`), once each,
 * one per line — two rules' sentences run together read as one muddled one.
 * Quiet, like a sheet description: a locked record is a state, not an error.
 * Nothing when no field is held, or no lock gives a message.
 */
export function DrawerLockNotice({
  fields,
  record,
}: {
  readonly fields: ReadonlyArray<RecordDrawerField>
  readonly record: RawRecord
}): ReactElement | undefined {
  const reasons = [
    ...new Set(
      fields.flatMap((field) => {
        const reason = lockedOnRecord(record, field.name)?.reason
        return reason === undefined ? [] : [reason]
      })
    ),
  ]
  if (reasons.length === 0) return undefined
  return (
    <p
      data-lock-notice=""
      className="text-muted-foreground flex flex-col gap-0.5 text-sm"
    >
      {reasons.map((reason) => (
        <span key={reason}>{reason}</span>
      ))}
    </p>
  )
}
