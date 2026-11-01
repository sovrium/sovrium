/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { readGateHolds } from '@/domain/models/app/pages/read-state-gate-service'
import type { ReadStateGate } from '@/domain/models/app/pages/components/read-state-gate'

/**
 * The attributes a button's read gates put on it (`hiddenWhenRead`,
 * `disabledWhenRead`): each gate as JSON, which the browser reads after every
 * read (`islands/runtime/read-state.ts`), and the button as it stands before
 * any read has settled — every source is `loading` then. Drawing that state
 * here keeps a button hidden on `loading` from showing until the grid's first
 * answer, and keeps a page whose islands have not mounted yet correct.
 */
/** Whether a gate holds before any read has settled, when every source is `loading`. */
const holdsBeforeRead = (gate: unknown): boolean => readGateHolds(gate as ReadStateGate, 'loading')

export function readGateAttributes(
  component: Readonly<Record<string, unknown>> | undefined
): Record<string, string | boolean> {
  const hidden = component?.['hiddenWhenRead']
  const disabled = component?.['disabledWhenRead']
  return {
    ...(isRecord(hidden) && {
      'data-read-hidden': JSON.stringify(hidden),
      ...(holdsBeforeRead(hidden) && { hidden: true }),
    }),
    ...(isRecord(disabled) && {
      'data-read-disabled-when': JSON.stringify(disabled),
      ...(holdsBeforeRead(disabled) && { 'aria-disabled': 'true', 'data-read-disabled': '' }),
    }),
  }
}
