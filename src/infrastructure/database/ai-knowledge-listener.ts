/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements */

import { Client } from 'pg'
import { pinPostgresSslMode } from '@/domain/utils/database/postgres-ssl-mode'
import { runSyncDocumentsAtStartup } from '@/infrastructure/ai/document-sync'
import {
  buildKnowledgeBindings,
  embedKnowledgeRecord,
  removeKnowledgeRecordEmbeddings,
  runSyncKnowledgeAtStartup,
} from '@/infrastructure/ai/knowledge-sync'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import { isSqliteRuntime } from './unsupported-in-sqlite'
import type { RagAgent } from '@/infrastructure/ai/rag-agent-input'

/**
 * AI Knowledge Listener — auto-embeds table-knowledge on record change.
 *
 * Mirrors {@link AiComputeListener}. PostgreSQL `AFTER INSERT/UPDATE/DELETE`
 * triggers `pg_notify` the `sovrium_ai_knowledge` channel; this listener
 * receives each event and (re)embeds or removes the affected record's
 * embeddings via the eco-routed `AiService` ([internal ref]:
 * [internal ref]).
 *
 * PostgreSQL cannot make outbound HTTP calls from PL/pgSQL, so the trigger
 * is a thin NOTIFY emitter and the embedding round-trip happens here.
 */

/** One agent's interest in a knowledge table — used to fan a change out. */
export interface KnowledgeTableBinding {
  readonly agentName: string
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly filter?: Readonly<Record<string, unknown>>
}

interface KnowledgePayload {
  readonly op: 'INSERT' | 'UPDATE' | 'DELETE'
  readonly table: string
  readonly id: string
}

/** Channel name for knowledge-change notifications. */
const CHANNEL = 'sovrium_ai_knowledge'

/**
 * Build the `CREATE FUNCTION` + `CREATE TRIGGER` DDL for one knowledge table.
 * The trigger fires `AFTER` each row change and emits a compact JSON payload.
 */
const buildTriggerSql = (table: string): readonly string[] => {
  const fn = `sovrium_ai_knowledge_notify_${table}`
  const trig = `sovrium_ai_knowledge_trig_${table}`
  const quoted = `"${table.replace(/"/g, '""')}"`
  return [
    `CREATE OR REPLACE FUNCTION ${fn}() RETURNS trigger AS $$
       DECLARE rec_id text;
       BEGIN
         IF (TG_OP = 'DELETE') THEN rec_id := OLD.id::text;
         ELSE rec_id := NEW.id::text;
         END IF;
         PERFORM pg_notify('${CHANNEL}', json_build_object(
           'op', TG_OP, 'table', '${table}', 'id', rec_id
         )::text);
         IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
       END;
     $$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${trig} ON ${quoted}`,
    `CREATE TRIGGER ${trig} AFTER INSERT OR UPDATE OR DELETE ON ${quoted}
       FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
  ]
}

/**
 * AI knowledge listener. Installs per-table triggers and embeds/cleans up
 * record changes asynchronously. Best-effort: a failure never crashes the
 * server.
 */
export class AiKnowledgeListener {
  private client: Client | undefined = undefined
  private stopped = false

  constructor(
    private readonly databaseUrl: string,
    private readonly bindings: ReadonlyArray<KnowledgeTableBinding>
  ) {}

  /** Distinct knowledge table names across all agent bindings. */
  private get tables(): ReadonlyArray<string> {
    return [...new Set(this.bindings.map((b) => b.table))]
  }

  /** All agent bindings interested in a given table. */
  private bindingsFor(table: string): ReadonlyArray<KnowledgeTableBinding> {
    return this.bindings.filter((b) => b.table === table)
  }

  async start(): Promise<void> {
    if (this.bindings.length === 0) return
    const client = new Client({ connectionString: pinPostgresSslMode(this.databaseUrl) })
    await client.connect()
    this.client = client

    // Install AFTER-change triggers on every knowledge table.
    //
    // Every statement runs sequentially on the one connection. A pg `Client` is
    // a single connection, NOT a pool: overlapping `query()` calls are silently
    // queued in pg@8 (with a deprecation warning) and rejected outright in pg@9.
    // Fanning the tables out concurrently therefore only ever looked parallel —
    // the driver serialised them anyway — while putting the code on a path that
    // breaks at the next major bump.
    //
    // `flatMap` preserves each table's own function → drop → create ordering,
    // which is the ordering that actually matters.
    await this.tables
      .flatMap((table) => buildTriggerSql(table))
      .reduce(
        (chain, stmt) =>
          chain.then(() =>
            client.query(stmt).then(
              () => undefined,
              () => undefined
            )
          ),
        Promise.resolve()
      )

    client.on('notification', (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return
      this.handlePayload(msg.payload).catch((error: unknown) => {
        logError('[ai-knowledge] payload handler error', error)
      })
    })
    client.on('error', () => {
      // Recoverable on next restart — never crash on connection error.
    })
    await client.query(`LISTEN ${CHANNEL}`)
  }

  async stop(): Promise<void> {
    this.stopped = true
    const { client } = this
    this.client = undefined
    if (client) {
      try {
        await client.query(`UNLISTEN ${CHANNEL}`)
      } catch {
        // best-effort
      }
      try {
        await client.end()
      } catch {
        // best-effort
      }
    }
  }

  private async handlePayload(raw: string): Promise<void> {
    if (this.stopped) return
    const payload = parsePayload(raw)
    if (!payload) return
    const bindings = this.bindingsFor(payload.table)
    if (bindings.length === 0) return

    await Promise.all(
      bindings.map((binding) =>
        payload.op === 'DELETE'
          ? removeKnowledgeRecordEmbeddings({
              agentName: binding.agentName,
              table: binding.table,
              recordId: payload.id,
            }).catch(() => undefined)
          : // INSERT or UPDATE — (re)embed the record.
            embedKnowledgeRecord({
              agentName: binding.agentName,
              table: binding.table,
              fields: binding.fields,
              filter: binding.filter,
              recordId: payload.id,
            }).catch(() => undefined)
      )
    )
  }
}

/**
 * Module-level singleton listener holder. A mutable container (not a bare
 * `let`) so the value can be swapped on config reload while satisfying the
 * `functional/no-let` rule. The server process is killed per-test, so an
 * explicit teardown is belt-and-braces; the connection is reclaimed on
 * process exit regardless.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- intentional mutable singleton holder (swapped on config reload)
const listenerHolder: { current: AiKnowledgeListener | undefined } = { current: undefined }

/**
 * Start the knowledge auto-embed listener for a set of table bindings.
 * Best-effort: a connection failure is logged but never thrown — the startup
 * knowledge sync still embedded the records that existed at boot.
 */
export const startAiKnowledgeListener = async (
  databaseUrl: string,
  bindings: ReadonlyArray<KnowledgeTableBinding>
): Promise<void> => {
  if (bindings.length === 0) return
  // SQLite has no PL/pgSQL triggers, `pg_notify`, or `LISTEN` — the
  // auto-embed knowledge listener is a PostgreSQL-only feature. Skip wiring
  // entirely on SQLite (RAG search itself degrades to 501 requires-postgres).
  if (isSqliteRuntime()) {
    logDebug('[ai-knowledge] listener disabled — requires PostgreSQL (SQLite runtime)')
    return
  }
  // Replace any prior listener (config reload across a restart).
  if (listenerHolder.current) {
    await listenerHolder.current.stop().catch(() => undefined)
  }
  const listener = new AiKnowledgeListener(databaseUrl, bindings)
  // eslint-disable-next-line functional/immutable-data -- module-level singleton holder
  listenerHolder.current = listener
  await listener.start().catch((error: unknown) => {
    logError('[ai-knowledge] listener failed to start', error)
  })
}

/** Stop the active knowledge listener, if any. Idempotent. */
export const stopAiKnowledgeListener = async (): Promise<void> => {
  const listener = listenerHolder.current
  // eslint-disable-next-line functional/immutable-data -- module-level singleton holder
  listenerHolder.current = undefined
  if (listener) await listener.stop().catch(() => undefined)
}

/**
 * Combined RAG startup runner — embeds the document knowledge in
 * `AI_KNOWLEDGE_DIR` and the table-knowledge that exists at boot, then
 * installs the auto-embed change listener. Best-effort: never blocks server
 * startup. Single entry point so the server composition root has one call
 * instead of three.
 *
 * SQLite skip: the RAG knowledge pipeline is PostgreSQL-only — it writes
 * `pgvector` embeddings to `system.ai_embeddings` and reads knowledge tables
 * via raw `db.execute(sql\`…\`)`, which the SQLite `db` facade does not expose.
 * Self-skip the whole pipeline (documents + table knowledge + change listener)
 * on the SQLite runtime so it degrades cleanly instead of emitting a
 * `db.execute is not a function` warning per knowledge table. `startAiKnowledge\
 * Listener` already self-skips on SQLite; guarding the parent makes the whole
 * boot-path RAG step a clean no-op and keeps the skip in one place.
 */
export const runRagKnowledgeStartup = async (
  agents: ReadonlyArray<RagAgent> | undefined,
  databaseUrl: string
): Promise<void> => {
  if (isSqliteRuntime()) {
    logDebug('[ai-rag] knowledge startup disabled — requires PostgreSQL (SQLite runtime)')
    return
  }
  await runSyncDocumentsAtStartup()
  await runSyncKnowledgeAtStartup({ agents })
  await startAiKnowledgeListener(databaseUrl, buildKnowledgeBindings(agents))
}

const parsePayload = (raw: string): KnowledgePayload | undefined => {
  try {
    const parsed = JSON.parse(raw) as KnowledgePayload
    if (
      (parsed.op === 'INSERT' || parsed.op === 'UPDATE' || parsed.op === 'DELETE') &&
      typeof parsed.table === 'string' &&
      typeof parsed.id === 'string'
    ) {
      return parsed
    }
    return undefined
  } catch {
    return undefined
  }
}
