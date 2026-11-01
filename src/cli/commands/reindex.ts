/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium reindex [config]`
 *
 * Rebuilds the AI knowledge index from the shell: every document in
 * `AI_KNOWLEDGE_DIR`, then (on PostgreSQL) every agent's knowledge tables.
 *
 * It is the operator's road. `POST /api/ai/rag/rebuild` needs an administrator,
 * so an app without `auth` cannot reach it, and on SQLite no boot re-embeds
 * table knowledge. Whoever can run the binary beside the database can run this.
 *
 * The database is brought forward first, through the same two steps as
 * `sovrium seed`, so the index table exists on a database nothing has booted
 * against yet. Every import that reaches the database is dynamic, as in the
 * other database-capable verbs.
 */

import { Effect } from 'effect'
import { CliExit, fromAsyncValue, type CliStop } from '@/cli/runtime/run-command'
import { inflect, printDocument, printStderr } from '@/infrastructure/logging/cli-output'
import { applyDatabaseMigrations, discoverConfigFile, refuse, requireApp } from './app-prelude'
import type { CliBlock } from '@/infrastructure/logging/cli-output'
import type { RagReindexReport } from '@/infrastructure/server/rag-reindex'

/** Everything `sovrium reindex` reads from the command line. */
export interface ReindexCommandOptions {
  readonly configFile?: string | undefined
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** The provider a probe was sent to, as the operator configured it. */
const providerLabel = (): string => {
  const configured = process.env['AI_PROVIDER']?.trim() ?? ''
  return configured === '' ? 'ollama' : configured
}

const TABLES_NEED_POSTGRES = 'Table knowledge not indexed: it needs PostgreSQL (set DATABASE_URL)'

/** The lines a finished rebuild prints, one per document and per agent table. */
const reportBlocks = (report: RagReindexReport): readonly CliBlock[] => {
  const notice: CliBlock = report.tablesSkipped ? [{ text: TABLES_NEED_POSTGRES }] : []
  if (report.kind === 'nothing') {
    return [
      notice,
      [{ text: 'Nothing to index: no knowledge documents and no agent knowledge tables' }],
    ]
  }
  const documents = Object.entries(report.documents).map(([path, chunks]) => ({
    text: `Indexed document ${path}: ${inflect(chunks, 'chunk')}`,
  }))
  const tables = Object.entries(report.agents).flatMap(([agent, byTable]) =>
    Object.entries(byTable).map(([table, chunks]) => ({
      text: `Indexed table ${table} for agent ${agent}: ${inflect(chunks, 'chunk')}`,
    }))
  )
  return [
    notice,
    [...documents, ...tables],
    [{ text: `Knowledge index rebuilt: ${inflect(report.totalChunks, 'chunk')}` }],
  ]
}

/**
 * Handle `sovrium reindex`. The exit is explicit on every branch: a database
 * connection can outlive the last statement and keep the process alive.
 */
export const handleReindexCommand = (
  options: ReindexCommandOptions
): Effect.Effect<void, CliStop> =>
  Effect.gen(function* () {
    const app = yield* fromAsyncValue(() => preparedApp(options.configFile))
    const { reindexRagKnowledge } = yield* fromAsyncValue(
      () => import('@/infrastructure/server/rag-reindex')
    )
    const outcome = yield* Effect.result(reindexRagKnowledge(app))
    if (outcome._tag === 'Failure') {
      printStderr(
        `Error: Could not reach the AI provider (${providerLabel()}): nothing was indexed`
      )
      return yield* new CliExit({ code: 1, stderr: `  ${describeError(outcome.failure.cause)}` })
    }
    printDocument(reportBlocks(outcome.success))
  })

/** The config, read and validated, over a database brought up to it. */
const preparedApp = async (givenConfigFile: string | undefined) => {
  const configFile = givenConfigFile ?? (await discoverConfigFile())
  const { app, authoredTableIds } = await requireApp(configFile)
  await applyDatabaseMigrations(app, { authoredTableIds }).catch((error: unknown) =>
    refuse(`Error: The database could not be prepared: ${describeError(error)}`)
  )
  return app
}
