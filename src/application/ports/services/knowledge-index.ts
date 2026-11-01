/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The agents' knowledge index, as the RAG routes reach it: the documents in
 * the knowledge directory, and re-embedding table and document knowledge.
 *
 * Reading the directory, querying the source tables and embedding every chunk
 * is infrastructure work — the boot sync and the record listener run it there.
 * The admin rebuild route reaches the same work through this port and a
 * use-case, so an HTTP handler never imports the embedding pipeline.
 */

import { Context, Data, type Effect } from 'effect'
import type { App } from '@/domain/models/app'

/** A knowledge sync that could not run. `source` names which; `cause` is its own error. */
export class KnowledgeSyncError extends Data.TaggedError('KnowledgeSyncError')<{
  readonly source: 'directory' | 'tables' | 'documents'
  readonly cause: unknown
}> {}

/** Chunks embedded per source table, across the agents re-embedded. */
export interface TableKnowledgeStats {
  readonly tables: Readonly<Record<string, number>>
  readonly totalChunks: number
}

/** Chunks embedded per knowledge document. */
export interface DocumentKnowledgeStats {
  readonly documents: Readonly<Record<string, number>>
  readonly totalChunks: number
}

export class KnowledgeIndex extends Context.Service<
  KnowledgeIndex,
  {
    /** The supported documents in the knowledge directory, by relative path. */
    readonly listDocuments: Effect.Effect<readonly string[], KnowledgeSyncError>
    /**
     * Re-embed the table knowledge of the app's agents — one agent's only when
     * `agent` names it — with each entry's fields filtered and partitioned by
     * read grant exactly as the boot sync does.
     */
    readonly reembedTables: (
      app: App,
      agent: string | undefined
    ) => Effect.Effect<TableKnowledgeStats, KnowledgeSyncError>
    /** Re-embed every document in the knowledge directory (global to the app). */
    readonly reembedDocuments: Effect.Effect<DocumentKnowledgeStats, KnowledgeSyncError>
  }
>()('KnowledgeIndex') {}
