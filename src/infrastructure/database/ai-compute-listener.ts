/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer } from 'effect'
import { AiService } from '@/application/ports/services/ai-service'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { AiLive } from '@/infrastructure/ai/layer'
import { Database, type DatabaseService } from '@/infrastructure/database/drizzle/layer'
import { isAiComputeFieldType } from '@/infrastructure/database/generators/ai-field-triggers'
import { AiComputeStatusRepositoryLive } from '@/infrastructure/database/repositories/ai/ai-compute-status-repository-live'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import {
  makePgNotifyListenerLayer,
  type PgNotifyListenerDriver,
  type PgNotifyListenerStatus,
  type PgNotifySubscription,
} from './pg-notify-listener'
import type { AiComputeRefine } from '@/application/ports/contracts/ai-compute-refine'
import type { App } from '@/domain/models/app'
import type { AiComputeKind } from '@/domain/models/app/tables/ai-compute-baseline'
import type { AiComputeRequestConfig } from '@/domain/models/app/tables/ai-compute-build-request'

/**
 * Payload emitted by the ai-* compute triggers via pg_notify.
 *
 * The `kind` discriminator selects the per-kind request builder. `record_id`
 * locates the row for the refinement write-back — the trigger
 * is a BEFORE INSERT/UPDATE trigger, so `NEW.id` is already populated (the
 * SERIAL default is evaluated before BEFORE-row triggers fire). `value` is the
 * deterministic baseline; `source` is the concatenated source content.
 */
interface AiComputePayload {
  readonly kind?:
    'categorize' | 'summary' | 'translate' | 'extract' | 'sentiment' | 'generate' | 'tag'
  readonly table: string
  readonly field: string
  readonly record_id?: string | number
  readonly value: string | undefined
  readonly source: string
  readonly categories?: readonly string[]
  readonly prompt?: string | null
  readonly systemPrompt?: string | null
  readonly model?: string | null
  readonly temperature?: number | null
  readonly maxLength?: number | null
  readonly maxTokens?: number | null
  readonly targetLanguage?: string
  /** Serialised JSON Schema describing the structure of extracted data (ai-extract). */
  readonly schema?: string
}

/** Channel name for AI-compute refinement notifications. */
const CHANNEL = 'sovrium_ai_compute'

/**
 * AI Compute Listener (the real-AI-provider rule for AI-compute fields — baseline-then-refined).
 *
 * Subscribes to the PostgreSQL `sovrium_ai_compute` channel. The trigger writes
 * the deterministic baseline synchronously inside the INSERT/UPDATE transaction;
 * after it commits, `pg_notify` emits the payload (table/field/record_id/source/
 * config). This listener forwards each event to the shared async worker
 * (`refineAiComputeField`), which calls the real provider and writes the refined
 * value back ORIGIN-MARKED (realtime broadcasts; automations/webhooks do NOT
 * re-fire). The worker shares the override re-check, status writes, and provider
 * call with the SQLite `Effect.tap` path — the only engine difference is the
 * trigger mechanism (NOTIFY vs tap).
 *
 * PostgreSQL cannot make outbound HTTP calls from PL/pgSQL, so splitting the
 * work keeps the INSERT fully synchronous while the refinement runs out-of-band.
 *
 * SQLite has no PL/pgSQL triggers / `pg_notify` / `LISTEN`, so this listener is
 * a PostgreSQL-only feature; the SQLite refinement is enqueued from the write
 * seam directly.
 *
 * The connection itself — a scoped `pg` client, `LISTEN`/`UNLISTEN`, the
 * connect deadline — is `makePgNotifyListenerLayer` (`pg-notify-listener.ts`),
 * shared with the knowledge listener; this module keeps the gate and the
 * payload handling.
 */
export class AiComputeListener extends Context.Service<AiComputeListener, PgNotifyListenerStatus>()(
  'AiComputeListener'
) {}

/**
 * Does this app have any reason to listen?
 *
 * A Postgres URL, at least one AI-compute field in the schema, and a
 * configured AI provider. Each miss is a silent skip — the synchronous
 * PL/pgSQL trigger still writes the baseline, so an unconfigured provider
 * degrades rather than fails.
 */
const shouldListen = (
  app: App | undefined,
  refine: AiComputeRefine
): Effect.Effect<PgNotifySubscription | undefined, never, Database> =>
  Effect.gen(function* () {
    if (app === undefined) return undefined
    // The listener needs PL/pgSQL triggers + `pg_notify` — Postgres only.
    const dialect = parseDatabaseDialectConfig(yield* ProcessEnv)
    if (dialect.dialect !== 'postgres' || !dialect.databaseUrl) return undefined
    const hasAiComputeField = (app.tables ?? []).some((table) =>
      table.fields.some((field) => isAiComputeFieldType(field.type))
    )
    if (!hasAiComputeField) return undefined
    const aiService = yield* AiService
    if (!aiService.isConfigured()) return undefined
    const appId = app.name
    const database = yield* Database
    return {
      databaseUrl: dialect.databaseUrl,
      onPayload: (raw: string) => handlePayload(refine, database, appId, raw),
    }
  }).pipe(Effect.provide(AiLive))

/**
 * The `pg` boundary, injectable so the acquire/release contract can be unit
 * tested without `mock.module`. Nothing in production passes a driver.
 */
export type AiComputeListenerDriver = PgNotifyListenerDriver

/**
 * The live listener, scoped to the layer that builds it.
 *
 * `app` is optional so the layer is nameable from a runtime built without a
 * config (`createDomainRuntime(undefined)`, which the unit tests use): with no
 * app there is nothing to listen for, and the layer resolves inert.
 *
 * `refine` is the application's refinement worker (`refineAiComputeField`),
 * handed in by the server's composition root so this listener imports no
 * use-case of its own. The status store reads the `Database` of the runtime
 * that holds the listener, so a payload landing after a stop reopens nothing.
 */
export const makeAiComputeListenerLayer = (
  app: App | undefined,
  refine: AiComputeRefine,
  driver?: AiComputeListenerDriver
): Layer.Layer<AiComputeListener, never, Database> =>
  makePgNotifyListenerLayer(AiComputeListener, {
    channel: CHANNEL,
    label: '[ai-compute]',
    shouldListen: shouldListen(app, refine),
    // Silent beyond a debug line — the synchronous trigger still computes values without us.
    onOpenFailure: () => logDebug('[ai-compute] listener could not connect — baseline only'),
    ...(driver === undefined ? {} : { driver }),
  })

const handlePayload = async (
  refine: AiComputeRefine,
  database: DatabaseService,
  appId: string,
  raw: string
): Promise<void> => {
  const payload = parsePayload(raw)
  if (!payload || payload.record_id === undefined || payload.record_id === null) return

  const kind = resolveKind(payload.kind)
  const config = toRequestConfig(payload)

  const program = refine({
    appId,
    tableName: payload.table,
    recordId: String(payload.record_id),
    fieldName: payload.field,
    kind,
    source: payload.source,
    baselineValue: payload.value,
    config,
  })

  const result = await Effect.runPromise(
    program.pipe(
      Effect.provide(
        Layer.mergeAll(
          AiLive,
          Layer.provide(AiComputeStatusRepositoryLive, Layer.succeed(Database, database))
        )
      ),
      Effect.result
    )
  )
  if (result._tag === 'Failure') {
    logError('[ai-compute] refinement program failed', result.failure)
  }
}

/** Map the NOTIFY `kind` discriminator to the canonical field-type literal. */
const resolveKind = (kind: AiComputePayload['kind']): AiComputeKind => {
  switch (kind) {
    case 'summary':
      return 'ai-summary'
    case 'translate':
      return 'ai-translate'
    case 'extract':
      return 'ai-extract'
    case 'sentiment':
      return 'ai-sentiment'
    case 'generate':
      return 'ai-generate'
    case 'tag':
      return 'ai-tag'
    case 'categorize':
    case undefined:
      return 'ai-categorize'
  }
}

/** Project the NOTIFY payload onto the shared request-builder config. */
const toRequestConfig = (payload: AiComputePayload): AiComputeRequestConfig => ({
  prompt: payload.prompt,
  systemPrompt: payload.systemPrompt,
  model: payload.model,
  temperature: payload.temperature,
  maxTokens: payload.maxTokens,
  maxLength: payload.maxLength,
  ...(payload.categories !== undefined ? { categories: payload.categories } : {}),
  ...(payload.targetLanguage !== undefined ? { targetLanguage: payload.targetLanguage } : {}),
  ...(payload.schema !== undefined ? { schema: payload.schema } : {}),
})

const parsePayload = (raw: string): AiComputePayload | undefined => {
  try {
    return JSON.parse(raw) as AiComputePayload
  } catch {
    return undefined
  }
}
