/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ─── Webhook Payload Customization ──────────────────────────────────────────

/**
 * Controls which fields are included in webhook payloads.
 *
 * `includeFields` and `excludeFields` are mutually exclusive.
 *
 * @example
 * ```typescript
 * // Only send specific fields
 * { includeFields: ['customer', 'status', 'total'], includePreviousValues: true }
 *
 * // Send all except internal notes
 * { excludeFields: ['internal-notes'] }
 * ```
 */
export const WebhookPayloadSchema = Schema.Struct({
  /** Only include these fields in the payload (mutually exclusive with excludeFields). */
  includeFields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotate({ description: 'Fields to include in payload (whitelist)' })
    )
  ),

  /** Exclude these fields from the payload (mutually exclusive with includeFields). */
  excludeFields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotate({ description: 'Fields to exclude from payload (blacklist)' })
    )
  ),

  /** Include previous field values on update events (default: false). */
  includePreviousValues: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({ description: 'Include previous values on update events' })
    )
  ),

  /** Include createdAt/updatedAt metadata in record data (default: false). */
  includeMetadata: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({ description: 'Include timestamp metadata in record data' })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'WebhookPayload',
    title: 'Webhook Payload Configuration',
    description: 'Controls field selection and metadata in webhook payloads.',
  }),
  Schema.check(
    Schema.makeFilter((payload) => {
      if (payload.includeFields && payload.excludeFields) {
        return 'includeFields and excludeFields are mutually exclusive — use one or the other'
      }
      return undefined
    })
  )
)

/** @public */
export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>

// ─── Webhook Payload Application ────────────────────────────────────────────

/**
 * The customized `data` block of a webhook payload.
 *
 * `record` always carries the (possibly field-filtered) record. `previousValues`
 * and `changedFields` appear only on update events when `includePreviousValues`
 * is enabled and at least one field actually changed.
 */
export interface CustomizedWebhookData {
  readonly record: Record<string, unknown>
  readonly previousValues?: Record<string, unknown>
  readonly changedFields?: ReadonlyArray<string>
}

/**
 * Field filters never strip the record's `id` — receivers always need a stable
 * key to correlate the event. `includeFields` is a whitelist that implicitly
 * keeps `id` even when `id` is not listed; `excludeFields` is a blacklist that
 * silently ignores any attempt to drop `id`.
 */
const ALWAYS_KEPT = 'id'

/**
 * Apply a webhook's `includeFields` / `excludeFields` selection to a record.
 *
 * - `includeFields`: keep only the listed columns (plus `id`).
 * - `excludeFields`: keep everything except the listed columns (`id` is never
 *   dropped).
 * - Neither set: return the record unchanged.
 *
 * The two filters are mutually exclusive (enforced by `WebhookPayloadSchema`),
 * so at most one branch applies.
 */
const filterFields = (
  record: Readonly<Record<string, unknown>>,
  payload: WebhookPayload | undefined
): Readonly<Record<string, unknown>> => {
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

/**
 * Compute the subset of fields whose value changed between `previous` and
 * `current`. Only keys present in `current` are considered — a field absent
 * from the update body is never reported as changed. Equality is structural
 * via JSON serialization, which is sufficient for the scalar/JSON column
 * values a record carries.
 */
const computeChangedFields = (
  current: Readonly<Record<string, unknown>>,
  previous: Readonly<Record<string, unknown>>
): ReadonlyArray<string> =>
  Object.keys(current).filter((key) => {
    if (key === ALWAYS_KEPT) return false
    return JSON.stringify(current[key]) !== JSON.stringify(previous[key])
  })

/**
 * Build the customized `data` block for a webhook delivery.
 *
 * @param input.record - The mutated record (`id` plus column values), already
 *   carrying `createdAt`/`updatedAt` keys when available.
 * @param input.payload - The webhook's `payload` customization config.
 * @param input.event - The CRUD event; `previousValues`/`changedFields` are
 *   only emitted for `'update'`.
 * @param input.previousRecord - The pre-update record values, used to derive
 *   `previousValues` and `changedFields` when `includePreviousValues` is set.
 */
export const customizeWebhookData = (input: {
  readonly record: Record<string, unknown>
  readonly payload: WebhookPayload | undefined
  readonly event: 'create' | 'update' | 'delete'
  readonly previousRecord?: Record<string, unknown> | undefined
}): CustomizedWebhookData => {
  const { record, payload, event, previousRecord } = input
  const { createdAt, updatedAt, ...rest } = record

  // Metadata timestamps are surfaced inside the record only when explicitly
  // requested; by default the record carries column values + id alone.
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

  // Change detection compares column values only — the `createdAt`/`updatedAt`
  // metadata keys are excluded so they never register as "changed" fields.
  const changedFields = computeChangedFields(rest, previousRecord)
  const previousValues = Object.fromEntries(changedFields.map((key) => [key, previousRecord[key]]))
  return { record: filteredRecord, previousValues, changedFields }
}
