/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Document knowledge sync — discovers, parses, chunks and embeds document
 * files from `AI_KNOWLEDGE_DIR` into `system.ai_embeddings`
 *.
 *
 * Mirrors the table-knowledge pipeline in `knowledge-sync.ts`:
 *  - `discoverDocuments()` reads `AI_KNOWLEDGE_DIR` (default `./knowledge`),
 *    keeps `.pdf` / `.md` / `.txt`, and logs a warning for unsupported
 * extensions (`.xlsx`, `.docx`...) — [internal ref].
 *  - `syncAgentDocuments()` parses each file to text (`document-parser`),
 *    chunks it with the shared `chunkText`, embeds every chunk via the
 *    eco-routed `AiService`, and persists rows with `source_type:'document'`.
 *  - `runSyncDocumentsAtStartup()` is the best-effort startup runner — a
 *    failure is logged but never blocks the server.
 *
 * Re-running is idempotent: a document's embeddings are pre-cleared by
 * `source_id` prefix before re-embedding, so a content change (detected on
 * the next sync / rebuild) replaces rather than duplicates — [internal ref].
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Effect } from 'effect'
import { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import {
  chunkText,
  resolveChunkSettings,
  type ChunkSettings,
} from '@/domain/models/app/agents/rag-chunking'
import { logError, logWarning } from '@/infrastructure/logging/logger'
import { isSupportedDocument, parseDocument } from './document-parser'
import { countRowsBy, embedChunksToRows, RagSyncLayer, swallowLogged } from './embed-pipeline'
import type { NewEmbedding } from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { AiService } from '@/application/ports/services/ai-service'

/** Default knowledge directory when `AI_KNOWLEDGE_DIR` is unset. */
const DEFAULT_KNOWLEDGE_DIR = './knowledge'

/** One discovered knowledge document — its relative path within the dir. */
export interface DiscoveredDocument {
  readonly path: string
}

/** Per-document chunk counts produced by a document sync run. */
export interface SyncDocumentStats {
  readonly documents: Readonly<Record<string, number>>
  readonly totalChunks: number
}

/** Resolve the knowledge directory from an env snapshot. */
export const resolveKnowledgeDir = (env: Readonly<Record<string, string | undefined>>): string => {
  const raw = env['AI_KNOWLEDGE_DIR']
  return raw !== undefined && raw.trim().length > 0 ? raw.trim() : DEFAULT_KNOWLEDGE_DIR
}

/**
 * Discover knowledge documents in `AI_KNOWLEDGE_DIR`.
 *
 * Recursively walks the directory, keeping only files with a supported
 * extension. Unsupported files (`.xlsx`, `.docx`, ...) are skipped and logged
 * with a warning. A missing directory yields an empty
 * list — document knowledge is optional.
 */
export const discoverDocuments = async (
  dir: string
): Promise<ReadonlyArray<DiscoveredDocument>> => {
  const walk = async (current: string, prefix: string): Promise<ReadonlyArray<string>> => {
    const entries = await readdir(current, { withFileTypes: true }).catch(() => [])
    const nested = await Promise.all(
      entries.map(async (entry): Promise<ReadonlyArray<string>> => {
        const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
        if (entry.isDirectory()) {
          return walk(join(current, entry.name), rel)
        }
        if (!entry.isFile()) return []
        if (isSupportedDocument(rel)) return [rel]
        logWarning(`[ai-rag] skipping unsupported knowledge file: ${rel}`)
        return []
      })
    )
    return nested.flat()
  }
  const paths = await walk(dir, '')
  return paths.toSorted().map((path) => ({ path }))
}

/** A document chunk awaiting embedding, carrying its provenance. */
interface PendingDocumentChunk {
  readonly path: string
  readonly chunkIndex: number
  readonly content: string
}

/**
 * Read + parse a single document file into pending chunks. A read/parse
 * failure yields no chunks so one bad file never aborts the sync.
 */
const documentToChunks = async (input: {
  readonly dir: string
  readonly path: string
  readonly chunkSettings: ChunkSettings
}): Promise<ReadonlyArray<PendingDocumentChunk>> => {
  try {
    const bytes = await readFile(join(input.dir, input.path))
    const text = await parseDocument({
      path: input.path,
      bytes: new Uint8Array(bytes),
    })
    return chunkText(text, input.chunkSettings).map((content, chunkIndex) => ({
      path: input.path,
      chunkIndex,
      content,
    }))
  } catch (error) {
    logError('[ai-rag] failed to parse knowledge document', error, { path: input.path })
    return []
  }
}

/**
 * The `source_id` prefix for a document's embeddings. Pre-clearing by this
 * prefix makes re-embedding idempotent.
 */
const documentSourceId = (path: string): string => `document-agent::${path}`

/**
 * Embed every discovered document and persist the chunks. Returns per-document
 * chunk counts. Pre-clears each document's prior embeddings so a re-sync
 * replaces rather than duplicates.
 */
const syncDocuments = (input: {
  readonly dir: string
  readonly documents: ReadonlyArray<DiscoveredDocument>
  readonly chunkSettings: ChunkSettings
}): Effect.Effect<SyncDocumentStats, never, AiService | AiEmbeddingRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiEmbeddingRepository

    const pendingGroups = yield* Effect.forEach(input.documents, (doc) =>
      // effect-promise: total -- `documentToChunks` wraps its whole read-and-parse in a try/catch and returns an empty chunk list on failure, so one unreadable document can never reject and abort the sync.
      Effect.promise(() =>
        documentToChunks({
          dir: input.dir,
          path: doc.path,
          chunkSettings: input.chunkSettings,
        })
      ).pipe(
        // Re-embed is idempotent: drop the document's prior chunks first.
        // A failed pre-clear is not fatal — the re-embed below still runs — but
        // it silently turns an idempotent re-sync into a duplicating one.
        Effect.tap(() =>
          repo
            .deleteBySourceIdPrefix(documentSourceId(doc.path))
            .pipe(swallowLogged('document embeddings not pre-cleared', { path: doc.path }))
        )
      )
    )
    const pending = pendingGroups.flat()

    const rows = yield* embedChunksToRows(pending, (chunk, embedding): NewEmbedding => ({
      // Document knowledge is global — no owning agent → SQL NULL.
      // eslint-disable-next-line unicorn/no-null -- SQL NULL for nullable agent_name column
      agentName: null,
      sourceType: 'document',
      sourceId: documentSourceId(chunk.path),
      sourceRef: `document:${chunk.path}:${chunk.chunkIndex}`,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      embedding,
      metadata: { path: chunk.path },
    }))
    // The sync still reports the chunk counts it computed, so a failed insert
    // reads to the operator as a successful sync over an empty index.
    yield* repo
      .insertMany(rows)
      .pipe(swallowLogged('document embeddings not persisted', { rows: String(rows.length) }))

    const documents = countRowsBy(rows, (row) => String((row.metadata ?? {})['path'] ?? ''))
    return { documents, totalChunks: rows.length } satisfies SyncDocumentStats
  })

/**
 * Discover and embed every document in the knowledge directory. Returns
 * per-document chunk counts. Errors are swallowed — a sync failure must never
 * block server startup.
 */
export const runSyncDocuments = async (
  env: Readonly<Record<string, string | undefined>>
): Promise<SyncDocumentStats> => {
  const dir = resolveKnowledgeDir(env)
  const documents = await discoverDocuments(dir).catch((): ReadonlyArray<DiscoveredDocument> => [])
  if (documents.length === 0) return { documents: {}, totalChunks: 0 }
  const chunkSettings = resolveChunkSettings(env)
  const program = syncDocuments({ dir, documents, chunkSettings }).pipe(
    Effect.provide(RagSyncLayer)
  )
  return Effect.runPromise(program).catch((): SyncDocumentStats => ({
    documents: {},
    totalChunks: 0,
  }))
}

/**
 * Startup runner — discovers and embeds document knowledge. Best-effort: a
 * failure is logged but never thrown.
 */
export const runSyncDocumentsAtStartup = async (): Promise<void> => {
  // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget best-effort document sync
  await runSyncDocuments(process.env).catch((error: unknown) => {
    logError('[ai-rag] document sync failed', error)
  })
}
