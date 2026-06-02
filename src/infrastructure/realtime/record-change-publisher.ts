/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { publishToChannel } from './channel-manager'

export const tableChannel = (appId: string, tableName: string): string =>
  `app:${appId}:table:${tableName}`

export type RecordChangeEvent = 'insert' | 'update' | 'delete'

export type RecordChangeOrigin = 'user' | 'ai-refine'

interface PublishRecordChangeInput {
  readonly appId: string
  readonly tableName: string
  readonly event: RecordChangeEvent
  readonly recordId: string | number
  readonly record?: Record<string, unknown> | undefined
  readonly oldRecord?: Record<string, unknown> | undefined
  readonly origin?: RecordChangeOrigin
}

const toRecordPayload = (
  recordId: string | number,
  raw: Record<string, unknown> | undefined
): Readonly<{ id: string | number; fields: Readonly<Record<string, unknown>> }> | undefined => {
  if (!raw) return undefined
  const { id: _id, ...rest } = raw
  return { id: recordId, fields: rest }
}

export const publishRecordChange = (input: PublishRecordChangeInput): void => {
  const { appId, tableName, event, recordId, record, oldRecord, origin } = input
  const changeEvent: Record<string, unknown> = {
    type: 'change',
    event,
    table: tableName,
    recordId,
    timestamp: new Date().toISOString(),
    ...(record !== undefined ? { record: toRecordPayload(recordId, record) } : {}),
    ...(oldRecord !== undefined ? { oldRecord: toRecordPayload(recordId, oldRecord) } : {}),
    ...(origin !== undefined ? { origin } : {}),
  }
  publishToChannel(tableChannel(appId, tableName), changeEvent)
}
