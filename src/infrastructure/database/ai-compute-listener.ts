/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements */

import { Context, Effect, Layer } from 'effect'
import { Client } from 'pg'
import { AiService } from '@/application/ports/services/ai-service'
// eslint-disable-next-line boundaries/dependencies -- The NOTIFY listener is a boot-time composition root that wires the shared refinement use case into the Postgres LISTEN/NOTIFY callback, exactly analogous to how infrastructure-scheduling wires `run-cron-automation` into the cron callback (boundaries.config.ts grants that the use-case allowance for the same reason). The use case is the dispatch contract; the listener is the only point where a `pg_notify` event can be observed.
import { refineAiComputeField } from '@/application/use-cases/ai-compute/refine-field'
import { pinPostgresSslMode } from '@/domain/kernel/sql/postgres-ssl-mode'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { AiLive } from '@/infrastructure/ai/layer'
import { isAiComputeFieldType } from '@/infrastructure/database/generators/ai-field-triggers'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { AiComputeKind } from '@/domain/models/app/tables/ai-compute-baseline'
import type { AiComputeRequestConfig } from '@/domain/models/app/tables/ai-compute-build-request'

/**
 * Payload emitted by the ai-* compute triggers via pg_notify.
 *
 * The `kind` discriminator selects the per-kind request builder. `record_id`
 * ([internal ref] Phase 2) locates the row for the refinement write-back — the trigger
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
 * AI Compute Listener ([internal ref] Phase 2 — baseline-then-refined).
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
 * ## The connection is a scoped resource (standing rule E3)
 *
 * This was a mutable class with `start()` / `stop()` and a `private stopped`
 * flag, threaded from `collectInfraPhases` through `createServer`'s return value
 * into `createStopEffect`. Four hops for one connection, and the release
 * happened on the graceful path only. It is now an `Effect.acquireRelease` over
 * the `pg` `Client` inside a `Layer.effect` — which is Effect 4's SCOPED layer
 * constructor; there is no `Layer.scoped`. The scope belongs to the server's
 * domain `ManagedRuntime` (`infrastructure/server/domain-runtime.ts`), disposed
 * in `createStopEffect` after the socket drain, so the connection closes on
 * success, on failure and on interruption alike.
 *
 * The service value carries {@link AiComputeListenerStatus} rather than nothing:
 * a layer providing `never` cannot be named in a merged list, and "did this boot
 * actually LISTEN?" is the one fact a caller (or a test) wants from it.
 */
export class AiComputeListener extends Context.Service<
  AiComputeListener,
  AiComputeListenerStatus
>()('AiComputeListener') {}

/** What a built listener layer reports about itself. */
export interface AiComputeListenerStatus {
  /** `true` only when a `pg` connection is open and `LISTEN` succeeded. */
  readonly listening: boolean
}

const INERT: AiComputeListenerStatus = { listening: false }

/**
 * Does this app have any reason to listen?
 *
 * Mirrors the old `resolveAiComputeListener`: a Postgres URL, at least one
 * AI-compute field in the schema, and a configured AI provider. Each miss is a
 * silent skip — the synchronous PL/pgSQL trigger still writes the baseline, so
 * an unconfigured provider degrades rather than fails.
 */
const shouldListen = (app: App | undefined): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    if (app === undefined) return false
    // The listener needs PL/pgSQL triggers + `pg_notify` — Postgres only.
    const dialect = parseDatabaseDialectConfig()
    if (dialect.dialect !== 'postgres' || !dialect.databaseUrl) return false
    const hasAiComputeField = (app.tables ?? []).some((table) =>
      table.fields.some((field) => isAiComputeFieldType(field.type))
    )
    if (!hasAiComputeField) return false
    const aiService = yield* AiService
    return aiService.isConfigured()
  }).pipe(Effect.provide(AiLive))

/**
 * Open the connection and subscribe, or resolve `undefined`.
 *
 * Never rejects: a listener that cannot connect is a degraded AI-compute
 * pipeline, not a failed boot — the trigger's baseline is still written. The
 * `catch` therefore has to be here rather than in the caller, because this
 * thunk is the acquire half of an `Effect.acquireRelease` and a rejecting
 * acquire would take the whole layer build down with it.
 */
const connect = async (
  databaseUrl: string,
  handle: (raw: string) => void
): Promise<Client | undefined> => {
  const client = new Client({ connectionString: pinPostgresSslMode(databaseUrl) })
  try {
    await client.connect()
    client.on('notification', (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return
      handle(msg.payload)
    })
    client.on('error', () => {
      // Connection errors are recoverable on the next restart; silently ignore
      // so the server does not crash while tests tear down.
    })
    await client.query(`LISTEN ${CHANNEL}`)
    return client
  } catch {
    await client.end().catch(() => undefined)
    return undefined
  }
}

/** `UNLISTEN` then close. Best-effort on both, and never rejects. */
// eslint-disable-next-line functional/prefer-immutable-types -- pg's `Client` is an inherently mutable driver handle; a `Readonly<Client>` would refuse the `query`/`end` calls that ARE the release
const disconnect = async (client: Client): Promise<void> => {
  await client.query(`UNLISTEN ${CHANNEL}`).catch(() => undefined)
  await client.end().catch(() => undefined)
}

/**
 * The `pg` boundary as one injectable pair.
 *
 * Exported, and taken as a parameter by {@link makeAiComputeListenerLayer},
 * so the acquire/release contract can be driven by a unit test without
 * `mock.module` — which contaminates Bun's process-global module cache for
 * every later test file (`@docs/infrastructure/testing/bun-test.md`). Nothing
 * in production passes anything but {@link liveDriver}.
 */
export interface AiComputeListenerDriver {
  readonly open: (databaseUrl: string, handle: (raw: string) => void) => Promise<Client | undefined>
  // eslint-disable-next-line functional/prefer-immutable-types -- pg's `Client` is an inherently mutable driver handle; a `Readonly<Client>` would refuse the `query`/`end` calls that ARE the release
  readonly close: (client: Client) => Promise<void>
}

const liveDriver: AiComputeListenerDriver = { open: connect, close: disconnect }

/**
 * The live listener, scoped to the layer that builds it.
 *
 * `app` is optional so the layer is nameable from a runtime built without a
 * config (`createDomainRuntime(undefined)`, which the unit tests use): with no
 * app there is nothing to listen for, and the layer resolves inert.
 */
export const makeAiComputeListenerLayer = (
  app: App | undefined,
  driver: AiComputeListenerDriver = liveDriver
): Layer.Layer<AiComputeListener> =>
  Layer.effect(
    AiComputeListener,
    Effect.gen(function* () {
      if (!(yield* shouldListen(app)) || app === undefined) return INERT
      const dialect = parseDatabaseDialectConfig()
      const databaseUrl = dialect.dialect === 'postgres' ? dialect.databaseUrl : ''
      const appId = app.name

      const client = yield* Effect.acquireRelease(
        // effect-promise: total -- `connect` catches its own rejections and resolves `undefined`; see its doc comment.
        Effect.promise(() =>
          driver.open(databaseUrl, (raw) => {
            // Fire-and-forget: refinement is best-effort and must never crash
            // the server on a transient provider failure.
            void handlePayload(appId, raw).catch((error: unknown) => {
              logError('[ai-compute] payload handler error', error)
            })
          })
        ),
        // effect-promise: total -- `disconnect` swallows both cleanup rejections.
        (open) => (open === undefined ? Effect.void : Effect.promise(() => driver.close(open)))
      )

      if (client === undefined) {
        // Silent — the synchronous trigger still computes values without us.
        logDebug('[ai-compute] listener could not connect — baseline only')
        return INERT
      }
      return { listening: true }
    })
  )

const handlePayload = async (appId: string, raw: string): Promise<void> => {
  const payload = parsePayload(raw)
  if (!payload || payload.record_id === undefined || payload.record_id === null) return

  const kind = resolveKind(payload.kind)
  const config = toRequestConfig(payload)

  const program = refineAiComputeField({
    appId,
    tableName: payload.table,
    recordId: String(payload.record_id),
    fieldName: payload.field,
    kind,
    source: payload.source,
    baselineValue: payload.value,
    config,
  })

  const result = await Effect.runPromise(program.pipe(Effect.provide(AiLive), Effect.result))
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
