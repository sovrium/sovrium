/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Effect } from 'effect'
import { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import {
  chunkText,
  resolveChunkSettings,
  type ChunkSettings,
} from '@/domain/services/rag/rag-chunking'
import { logWarning } from '@/infrastructure/logging/logger'
import { isSupportedDocument, parseDocument } from './document-parser'
import { countRowsBy, embedChunksToRows, RagSyncLayer } from './embed-pipeline'
import type { NewEmbedding } from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { AiService } from '@/application/ports/services/ai-service'

const DEFAULT_KNOWLEDGE_DIR = './knowledge'

export interface DiscoveredDocument {
  readonly path: string
}

export interface SyncDocumentStats {
  readonly documents: Readonly<Record<string, number>>
  readonly totalChunks: number
}

export const resolveKnowledgeDir = (env: Readonly<Record<string, string | undefined>>): string => {
  const raw = env['AI_KNOWLEDGE_DIR']
  return raw !== undefined && raw.trim().length > 0 ? raw.trim() : DEFAULT_KNOWLEDGE_DIR
}

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

interface PendingDocumentChunk {
  readonly path: string
  readonly chunkIndex: number
  readonly content: string
}

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
    logWarning(`[ai-rag] failed to parse knowledge document ${input.path}: ${String(error)}`)
    return []
  }
}

const documentSourceId = (path: string): string => `document-agent::${path}`

const syncDocuments = (input: {
  readonly dir: string
  readonly documents: ReadonlyArray<DiscoveredDocument>
  readonly chunkSettings: ChunkSettings
}): Effect.Effect<SyncDocumentStats, never, AiService | AiEmbeddingRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiEmbeddingRepository

    const pendingGroups = yield* Effect.forEach(input.documents, (doc) =>
      Effect.promise(() =>
        documentToChunks({
          dir: input.dir,
          path: doc.path,
          chunkSettings: input.chunkSettings,
        })
      ).pipe(
        Effect.tap(() =>
          repo
            .deleteBySourceIdPrefix(documentSourceId(doc.path))
            .pipe(Effect.catchAll(() => Effect.void))
        )
      )
    )
    const pending = pendingGroups.flat()

    const rows = yield* embedChunksToRows(pending, (chunk, embedding): NewEmbedding => ({
      agentName: null,
      sourceType: 'document',
      sourceId: documentSourceId(chunk.path),
      sourceRef: `document:${chunk.path}:${chunk.chunkIndex}`,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      embedding,
      metadata: { path: chunk.path },
    }))
    yield* repo.insertMany(rows).pipe(Effect.catchAll(() => Effect.void))

    const documents = countRowsBy(rows, (row) => String((row.metadata ?? {})['path'] ?? ''))
    return { documents, totalChunks: rows.length } satisfies SyncDocumentStats
  })

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

export const runSyncDocumentsAtStartup = async (): Promise<void> => {
  await runSyncDocuments(process.env).catch((error: unknown) => {
    logWarning(`[ai-rag] document sync failed: ${String(error)}`)
  })
}
