/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements */

import { Effect } from 'effect'
import { Client } from 'pg'
// eslint-disable-next-line boundaries/dependencies -- The NOTIFY listener is a boot-time composition root that wires the shared refinement use case into the Postgres LISTEN/NOTIFY callback, exactly analogous to how infrastructure-scheduling wires `run-cron-automation` into the cron callback (boundaries.config.ts grants that the use-case allowance for the same reason). The use case is the dispatch contract; the listener is the only point where a `pg_notify` event can be observed.
import { refineAiComputeField } from '@/application/use-cases/ai-compute/refine-field'
import { pinPostgresSslMode } from '@/domain/utils/database/postgres-ssl-mode'
import { AiLive } from '@/infrastructure/ai/layer'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import { isSqliteRuntime } from './unsupported-in-sqlite'
import type { AiComputeKind } from '@/domain/services/ai-compute/baseline'
import type { AiComputeRequestConfig } from '@/domain/services/ai-compute/build-request'

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
 */
export class AiComputeListener {
  private client: Client | undefined = undefined
  private stopped = false

  constructor(
    private readonly databaseUrl: string,
    private readonly appId: string
  ) {}

  async start(): Promise<void> {
    if (isSqliteRuntime()) {
      logDebug('[ai-compute] listener disabled — requires PostgreSQL (SQLite runtime)')
      return
    }

    const client = new Client({ connectionString: pinPostgresSslMode(this.databaseUrl) })
    await client.connect()
    this.client = client

    client.on('notification', (msg) => {
      if (msg.channel !== 'sovrium_ai_compute' || !msg.payload) return
      // Fire-and-forget: refinement is best-effort and must never crash the
      // server on a transient provider failure.
      this.handlePayload(msg.payload).catch((error: unknown) => {
        logError('[ai-compute] payload handler error', error)
      })
    })

    client.on('error', () => {
      // Connection errors are recoverable on the next restart; silently ignore
      // so the server does not crash while tests tear down.
    })

    await client.query('LISTEN sovrium_ai_compute')
  }

  async stop(): Promise<void> {
    this.stopped = true
    const { client } = this
    this.client = undefined
    if (client) {
      try {
        await client.query('UNLISTEN sovrium_ai_compute')
      } catch {
        // Best-effort cleanup
      }
      try {
        await client.end()
      } catch {
        // Best-effort cleanup
      }
    }
  }

  private async handlePayload(raw: string): Promise<void> {
    if (this.stopped) return

    const payload = parsePayload(raw)
    if (!payload || payload.record_id === undefined || payload.record_id === null) return

    const kind = resolveKind(payload.kind)
    const config = toRequestConfig(payload)

    const program = refineAiComputeField({
      appId: this.appId,
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
