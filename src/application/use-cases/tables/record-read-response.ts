/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { storedRowBlocks } from './disabled-controls-block'
import type { GetRecordResponse } from '@/domain/models/api/tables/tables'
import type { TransformedRecord } from '@/domain/models/app/tables/record-transformer-service'

/** Assemble one records-API single-record answer from its already-read parts. */
export const toGetRecordResponse = (parts: {
  readonly id: string | number
  readonly transformed: TransformedRecord
  readonly fields: Readonly<TransformedRecord['fields']>
  readonly aiCompute: unknown
  readonly display: unknown
  readonly writeOnly: ReturnType<typeof storedRowBlocks>
}): GetRecordResponse => {
  const { id, transformed, fields, aiCompute, display } = parts
  // Fields at the root as flat aliases too (the same pattern as
  // `createRecordProgram`), so `record.fieldName` reads as `record.fields.fieldName`.
  return {
    ...fields,
    // A record id reads as a string on every records-API response.
    id: String(id),
    fields,
    createdAt: transformed.createdAt,
    updatedAt: transformed.updatedAt,
    ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
    ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
    ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
    ...(aiCompute ? { _aiCompute: aiCompute } : {}),
    ...(display === undefined ? {} : { _display: display }),
    ...parts.writeOnly,
  }
}
