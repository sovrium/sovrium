/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withoutFieldsReadByNoOne } from '@/domain/models/app/tables/field-read-filter-service'
import type { App } from '@/domain/models/app'

/** The envelope a manual retry sends: the stored one, with a fresh timestamp. */
export interface RetryEnvelope {
  readonly event: string
  readonly table: string
  readonly timestamp: string
  readonly data: { readonly record: Readonly<Record<string, unknown>> }
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The stored payload as an object. The delivery log holds it as JSON text, and
 * both engines hand that text back, so it is parsed here; anything that does
 * not parse to an object reads as no payload at all.
 */
const storedEnvelopeOf = (stored: unknown): Readonly<Record<string, unknown>> => {
  if (isObject(stored)) return stored
  if (typeof stored !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(stored)
    return isObject(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Rebuild the envelope a manual retry re-sends from a delivery-log row: its
 * event, table and record as they were sent, under a fresh `timestamp`.
 *
 * A field no role or group may read is dropped from the record again, so a
 * row logged before that rule existed never sends one on retry.
 */
export const rebuildRetryPayload = (input: {
  readonly app: App
  readonly tableName: string
  readonly event: string
  readonly stored: unknown
  readonly timestamp: string
}): RetryEnvelope => {
  const { data, event, table } = storedEnvelopeOf(input.stored)
  const record = isObject(data) && isObject(data['record']) ? data['record'] : {}
  return {
    event: typeof event === 'string' ? event : input.event,
    table: typeof table === 'string' ? table : input.tableName,
    timestamp: input.timestamp,
    data: { record: withoutFieldsReadByNoOne(input.app, input.tableName, record) },
  }
}
