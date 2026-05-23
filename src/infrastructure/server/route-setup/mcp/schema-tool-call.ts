/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { type Context } from 'hono'
import { db } from '@/infrastructure/database'
import { extractRows } from '@/infrastructure/database/sql/sql-utils'
import { setLiveApp } from '@/infrastructure/server/route-setup/live-app-store'
import {
  insertVersion,
  readActiveVersionNumber,
  readActiveVersionSnapshot,
  readAllVersionRows,
  readLatestDraft,
  readVersionRow,
  writeDraft,
} from '@/infrastructure/server/route-setup/schema-persistence'
import { runPublishMigration } from '@/infrastructure/server/route-setup/schema-publish-migration'
import { validateSnapshot } from '@/infrastructure/server/route-setup/schema-validation'
import type { McpCaller } from '@/infrastructure/server/route-setup/mcp/auth'

interface SchemaToolCallInput {
  readonly c: Readonly<Context>
  readonly caller: McpCaller
  readonly responseId: number | string
  readonly appName: string
  readonly toolName: string
  readonly args: Record<string, unknown>
}

export const handleSchemaToolCall = async (input: SchemaToolCallInput): Promise<Response> => {
  const suffix = input.toolName.slice(`${input.appName}_`.length)

  if (isMutatingSuffix(suffix) && input.caller.role !== 'admin') {
    return errorResult(input, { code: 'FORBIDDEN', message: 'admin role required' })
  }

  try {
    return await routeSchemaTool(suffix, input)
  } catch (cause) {
    return errorResult(input, {
      code: 'INTERNAL_ERROR',
      message: cause instanceof Error ? cause.message : 'schema tool failed',
    })
  }
}

const routeSchemaTool = (suffix: string, input: SchemaToolCallInput): Promise<Response> => {
  if (suffix === 'schema_status') return handleStatus(input)
  if (suffix === 'schema_versions_list') return handleVersionsList(input)
  if (suffix === 'schema_versions_get') return handleVersionsGet(input)
  if (suffix === 'schema_draft_get') return handleDraftGet(input)
  if (suffix === 'schema_draft_validate') return handleDraftValidate(input)
  if (suffix === 'schema_draft_replace') return handleDraftReplace(input)
  if (suffix === 'schema_draft_publish') return handleDraftPublish(input)
  if (suffix === 'schema_draft_rebase') return handleDraftRebase(input)
  if (suffix === 'schema_draft_tables_create') return handleTablesCreate(input)

  return Promise.resolve(
    input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: { code: -32_601, message: `Schema tool not implemented: ${input.toolName}` },
    })
  )
}


const handleStatus = async (input: SchemaToolCallInput): Promise<Response> => {
  const activeVersion = await readActiveVersionNumber()
  const draft = await readLatestDraft()
  const bootstrapMode = (await readUserCount()) === 0
  const structured = {
    apiEnabled: true,
    bootstrapMode,
    activeVersion,
    draftDirty: draft !== undefined,
    draftBaseVersion: draft?.baseVersion ?? 0,
    previewActive: false,
  }
  return successResult(input, structured)
}

const handleVersionsList = async (input: SchemaToolCallInput): Promise<Response> => {
  const rows = await readAllVersionRows()
  const versions = rows.map((row) => ({
    versionNumber: Number(row['version_number']),
    checksum: String(row['checksum'] ?? ''),
    message: typeof row['message'] === 'string' ? row['message'] : '',
  }))
  const activeVersion = versions.length > 0 ? (versions[0]?.versionNumber ?? 0) : 0
  return successResult(input, { versions, activeVersion })
}

const handleVersionsGet = async (input: SchemaToolCallInput): Promise<Response> => {
  const versionNumber = Number(input.args['versionNumber'])
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return errorResult(input, { code: 'VALIDATION_ERROR', message: 'versionNumber required' })
  }
  const row = await readVersionRow(versionNumber)
  if (row === undefined) {
    return errorResult(input, { code: 'NOT_FOUND', message: `version ${versionNumber} not found` })
  }
  return successResult(input, {
    versionNumber: Number(row['version_number']),
    snapshot: row['snapshot'],
    checksum: String(row['checksum'] ?? ''),
    message: typeof row['message'] === 'string' ? row['message'] : '',
  })
}

const handleDraftGet = async (input: SchemaToolCallInput): Promise<Response> => {
  const draft = await readLatestDraft()
  if (draft === undefined) {
    return errorResult(input, { code: 'NOT_FOUND', message: 'no draft exists' })
  }
  return successResult(input, { snapshot: draft.snapshot, baseVersion: draft.baseVersion })
}

const handleDraftValidate = async (input: SchemaToolCallInput): Promise<Response> => {
  const draft = await readLatestDraft()
  if (draft === undefined) {
    return errorResult(input, { code: 'NOT_FOUND', message: 'no draft exists' })
  }
  const validation = validateSnapshot(draft.snapshot)
  return successResult(input, validation)
}


const handleDraftReplace = async (input: SchemaToolCallInput): Promise<Response> => {
  const { snapshot } = input.args
  if (typeof snapshot !== 'object' || snapshot === null) {
    return errorResult(input, { code: 'VALIDATION_ERROR', message: 'snapshot required' })
  }
  const baseVersion =
    typeof input.args['baseVersion'] === 'number'
      ? (input.args['baseVersion'] as number)
      : await readActiveVersionNumber()
  return writeDraft({
    snapshot,
    baseVersion,
    userId: input.caller.userId ?? 'mcp-system',
  }).then(() => successResult(input, { snapshot, baseVersion }))
}

const handleDraftPublish = async (input: SchemaToolCallInput): Promise<Response> => {
  const draft = await readLatestDraft()
  if (draft === undefined) {
    return errorResult(input, { code: 'NOT_FOUND', message: 'no draft exists' })
  }
  const activeVersion = await readActiveVersionNumber()
  const baseVersion =
    typeof input.args['baseVersion'] === 'number'
      ? (input.args['baseVersion'] as number)
      : draft.baseVersion
  if (baseVersion !== activeVersion) {
    return errorResult(input, {
      code: 'CONFLICT',
      message: 'draft was branched from a stale version',
      expected: baseVersion,
      actual: activeVersion,
    })
  }
  const validation = validateSnapshot(draft.snapshot)
  if (!validation.valid) {
    return errorResult(input, {
      code: 'VALIDATION_ERROR',
      message: 'draft is invalid',
      errors: validation.errors,
    })
  }
  const message = typeof input.args['message'] === 'string' ? input.args['message'] : ''

  const previousSnapshot = await readActiveVersionSnapshot()
  const migration = await runPublishMigration(previousSnapshot, draft.snapshot)
  if (!migration.ok) {
    return errorResult(input, {
      code: 'MIGRATION_ERROR',
      message: `Live schema migration failed — publish aborted: ${migration.message}`,
    })
  }

  const newVersion = await insertVersion({
    snapshot: draft.snapshot,
    message,
    userId: input.caller.userId ?? 'mcp-system',
    source: 'mcp',
  })
  setLiveApp(draft.snapshot as { readonly name: string; readonly [key: string]: unknown })
  return successResult(input, {
    activeVersion: newVersion,
    migration: { applied: migration.result.applied, deferred: migration.result.deferred },
  })
}

const handleDraftRebase = async (input: SchemaToolCallInput): Promise<Response> => {
  const draft = await readLatestDraft()
  if (draft === undefined) {
    return errorResult(input, { code: 'NOT_FOUND', message: 'no draft exists' })
  }
  const activeVersion = await readActiveVersionNumber()
  const previousBaseVersion = draft.baseVersion
  return writeDraft({
    snapshot: draft.snapshot,
    baseVersion: activeVersion,
    userId: input.caller.userId ?? 'mcp-system',
  }).then(() =>
    successResult(input, {
      previousBaseVersion,
      rebasedToVersion: activeVersion,
      draft: { snapshot: draft.snapshot, baseVersion: activeVersion },
    })
  )
}

const handleTablesCreate = async (input: SchemaToolCallInput): Promise<Response> => {
  const { table } = input.args
  if (typeof table !== 'object' || table === null) {
    return errorResult(input, { code: 'VALIDATION_ERROR', message: 'table required' })
  }
  const draft = await readLatestDraft()
  if (draft === undefined) {
    return errorResult(input, { code: 'NOT_FOUND', message: 'no draft exists' })
  }
  const snapshot = draft.snapshot as { readonly tables?: ReadonlyArray<{ readonly name?: string }> }
  const tableName = (table as { readonly name?: string }).name
  const existing = snapshot.tables ?? []
  if (typeof tableName === 'string' && existing.some((t) => t.name === tableName)) {
    return errorResult(input, {
      code: 'VALIDATION_ERROR',
      message: `table '${tableName}' already exists in the draft`,
    })
  }
  const nextSnapshot = { ...snapshot, tables: [...existing, table] }
  return writeDraft({
    snapshot: nextSnapshot,
    baseVersion: draft.baseVersion,
    userId: input.caller.userId ?? 'mcp-system',
  }).then(() => successResult(input, { snapshot: nextSnapshot }))
}


const readUserCount = async (): Promise<number> => {
  try {
    const result = await db.execute(sql.raw('SELECT COUNT(*)::int AS n FROM auth."user"'))
    const row = extractRows(result)[0]
    return row !== undefined ? Number(row['n'] ?? 0) : 0
  } catch {
    return 0
  }
}


const isMutatingSuffix = (suffix: string): boolean =>
  suffix === 'schema_versions_restore' ||
  suffix === 'schema_draft_replace' ||
  suffix === 'schema_draft_discard' ||
  suffix === 'schema_draft_publish' ||
  suffix === 'schema_draft_tables_create' ||
  suffix === 'schema_draft_tables_update' ||
  suffix === 'schema_draft_tables_delete' ||
  suffix === 'schema_draft_preview_start' ||
  suffix === 'schema_draft_preview_stop'

const successResult = (input: SchemaToolCallInput, structured: unknown): Response =>
  input.c.json({
    jsonrpc: '2.0',
    id: input.responseId,
    result: {
      content: [{ type: 'text', text: JSON.stringify(structured, undefined, 2) }],
      structuredContent: structured,
    },
  })

const errorResult = (
  input: SchemaToolCallInput,
  body: Readonly<Record<string, unknown>> & { readonly code: string }
): Response =>
  input.c.json({
    jsonrpc: '2.0',
    id: input.responseId,
    result: {
      content: [{ type: 'text', text: JSON.stringify(body, undefined, 2) }],
      structuredContent: body,
      isError: true,
    },
  })
