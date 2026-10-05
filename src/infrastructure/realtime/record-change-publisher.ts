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
 * Every record write reaches {@link publishRecordChanges} once it commits —
 * through `RecordChangeFeedLive`, which the write programs announce to — and
 * its events are fanned out to every open SSE stream and WebSocket on the
 * table's channel via the in-memory channel-manager. The matching consumer
 * side is `subscribe-handlers.ts`.
 *
 * The published payload follows the canonical `realtimeChangeEventSchema`
 * (`src/domain/models/api/realtime/realtime.ts`), but it is the UNSCOPED
 * event: each subscriber's transport translates it before anything is sent —
 * the row is judged against that subscriber's row-level read rule, its fields
 * are cut to the columns they may read and then to their own `?fields=`
 * selection, relationship values are sent as strings, and a WebSocket frame is
 * reshaped into the wire message. A subscriber therefore never receives this
 * payload as published.
 */

import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'
import {
  planAnnouncements,
  type AnnouncedRowChange,
} from '@/domain/models/app/tables/realtime-announcement-service'
import { RESYNC_ROWS_KEY } from '@/domain/models/app/tables/realtime-row-scope-service'
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
  /**
   * Previous record values — present for update (filter enter/exit detection)
   * and for delete (the row each subscriber's read rule is judged on; stripped
   * before delivery).
   */
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
  recordId: string,
  raw: Readonly<Record<string, unknown>> | undefined
): Readonly<{ id: string; fields: Readonly<Record<string, unknown>> }> | undefined => {
  if (!raw) return undefined
  const { id: _id, ...rest } = raw
  return { id: recordId, fields: rest }
}

/** Publish one row's change event on its table's channel. */
const publishRowChange = (input: PublishRecordChangeInput): void => {
  const { appId, tableName, event, record, oldRecord, origin } = input
  // The id as the records API names it — a string on every event, whether the
  // caller handed over the API record (create) or a driver row (delete).
  const recordId = String(input.recordId)
  const changeEvent: Readonly<Record<string, unknown>> = {
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

/**
 * Publish everything one write changed, on each touched table's channel — the
 * single publishing point every record write reaches.
 *
 * Per table, a write that changed at most
 * `REALTIME_TRANSPORT_CONFIG.maxChangeEventsPerWrite` rows is announced one
 * `change` event per row; past that, one `resync` notice carrying the changed
 * rows for each subscriber's read rule to be judged on (the subscription
 * strips them before anything reaches the wire). See `planAnnouncements`.
 *
 * Fire-and-forget and synchronous: pushing onto the in-memory listener set
 * cannot fail in a way that should block the write's response. A table with
 * zero open subscribers is a cheap no-op.
 */
export const publishRecordChanges = (input: {
  readonly appId: string
  readonly changes: readonly AnnouncedRowChange[]
  readonly origin?: RecordChangeOrigin
}): void => {
  const { appId, changes, origin } = input
  const plan = planAnnouncements(changes, REALTIME_TRANSPORT_CONFIG.maxChangeEventsPerWrite)
  plan.forEach((entry) => {
    if (entry.kind === 'resync') {
      publishToChannel(tableChannel(appId, entry.tableName), {
        type: 'resync',
        table: entry.tableName,
        reason: 'bulk-change',
        timestamp: new Date().toISOString(),
        [RESYNC_ROWS_KEY]: entry.rows,
      })
      return
    }
    entry.changes.forEach((change) =>
      publishRowChange({
        appId,
        tableName: change.tableName,
        event: change.event,
        recordId: change.recordId,
        record: change.record,
        oldRecord: change.oldRecord,
        ...(origin === undefined ? {} : { origin }),
      })
    )
  })
}

/**
 * Publish a single row's change — a write of one row, through the same
 * publishing point as every other write.
 */
export const publishRecordChange = (input: PublishRecordChangeInput): void => {
  const { appId, tableName, event, record, oldRecord, origin } = input
  publishRecordChanges({
    appId,
    changes: [{ tableName, event, recordId: String(input.recordId), record, oldRecord }],
    ...(origin === undefined ? {} : { origin }),
  })
}
