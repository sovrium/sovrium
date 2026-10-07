/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { recordEventLoopRefusal } from './record-events'
import { findMultiSelectViolationMessage } from './shared'
import type { ActionOutcome, ActionRunContext } from './shared'
import type { App } from '@/domain/models/app'

/**
 * The refusal a `record/update` meets before it spends a query, else
 * `undefined`:
 *
 * - it names no row — neither an `id` nor a `filter`. Only a code call can
 *   reach this (the declarative schema requires a `filter`), and the update
 *   fails rather than report a success that changed nothing;
 * - its payload breaks a multi-select field's membership or cardinality
 *   (checked on the raw payload, before the target lookup, so the answer does
 *   not depend on whether the filter matched);
 * - it would write back into the record event that started the run.
 */
export const recordUpdatePrecheck = (input: {
  readonly app: App
  readonly props: Readonly<Record<string, unknown>>
  readonly id: string | undefined
  readonly tableName: string
  readonly data: Readonly<Record<string, unknown>>
  readonly runContext: ActionRunContext | undefined
}): ActionOutcome | undefined => {
  const { app, props, id, tableName, data, runContext } = input
  if ((id === undefined || id === '') && props['filter'] === undefined) {
    return {
      status: 'failure',
      error: 'record.update requires an id or a filter naming the rows to change',
    }
  }
  const multiSelectError = findMultiSelectViolationMessage(app, tableName, data)
  if (multiSelectError) return { status: 'failure', error: multiSelectError }
  return recordEventLoopRefusal(runContext, tableName, 'update', Object.keys(data))
}
