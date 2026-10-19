/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  disabledControlIds,
  tableControls,
  type RecordControl,
} from '@/domain/models/app/pages/record-control-service'
import { writeOnlyBlock } from './write-only-presence'

/**
 * The `_disabled` block a records-API answer carries beside `fields`, as a
 * spread: the ids of the controls (`tableControls`) disabled on this record,
 * judged on the STORED row, a column the caller may not read included. Only
 * the ids reach the answer, never the values they were decided on. Empty when
 * no control is disabled, so the key is never an empty array.
 */
export const disabledControlsBlock = (
  controls: readonly RecordControl[],
  record: Readonly<Record<string, unknown>>
): { readonly _disabled?: readonly string[] } => {
  if (controls.length === 0) return {}
  const ids = disabledControlIds(controls, record)
  return ids.length === 0 ? {} : { _disabled: ids }
}

/**
 * Both blocks a records-API answer judges on the STORED row — `_writeOnly`
 * ({@link writeOnlyBlock}) and `_disabled` — as one spread.
 */
export const storedRowBlocks = (
  input: Parameters<typeof writeOnlyBlock>[0] & { readonly tableName: string }
): ReturnType<typeof writeOnlyBlock> & ReturnType<typeof disabledControlsBlock> => ({
  ...writeOnlyBlock(input),
  ...(input.app === undefined
    ? {}
    : disabledControlsBlock(tableControls(input.app, input.tableName), input.record)),
})
