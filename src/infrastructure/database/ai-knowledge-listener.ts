/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer, type Scope } from 'effect'
import { ProcessEnv, type ProcessEnvShape } from '@/application/ports/services/process-env'
import { escapeSqlString, quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { filterAgentKnowledgeTables } from '@/domain/models/app/agents/rag-knowledge-access'
import { partitionFieldsByReaders } from '@/domain/models/app/tables/field-readability-partition-service'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { runSyncDocumentsAtStartup } from '@/infrastructure/ai/document-sync'
import { ragSyncLayerOver, type RagSyncServices } from '@/infrastructure/ai/embed-pipeline'
import {
  buildKnowledgeBindings,
  embedKnowledgeRecord,
  removeKnowledgeRecordEmbeddings,
  runSyncKnowledgeAtStartup,
} from '@/infrastructure/ai/knowledge-sync'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import { Database, type DatabaseService } from './drizzle/layer'
import {
  makePgNotifyListenerLayer,
  type PgNotifyListenerDriver,
  type PgNotifyListenerStatus,
  type PgNotifySubscription,
} from './pg-notify-listener'
import type { App } from '@/domain/models/app'
import type { RagAgent } from '@/infrastructure/ai/rag-agent-input'

/**
 * AI Knowledge Listener — auto-embeds table-knowledge on record change.
 *
 * Mirrors the AI compute listener. PostgreSQL `AFTER INSERT/UPDATE/DELETE`
 * triggers `pg_notify` the `sovrium_ai_knowledge` channel; this listener
 * receives each event and (re)embeds or removes the affected record's
 * embeddings via the eco-routed `AiService` (the AI RAG table knowledge requirement:
 *
 * PostgreSQL cannot make outbound HTTP calls from PL/pgSQL, so the trigger
 * is a thin NOTIFY emitter and the embedding round-trip happens here.
 */

/** One agent's interest in a knowledge table — used to fan a change out. */
export interface KnowledgeTableBinding {
  readonly agentName: string
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly fieldGroups?: ReadonlyArray<ReadonlyArray<string>>
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
 *
 * `table` is the CONFIG name — `Help Articles` — which the payload carries so
 * the handler can match it against the agents' bindings. Everything the
 * database resolves uses the DERIVED name, `help_articles`: the relation the
 * trigger sits on, and the function and trigger names built from it. Spliced
 * as written, `ON "Help Articles"` named a relation nobody created and
 * `sovrium_ai_knowledge_notify_Help Articles()` was no identifier at all; both
 * failures were swallowed, so the agent silently stopped learning the table.
 */
const buildTriggerSql = (table: string): readonly string[] => {
  const relation = sanitizeTableName(table)
  const fn = `sovrium_ai_knowledge_notify_${relation}`
  const trig = `sovrium_ai_knowledge_trig_${relation}`
  const quoted = quoteSqlIdentifier(relation)
  return [
    `CREATE OR REPLACE FUNCTION ${fn}() RETURNS trigger AS $$
       DECLARE rec_id text;
       BEGIN
         IF (TG_OP = 'DELETE') THEN rec_id := OLD.id::text;
         ELSE rec_id := NEW.id::text;
         END IF;
         PERFORM pg_notify('${CHANNEL}', json_build_object(
           'op', TG_OP, 'table', '${escapeSqlString(table)}', 'id', rec_id
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
  PgNotifyListenerStatus
>()('AiKnowledgeListener') {}

/**
 * This app's RAG agents, with knowledge tables filtered by role and each
 * entry's fields partitioned by their effective read grant, so that a chunk
 * never mixes fields two readers may read differently.
 */
export const filterRagKnowledgeByRole = (app: App): ReadonlyArray<RagAgent> =>
  (app.agents ?? []).map((agent) => {
    const filtered = filterAgentKnowledgeTables(agent, app.tables ?? [], app)
    const tables = filtered.knowledge?.tables
    if (tables === undefined) return filtered
    return {
      ...filtered,
      knowledge: {
        ...filtered.knowledge,
        tables: tables.map((entry) => ({
          ...entry,
          fieldGroups: partitionFieldsByReaders(app, entry.table, entry.fields),
        })),
      },
    }
  })

/**
 * The `pg` boundary, injectable so the acquire/release contract can be unit
 * tested without `mock.module`. Nothing in production passes a driver.
 */
export type AiKnowledgeListenerDriver = PgNotifyListenerDriver

const handlePayload = async (
  rag: RagSyncServices,
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
  // latency that has no observer. Same `reduce` chain as the setup statements in
  // `pg-notify-listener.ts`, and for the same reason.
  await matched.reduce(
    (chain, binding) =>
      chain.then(() =>
        payload.op === 'DELETE'
          ? removeKnowledgeRecordEmbeddings({
              agentName: binding.agentName,
              table: binding.table,
              recordId: payload.id,
              rag,
            }).catch(() => undefined)
          : // INSERT or UPDATE — (re)embed the record.
            embedKnowledgeRecord({
              agentName: binding.agentName,
              table: binding.table,
              fields: binding.fields,
              fieldGroups: binding.fieldGroups,
              filter: binding.filter,
              recordId: payload.id,
              rag,
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
 * and the layer resolves inert. The embeddings go through the `Database` of the
 * runtime holding the listener.
 */
export const makeAiKnowledgeListenerLayer = (
  app: App | undefined,
  driver?: AiKnowledgeListenerDriver
): Layer.Layer<AiKnowledgeListener, never, Database> =>
  makePgNotifyListenerLayer(AiKnowledgeListener, {
    channel: CHANNEL,
    label: '[ai-knowledge]',
    shouldListen: knowledgeSubscriptionOf(app),
    onOpenFailure: (error) => logError('[ai-knowledge] listener failed to start', error),
    ...(driver === undefined ? {} : { driver }),
  })

/**
 * Does this app have any reason to listen? A PostgreSQL database and at least
 * one agent bound to a knowledge table. The setup installs an AFTER-change
 * trigger on every bound table, once each, in each table's own
 * function → drop → create order.
 */
const knowledgeSubscriptionOf = (
  app: App | undefined
): Effect.Effect<PgNotifySubscription | undefined, never, Scope.Scope | Database> =>
  Effect.flatMap(ProcessEnv, (env) => {
    const bindings = knowledgeBindingsOf(app, env)
    if (bindings === undefined) return Effect.undefined
    // The RAG services, built ONCE for the listener's lifetime: each record
    // the listener re-embeds is provided with them rather than rebuilding them.
    return Effect.flatMap(Database, (database) => Layer.build(ragSyncLayerOver(database))).pipe(
      Effect.map((rag): PgNotifySubscription => ({
        databaseUrl: bindings.databaseUrl,
        setupSql: [...new Set(bindings.bindings.map((binding) => binding.table))].flatMap((table) =>
          buildTriggerSql(table)
        ),
        onPayload: (raw) => handlePayload(rag, bindings.bindings, raw),
      }))
    )
  })

/** The bound knowledge tables and the database they live in, when the listener has any. */
const knowledgeBindingsOf = (
  app: App | undefined,
  env: ProcessEnvShape
):
  | { readonly databaseUrl: string; readonly bindings: ReadonlyArray<KnowledgeTableBinding> }
  | undefined => {
  if (app === undefined) return undefined
  // SQLite has no PL/pgSQL triggers, `pg_notify`, or `LISTEN` — the
  // auto-embed knowledge listener is a PostgreSQL-only feature (RAG search
  // itself degrades to 501 requires-postgres).
  const dialect = parseDatabaseDialectConfig(env)
  if (dialect.dialect !== 'postgres' || !dialect.databaseUrl) {
    logDebug('[ai-knowledge] listener disabled — requires PostgreSQL (SQLite runtime)')
    return undefined
  }
  const bindings = buildKnowledgeBindings(filterRagKnowledgeByRole(app))
  if (bindings.length === 0) return undefined
  return { databaseUrl: dialect.databaseUrl, bindings }
}

/**
 * Combined RAG startup runner — embeds the document knowledge in
 * `AI_KNOWLEDGE_DIR` and the table-knowledge that exists at boot. Best-effort:
 * never blocks server startup. Single entry point so the server composition
 * root has one call instead of two (the AI RAG document knowledge requirement /
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
 * persists through `ragSyncLayerOver` — which provides the dialect-gated
 * `AiEmbeddingRepositoryActive`, whose SQLite arm is pinned by
 * `[internal ref]`. Skipping it too left the shipped default
 * engine with an agent that retrieves from an index nothing ever wrote, and
 * the earlier blanket guard's rationale ("writes pgvector embeddings") was
 * only ever true of the Postgres arm of a repository that has two.
 */
export const runRagKnowledgeStartup = async (
  database: DatabaseService,
  agents: ReadonlyArray<RagAgent> | undefined
): Promise<void> => {
  await runSyncDocumentsAtStartup(database)
  if (database.dialect.kind === 'sqlite') {
    logDebug(
      '[ai-rag] table-knowledge sync and change listener disabled — require PostgreSQL (SQLite runtime); document knowledge still embedded'
    )
    return
  }
  await runSyncKnowledgeAtStartup({ agents, database })
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
