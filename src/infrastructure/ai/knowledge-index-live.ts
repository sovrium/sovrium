/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The live {@link KnowledgeIndex}: the same document discovery and the same
 * table and document sync runners the boot sync calls, each behind a typed
 * failure.
 *
 * Built over the `Database` of the runtime that holds it; every call opens what
 * else it needs and releases it before it answers, so there is no resource for
 * a scope to hold.
 */

import { Effect, Layer } from 'effect'
import {
  KnowledgeIndex,
  KnowledgeSyncError,
  type TableKnowledgeStats,
} from '@/application/ports/services/knowledge-index'
import { filterRagKnowledgeByRole } from '@/infrastructure/database/ai-knowledge-listener'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { discoverDocuments, resolveKnowledgeDir, runSyncDocuments } from './document-sync'
import { runSyncKnowledge } from './knowledge-sync'
import type { RagAgent } from './rag-agent-input'

/** The knowledge-sync input for a list of RAG agents: those with at least one table. */
const toSyncInput = (agents: ReadonlyArray<RagAgent>) =>
  agents
    .map((agent) => ({
      name: agent.name,
      tables: (agent.knowledge?.tables ?? []).map((t) => ({
        table: t.table,
        fields: t.fields,
        ...(t.fieldGroups !== undefined ? { fieldGroups: t.fieldGroups } : {}),
        ...(t.filter !== undefined ? { filter: t.filter } : {}),
      })),
    }))
    .filter((agent) => agent.tables.length > 0)

/** Fold per-agent stats into one per-table count and one total. */
const mergeAgentStats = (
  byAgent: Readonly<Record<string, TableKnowledgeStats>>
): TableKnowledgeStats => ({
  tables: Object.values(byAgent).reduce<Record<string, number>>(
    (acc, stats) => ({ ...acc, ...stats.tables }),
    {}
  ),
  totalChunks: Object.values(byAgent).reduce((sum, stats) => sum + stats.totalChunks, 0),
})

export const KnowledgeIndexLive = Layer.effect(
  KnowledgeIndex,
  Effect.map(Database, (database) =>
    KnowledgeIndex.of({
      listDocuments: Effect.tryPromise({
        try: () => discoverDocuments(resolveKnowledgeDir(process.env)),
        catch: (cause) => new KnowledgeSyncError({ source: 'directory', cause }),
      }).pipe(Effect.map((documents) => documents.map((document) => document.path))),
      // The same agents the boot sync embeds: knowledge filtered by the agent's
      // role, each entry's fields partitioned by their effective read grant.
      reembedTables: (app, agent) =>
        Effect.tryPromise({
          try: () => {
            const agents = filterRagKnowledgeByRole(app)
            const selected =
              agent === undefined ? agents : agents.filter((candidate) => candidate.name === agent)
            return runSyncKnowledge(toSyncInput(selected), database)
          },
          catch: (cause) => new KnowledgeSyncError({ source: 'tables', cause }),
        }).pipe(Effect.map(mergeAgentStats)),
      reembedDocuments: Effect.tryPromise({
        try: () => runSyncDocuments(process.env, database),
        catch: (cause) => new KnowledgeSyncError({ source: 'documents', cause }),
      }),
    })
  )
)
