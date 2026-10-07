/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The webhook dispatchers every door that writes a record hands the shared
 * record-write orchestrations (`record-create-orchestration.ts`,
 * `record-update-orchestration.ts`, `record-delete-orchestration.ts`): the
 * records API, the native forms and the MCP tools. Each is total: the
 * dispatcher catches every failure itself, so a webhook endpoint that is down,
 * slow or missing never fails the write that fired it.
 */

import { Effect } from 'effect'
import { triggerTableWebhooks } from './table-webhook-dispatch'
import type { App } from '@/domain/models/app'

type Row = Readonly<Record<string, unknown>>

/** What an update hands its webhooks: the row as written, and as it stood before. */
interface UpdateWebhookPayload {
  readonly record: Row
  readonly previousRecord: Row | undefined
}

/** What a create hands its webhooks: the record as written. */
interface CreateWebhookPayload {
  readonly record: Row
}

const tableOf = (app: App, tableName: string) => app.tables?.find((t) => t.name === tableName)

/** Deliver a table's update webhooks. */
export const updateWebhooksFor =
  (app: App, tableName: string) =>
  (payload: UpdateWebhookPayload): Effect.Effect<void> =>
    // effect-promise: total -- `triggerTableWebhooks` wraps its whole dispatch in a try/catch; a webhook endpoint that is down, slow or missing must never fail the record write that fired it.
    Effect.promise(() =>
      triggerTableWebhooks({
        table: tableOf(app, tableName),
        appEnv: app.env,
        event: 'update',
        record: { ...payload.record },
        previousRecord:
          payload.previousRecord === undefined ? undefined : { ...payload.previousRecord },
      })
    )

/** Deliver a table's create webhooks. */
export const createWebhooksFor =
  (app: App, tableName: string) =>
  (payload: CreateWebhookPayload): Effect.Effect<void> =>
    // effect-promise: total -- `triggerTableWebhooks` wraps its whole dispatch in a try/catch; a webhook endpoint that is down, slow or missing must never fail the record write that fired it.
    Effect.promise(() =>
      triggerTableWebhooks({
        table: tableOf(app, tableName),
        appEnv: app.env,
        event: 'create',
        record: { ...payload.record },
      })
    )

/** Deliver a table's delete webhooks, handed the row as it stood before the delete. */
export const deleteWebhooksFor =
  (app: App, tableName: string) =>
  (record: Row): Effect.Effect<void> =>
    // effect-promise: total -- `triggerTableWebhooks` wraps its whole dispatch in a try/catch; a webhook endpoint that is down, slow or missing must never fail the record write that fired it.
    Effect.promise(() =>
      triggerTableWebhooks({
        table: tableOf(app, tableName),
        appEnv: app.env,
        event: 'delete',
        record: { ...record },
      })
    )
