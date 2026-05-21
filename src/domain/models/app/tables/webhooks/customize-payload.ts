/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { WebhookPayload } from './payload'

export interface CustomizedWebhookData {
  readonly record: Record<string, unknown>
  readonly previousValues?: Record<string, unknown>
  readonly changedFields?: ReadonlyArray<string>
}

const ALWAYS_KEPT = 'id'

const filterFields = (
  record: Record<string, unknown>,
  payload: WebhookPayload | undefined
): Record<string, unknown> => {
  if (payload?.includeFields) {
    const allowed = new Set<string>([ALWAYS_KEPT, ...payload.includeFields])
    return Object.fromEntries(Object.entries(record).filter(([key]) => allowed.has(key)))
  }
  if (payload?.excludeFields) {
    const blocked = new Set(payload.excludeFields.filter((field) => field !== ALWAYS_KEPT))
    return Object.fromEntries(Object.entries(record).filter(([key]) => !blocked.has(key)))
  }
  return record
}

const computeChangedFields = (
  current: Record<string, unknown>,
  previous: Record<string, unknown>
): ReadonlyArray<string> =>
  Object.keys(current).filter((key) => {
    if (key === ALWAYS_KEPT) return false
    return JSON.stringify(current[key]) !== JSON.stringify(previous[key])
  })

export const customizeWebhookData = (input: {
  readonly record: Record<string, unknown>
  readonly payload: WebhookPayload | undefined
  readonly event: 'create' | 'update' | 'delete'
  readonly previousRecord?: Record<string, unknown> | undefined
}): CustomizedWebhookData => {
  const { record, payload, event, previousRecord } = input
  const { createdAt, updatedAt, ...rest } = record

  const withMetadata = payload?.includeMetadata
    ? {
        ...rest,
        ...(createdAt !== undefined ? { createdAt } : {}),
        ...(updatedAt !== undefined ? { updatedAt } : {}),
      }
    : rest

  const filteredRecord = filterFields(withMetadata, payload)

  if (event !== 'update' || !payload?.includePreviousValues || !previousRecord) {
    return { record: filteredRecord }
  }

  const changedFields = computeChangedFields(rest, previousRecord)
  const previousValues = Object.fromEntries(changedFields.map((key) => [key, previousRecord[key]]))
  return { record: filteredRecord, previousValues, changedFields }
}
