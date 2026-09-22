/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements */

import { Context, Effect, Layer } from 'effect'
import { Client } from 'pg'
import { pinPostgresSslMode } from '@/domain/kernel/sql/postgres-ssl-mode'
import { filterAgentKnowledgeTables } from '@/domain/models/app/agents/rag-knowledge-access'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { runSyncDocumentsAtStartup } from '@/infrastructure/ai/document-sync'
import {
  buildKnowledgeBindings,
  embedKnowledgeRecord,
  removeKnowledgeRecordEmbeddings,
  runSyncKnowledgeAtStartup,
} from '@/infrastructure/ai/knowledge-sync'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import { isSqliteRuntime } from './unsupported-in-sqlite'
import type { App } from '@/domain/models/app'
import type { RagAgent } from '@/infrastructure/ai/rag-agent-input'

/**
 * AI Knowledge Listener — auto-embeds table-knowledge on record change.
 *
 * Mirrors the AI compute listener. PostgreSQL `AFTER INSERT/UPDATE/DELETE`
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
 * The knowledge listener as a service.
 *
 * This was a mutable class plus a module-level `listenerHolder` singleton, an
 * exported `startAiKnowledgeListener`, and an exported `stopAiKnowledgeListener`
 * that `createStopEffect` had to remember to call. The singleton existed only
 * because nothing else owned the connection's lifetime; the server's domain
 * `ManagedRuntime` now does, so both the holder and the disposer are gone
 * (standing rule E3). That also removes a real in-process hazard: a
 * module-level holder is shared by every server booted in one Playwright worker
 * under `serverMode: 'inprocess'`, while a layer-scoped connection is not.
 */
export class AiKnowledgeListener extends Context.Service<
  AiKnowledgeListener,
  AiKnowledgeListenerStatus
>()('AiKnowledgeListener') {}

/** What a built listener layer reports about itself. */
export interface AiKnowledgeListenerStatus {
  /** `true` only when a `pg` connection is open and `LISTEN` succeeded. */
  readonly listening: boolean
}

const INERT: AiKnowledgeListenerStatus = { listening: false }

/** This app's RAG agents, with knowledge tables filtered by role. */
export const filterRagKnowledgeByRole = (app: App): ReadonlyArray<RagAgent> =>
  (app.agents ?? []).map((agent) => filterAgentKnowledgeTables(agent, app.tables ?? []))

/**
 * Open the connection, install the per-table triggers, and subscribe — or
 * resolve `undefined`.
 *
 * Never rejects: a knowledge listener that cannot connect means records stop
 * auto-embedding, not that the server fails to boot. Because this is the
 * acquire half of an `Effect.acquireRelease`, a rejection here would take the
 * whole layer build — and therefore the boot — down with it.
 */
const connect = async (
  databaseUrl: string,
  bindings: ReadonlyArray<KnowledgeTableBinding>,
  handle: (raw: string) => void
): Promise<Client | undefined> => {
  const client = new Client({ connectionString: pinPostgresSslMode(databaseUrl) })
  try {
    await client.connect()

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
    await [...new Set(bindings.map((binding) => binding.table))]
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
      handle(msg.payload)
    })
    client.on('error', () => {
      // Recoverable on next restart — never crash on connection error.
    })
    await client.query(`LISTEN ${CHANNEL}`)
    return client
  } catch (error: unknown) {
    logError('[ai-knowledge] listener failed to start', error)
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
 * The `pg` boundary as one injectable pair — see the sibling in
 * `ai-compute-listener.ts` for why this is a parameter rather than a direct
 * call: it lets the acquire/release contract be unit-tested without
 * `mock.module`. Nothing in production passes anything but {@link liveDriver}.
 */
export interface AiKnowledgeListenerDriver {
  readonly open: (
    databaseUrl: string,
    bindings: ReadonlyArray<KnowledgeTableBinding>,
    handle: (raw: string) => void
  ) => Promise<Client | undefined>
  // eslint-disable-next-line functional/prefer-immutable-types -- pg's `Client` is an inherently mutable driver handle; a `Readonly<Client>` would refuse the `query`/`end` calls that ARE the release
  readonly close: (client: Client) => Promise<void>
}

const liveDriver: AiKnowledgeListenerDriver = { open: connect, close: disconnect }

const handlePayload = async (
  bindings: ReadonlyArray<KnowledgeTableBinding>,
  raw: string
): Promise<void> => {
  const payload = parsePayload(raw)
  if (!payload) return
  const matched = bindings.filter((binding) => binding.table === payload.table)
  if (matched.length === 0) return

  // SEQUENTIAL, and the width is the point. This was a `Promise.all` over
  // `matched`, whose length is "however many agents happen to declare this
  // table" — an unstated fan-out against the shared connection pool, which is
  // the shape `sovrium/no-unbounded-promise-fanout` exists to refuse
  //. Each element is
  // an AI-provider round trip plus an embedding write, and this is a
  // best-effort background embed nobody is waiting on, so a width of 1 costs
  // latency that has no observer. Same `reduce` chain as the trigger DDL above,
  // and for the same reason.
  await matched.reduce(
    (chain, binding) =>
      chain.then(() =>
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
      ),
    Promise.resolve<unknown>(undefined)
  )
}

/**
 * The live knowledge listener, scoped to the layer that builds it.
 *
 * `Layer.effect` IS Effect 4's scoped layer constructor — there is no
 * `Layer.scoped` — so the `Scope` that `Effect.acquireRelease` needs is
 * supplied by the layer and stripped from its type.
 *
 * `app` is optional so the layer is nameable from a runtime built without a
 * config (`createDomainRuntime(undefined)`): with no app there are no bindings
 * and the layer resolves inert.
 */
export const makeAiKnowledgeListenerLayer = (
  app: App | undefined,
  driver: AiKnowledgeListenerDriver = liveDriver
): Layer.Layer<AiKnowledgeListener> =>
  Layer.effect(
    AiKnowledgeListener,
    Effect.gen(function* () {
      if (app === undefined) return INERT
      // SQLite has no PL/pgSQL triggers, `pg_notify`, or `LISTEN` — the
      // auto-embed knowledge listener is a PostgreSQL-only feature (RAG search
      // itself degrades to 501 requires-postgres).
      const dialect = parseDatabaseDialectConfig()
      if (dialect.dialect !== 'postgres' || !dialect.databaseUrl) {
        logDebug('[ai-knowledge] listener disabled — requires PostgreSQL (SQLite runtime)')
        return INERT
      }
      const bindings = buildKnowledgeBindings(filterRagKnowledgeByRole(app))
      if (bindings.length === 0) return INERT

      const { databaseUrl } = dialect
      const client = yield* Effect.acquireRelease(
        // effect-promise: total -- `connect` catches its own rejections and resolves `undefined`; see its doc comment.
        Effect.promise(() =>
          driver.open(databaseUrl, bindings, (raw) => {
            void handlePayload(bindings, raw).catch((error: unknown) => {
              logError('[ai-knowledge] payload handler error', error)
            })
          })
        ),
        // effect-promise: total -- `disconnect` swallows both cleanup rejections.
        (open) => (open === undefined ? Effect.void : Effect.promise(() => driver.close(open)))
      )

      return client === undefined ? INERT : { listening: true }
    })
  )

/**
 * Combined RAG startup runner — embeds the document knowledge in
 * `AI_KNOWLEDGE_DIR` and the table-knowledge that exists at boot. Best-effort:
 * never blocks server startup. Single entry point so the server composition
 * root has one call instead of two ([internal ref] /
 * TABLE-KNOWLEDGE).
 *
 * The auto-embed CHANGE listener is no longer started from here: it is
 * {@link makeAiKnowledgeListenerLayer}, built with the domain runtime — which
 * happens EARLIER in the boot than this call, so a record written during the
 * startup sync is observed rather than missed.
 *
 * SQLite skip — PARTIAL, and deliberately so. `runSyncKnowledgeAtStartup` reads
 * the user's knowledge TABLES through a raw `db.execute(sql\`…\`)`
 * (`knowledge-sync.ts`), which the SQLite `db` facade does not expose, so it
 * stays skipped.
 *
 * `runSyncDocumentsAtStartup` is NOT one of them. It reads files from
 * `AI_KNOWLEDGE_DIR`, chunks them, embeds via the eco-routed `AiService`, and
 * persists through `RagSyncLayer` — which provides the dialect-gated
 * `AiEmbeddingRepositoryActive`, whose SQLite arm is pinned by
 * `[internal ref]`. Skipping it too left the shipped default
 * engine with an agent that retrieves from an index nothing ever wrote, and
 * the earlier blanket guard's rationale ("writes pgvector embeddings") was
 * only ever true of the Postgres arm of a repository that has two.
 */
export const runRagKnowledgeStartup = async (
  agents: ReadonlyArray<RagAgent> | undefined
): Promise<void> => {
  await runSyncDocumentsAtStartup()
  if (isSqliteRuntime()) {
    logDebug(
      '[ai-rag] table-knowledge sync and change listener disabled — require PostgreSQL (SQLite runtime); document knowledge still embedded'
    )
    return
  }
  await runSyncKnowledgeAtStartup({ agents })
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
