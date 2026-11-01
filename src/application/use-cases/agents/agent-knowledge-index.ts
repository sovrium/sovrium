/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { KnowledgeIndex } from '@/application/ports/services/knowledge-index'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'

/** What a rebuild re-embedded, per table and per document, and in all. */
export interface AgentKnowledgeRebuild {
  readonly tables: Readonly<Record<string, number>>
  readonly documents: Readonly<Record<string, number>>
  readonly totalChunks: number
}

/**
 * Re-embed the agents' table knowledge (one agent's when `agent` names it) and
 * the knowledge directory's documents, together.
 *
 * Each half is best-effort: a half that fails counts as having embedded
 * nothing, and the other half still answers. The rebuild reports what it
 * achieved rather than failing the whole request over one source, and the
 * failure is logged with its cause so an empty count is never silent.
 */
export const rebuildAgentKnowledge = Effect.fn('agents.rebuild-knowledge')(function* (
  app: App,
  agent: string | undefined
) {
  const index = yield* KnowledgeIndex
  const [tables, documents] = yield* Effect.all(
    [
      index.reembedTables(app, agent).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[ai-rag] table knowledge rebuild failed', cause))
        ),
        // effect-swallow: logged above; a failed table half reports zero chunks and the document half still answers.
        Effect.orElseSucceed(() => ({ tables: {}, totalChunks: 0 }))
      ),
      index.reembedDocuments.pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[ai-rag] document knowledge rebuild failed', cause))
        ),
        // effect-swallow: logged above; a failed document half reports zero chunks and the table half still answers.
        Effect.orElseSucceed(() => ({ documents: {}, totalChunks: 0 }))
      ),
    ],
    { concurrency: 2 }
  )
  return {
    tables: tables.tables,
    documents: documents.documents,
    totalChunks: tables.totalChunks + documents.totalChunks,
  } satisfies AgentKnowledgeRebuild
})

/**
 * The documents the knowledge directory holds, by relative path. A directory
 * that cannot be read lists nothing — document knowledge is optional — and the
 * failure is logged.
 */
export const listKnowledgeDocuments = Effect.fn('agents.list-knowledge-documents')(function* () {
  const index = yield* KnowledgeIndex
  return yield* index.listDocuments.pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[ai-rag] the knowledge directory could not be read', cause))
    ),
    // effect-swallow: logged above; an unreadable directory lists no documents, as a missing one does.
    Effect.orElseSucceed((): readonly string[] => [])
  )
})
