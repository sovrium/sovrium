/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Record change-event publisher — the Wave-1 publish side of live realtime
 * delivery.
 *
 * Record CRUD handlers call {@link publishRecordChange} after a mutation
 * commits. The event is fanned out to every open SSE connection on the table's
 * channel via the in-memory channel-manager. The matching consumer side is the
 * SSE stream in `subscribe-handlers.ts`.
 *
 * The published payload is shaped by the canonical `realtimeChangeEventSchema`
 * (`src/domain/models/api/realtime/realtime.ts`) so a subscriber can apply it
 * directly without shape translation.
 */

import { publishToChannel } from './channel-manager'

/**
 * Channel-name convention for a table's record-change stream.
 *
 * A subscription to `GET /api/tables/:tableId/subscribe` listens on the same
 * channel name, so publish and subscribe agree on a single key derived from
 * `(appId, tableName)`.
 *
 * The `appId` prefix prevents cross-tenant leakage: two apps that happen to
 * declare a table with the same name (e.g. `users`) get distinct channels and
 * a publish in app-A is never delivered to a subscriber in app-B. The single
 * canonical identifier of an `App` today is `App.name` (npm-package-style,
 * required by `AppSchema`), so callers pass `app.name` as `appId`.
 */
export const tableChannel = (appId: string, tableName: string): string =>
  `app:${appId}:table:${tableName}`

/** The kind of record mutation that produced a change event. */
export type RecordChangeEvent = 'insert' | 'update' | 'delete'

/**
 * The actor that produced a record change ([internal ref] Phase 2, design §5).
 *
 * `'user'` — an ordinary user-originated CRUD write (the default).
 * `'ai-refine'` — the async AI-compute refinement write-back. The realtime
 * channel ALWAYS broadcasts regardless of origin (so a UI can sharpen the value
 * live and optionally label "AI updated this field"); the no-double-fire
 * guarantee for automations/webhooks is structural — the refinement write-back
 * is its own internal UPDATE that simply omits the automation/webhook taps, so
 * it never reaches a handler that would need an `origin` guard.
 */
export type RecordChangeOrigin = 'user' | 'ai-refine'

interface PublishRecordChangeInput {
  /** App-scope identifier for channel namespacing (callers pass `app.name`). */
  readonly appId: string
  readonly tableName: string
  readonly event: RecordChangeEvent
  readonly recordId: string | number
  /** Full (permission-agnostic) record payload — present for insert/update. */
  readonly record?: Record<string, unknown> | undefined
  /** Previous record values — present for update (filter enter/exit detection). */
  readonly oldRecord?: Record<string, unknown> | undefined
  /** Who produced the change. Defaults to `'user'`; the AI refinement write-back passes `'ai-refine'`. */
  readonly origin?: RecordChangeOrigin
}

/**
 * Normalise a raw DB record row into the `{ id, fields }` envelope the
 * `realtimeRecordPayloadSchema` expects. The `id` is lifted out; every other
 * column becomes a `fields` entry.
 */
const toRecordPayload = (
  recordId: string | number,
  raw: Record<string, unknown> | undefined
): Readonly<{ id: string | number; fields: Readonly<Record<string, unknown>> }> | undefined => {
  if (!raw) return undefined
  const { id: _id, ...rest } = raw
  return { id: recordId, fields: rest }
}

/**
 * Publish a record change event to the table's realtime channel.
 *
 * Fire-and-forget and synchronous: pushing onto the in-memory listener set
 * cannot fail in a way that should block the HTTP response, so callers invoke
 * this without awaiting. A table with zero open subscribers is a cheap no-op.
 */
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
