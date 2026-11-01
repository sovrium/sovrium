/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { recordLocked } from '@/presentation/design/locks-verdict'
import type { FormRecordBinding } from './field-def'
import type { ReactElement } from 'react'

/**
 * Why an edit form draws every control disabled: the message of the lock rule
 * closing its record as a whole (`_locks.fields: '*'`), said once above the
 * fields rather than beside each — the record drawer's notice. Quiet, like a
 * description: a locked record is a state, not an error. Nothing when no lock
 * closes the record, or the lock gives no message.
 */
export function FormLockNotice({
  binding,
}: {
  readonly binding: FormRecordBinding | undefined
}): ReactElement | undefined {
  const reason = recordLocked(binding?.record)?.reason
  if (reason === undefined) return undefined
  return (
    <p
      data-lock-notice=""
      className="text-muted-foreground flex flex-col gap-0.5 text-sm"
    >
      <span>{reason}</span>
    </p>
  )
}
