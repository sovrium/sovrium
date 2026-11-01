/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { AiService } from '@/application/ports/services/ai-service'
import {
  discoverDocuments,
  resolveKnowledgeDir,
  runSyncDocumentsAtStartup,
} from '@/infrastructure/ai/document-sync'
import { ragSyncLayerOver } from '@/infrastructure/ai/embed-pipeline'
import { runSyncKnowledgeAtStartup } from '@/infrastructure/ai/knowledge-sync'
import { filterRagKnowledgeByRole } from '@/infrastructure/database/ai-knowledge-listener'
import {
  Database,
  DatabaseUnownedLive,
  type DatabaseService,
} from '@/infrastructure/database/drizzle/layer'
import type { App } from '@/domain/models/app'
import type { RagAgent } from '@/infrastructure/ai/rag-agent-input'

/**
 * The AI provider refused or could not be reached by the probe embedding that
 * precedes a rebuild. `cause` is the provider's own failure, for the message.
 */
export class AiProviderUnreachableError extends Data.TaggedError('AiProviderUnreachableError')<{
  readonly cause: unknown
}> {}

/**
 * What one rebuild did. `nothing` when there was no source at all (no
 * provider call is made then); `tablesSkipped` when agents declare knowledge
 * tables the SQLite runtime cannot index.
 */
export interface RagReindexReport {
  readonly kind: 'nothing' | 'indexed'
  readonly tablesSkipped: boolean
  readonly documents: Readonly<Record<string, number>>
  readonly agents: Readonly<Record<string, Readonly<Record<string, number>>>>
  readonly totalChunks: number
}

/**
 * One embedding before any chunk is cleared or written.
 *
 * The sync runners skip a chunk the provider fails on, so that one bad chunk
 * never aborts a boot. Run from a shell, that same tolerance would report an
 * unreachable provider as "0 chunks indexed" and exit 0. Asking once up front
 * turns it into the refusal an operator can act on, and it runs BEFORE the
 * runners pre-clear the existing chunks, so a dead provider empties nothing.
 */
const probeProvider = (
  database: DatabaseService
): Effect.Effect<void, AiProviderUnreachableError> =>
  Effect.gen(function* () {
    const ai = yield* AiService
    yield* ai.embed({ text: 'sovrium knowledge index probe' })
  }).pipe(
    Effect.provide(ragSyncLayerOver(database)),
    Effect.mapError((cause) => new AiProviderUnreachableError({ cause }))
  )

/** Run both sync runners; they catch, log and recover every failure themselves. */
const runSyncs = async (agents: ReadonlyArray<RagAgent> | undefined, database: DatabaseService) => {
  const documents = await runSyncDocumentsAtStartup(database)
  const byAgent = agents === undefined ? {} : await runSyncKnowledgeAtStartup({ agents, database })
  return { documents, byAgent }
}

/**
 * Rebuild the AI knowledge index outside a running server: every knowledge
 * document, then every agent's table knowledge, through the same runners and
 * the same role-filtered agents as the boot sync. Each runner clears what it
 * re-embeds, so running it twice replaces rather than duplicates.
 *
 * Table knowledge follows the boot sync's dialect rule: PostgreSQL only.
 */
export const reindexRagKnowledge = (
  app: App
): Effect.Effect<RagReindexReport, AiProviderUnreachableError> =>
  Effect.gen(function* () {
    const agents = filterRagKnowledgeByRole(app).filter(
      (agent) => (agent.knowledge?.tables ?? []).length > 0
    )
    const database = yield* Database
    const sqlite = database.dialect.kind === 'sqlite'
    const tablesSkipped = sqlite && agents.length > 0
    const tableAgents = sqlite || agents.length === 0 ? undefined : agents
    // effect-promise: total -- an unreadable or missing directory resolves to no documents
    const discovered = yield* Effect.promise(() =>
      discoverDocuments(resolveKnowledgeDir(process.env))
    )
    const empty = { tablesSkipped, documents: {}, agents: {}, totalChunks: 0 }
    if (discovered.length === 0 && tableAgents === undefined) {
      return { kind: 'nothing', ...empty } satisfies RagReindexReport
    }
    yield* probeProvider(database)
    // effect-promise: total -- both runners catch, log and recover every failure themselves
    const { documents, byAgent } = yield* Effect.promise(() => runSyncs(tableAgents, database))
    const tableChunks = Object.values(byAgent).reduce((sum, stats) => sum + stats.totalChunks, 0)
    return {
      kind: 'indexed',
      tablesSkipped,
      documents: documents.documents,
      agents: Object.fromEntries(
        Object.entries(byAgent).map(([name, stats]) => [name, stats.tables] as const)
      ),
      totalChunks: documents.totalChunks + tableChunks,
    } satisfies RagReindexReport
  }).pipe(
    // `sovrium reindex` runs with no server: every read and write goes through the unowned database.
    Effect.provide(DatabaseUnownedLive),
    Effect.withSpan('server.reindexRagKnowledge')
  )
