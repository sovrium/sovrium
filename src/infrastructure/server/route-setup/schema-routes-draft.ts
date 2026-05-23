/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type Context } from 'hono'
import { setLiveApp } from './live-app-store'
import {
  insertRestoredVersion,
  insertVersion,
  readAllVersionRows,
  readVersionRow,
} from './schema-persistence'
import { runPublishMigration } from './schema-publish-migration'
import {
  type DraftRow,
  type FieldError,
  type Snapshot,
  draftEnvelope,
  jsonError,
  parseBody,
  readActiveVersionNumber,
  readActiveVersionSnapshot,
  readLatestDraft,
  withAdmin,
  writeDraft,
} from './schema-routes-core'
import { type ValidationError, validateSnapshot } from './schema-validation'
import type { SchemaMigrationResult } from '@/application/ports/services/schema-migrator'
import type { App } from '@/domain/models/app'


const toFieldErrors = (errors: ReadonlyArray<ValidationError>): ReadonlyArray<FieldError> =>
  errors.map((e) => ({ field: e.field, message: e.message }))


const versionDetail = (row: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const createdAt = row['created_at']
  const restoredFromVersion = restoredFromVersionOf(row)
  const fileChecksum = row['file_checksum']
  return {
    versionNumber: Number(row['version_number']),
    snapshot: row['snapshot'],
    checksum: String(row['checksum'] ?? ''),
    createdAt: createdAt !== undefined ? String(createdAt) : new Date().toISOString(),
    createdByUserId: String(row['created_by_user_id'] ?? ''),
    source: sourceOf(row),
    message: typeof row['message'] === 'string' ? row['message'] : '',
    ...(typeof fileChecksum === 'string' && fileChecksum.length > 0 ? { fileChecksum } : {}),
    ...(restoredFromVersion !== undefined ? { restoredFromVersion } : {}),
  }
}

export const handleGetVersion = (
  c: Readonly<Context>,
  app: Readonly<App>,
  versionParam: string | undefined
): Promise<Response> =>
  withAdmin(c, app, async () => {
    const versionNumber = Number(versionParam)
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: 'version number must be a positive integer',
      })
    }
    const row = await readVersionRow(versionNumber)
    if (row === undefined) {
      return jsonError(c, 404, {
        code: 'NOT_FOUND',
        message: `version ${versionNumber} not found`,
      })
    }
    return c.json(versionDetail(row), 200)
  })


export const handlePutDraft = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async (caller) => {
    const body = await parseBody(c)
    const snapshot = body?.['snapshot']
    if (typeof snapshot !== 'object' || snapshot === null) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: 'snapshot is required',
        errors: [{ field: 'snapshot', message: 'snapshot is required and must be an object' }],
      })
    }

    const validation = validateSnapshot(snapshot)
    if (!validation.valid) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: 'snapshot failed schema validation',
        errors: toFieldErrors(validation.errors),
      })
    }

    const requestedBaseVersion = body?.['baseVersion']
    const activeVersion = await readActiveVersionNumber()
    if (typeof requestedBaseVersion === 'number' && requestedBaseVersion !== activeVersion) {
      return jsonError(c, 409, {
        code: 'CONFLICT',
        message: 'draft baseVersion is stale — another version was published',
      })
    }

    const existing = await readLatestDraft()
    const baseVersion = existing?.baseVersion ?? activeVersion
    const nextSnapshot = snapshot as Snapshot
    const activeSnapshot = await writeDraft({
      snapshot: nextSnapshot,
      baseVersion,
      userId: caller.userId,
    }).then(() => readActiveVersionSnapshot())
    const updated: DraftRow = {
      snapshot: nextSnapshot,
      baseVersion,
      updatedAt: new Date().toISOString(),
      updatedByUserId: caller.userId,
    }
    return c.json(draftEnvelope(updated, activeSnapshot), 200)
  })


export const handleDiscardDraft = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async (caller) => {
    const activeSnapshot = await readActiveVersionSnapshot()
    const activeVersion = await readActiveVersionNumber()
    const resetSnapshot: Snapshot = activeSnapshot ?? {}
    const updatedAt = await writeDraft({
      snapshot: resetSnapshot,
      baseVersion: activeVersion,
      userId: caller.userId,
    }).then(() => new Date().toISOString())
    const updated: DraftRow = {
      snapshot: resetSnapshot,
      baseVersion: activeVersion,
      updatedAt,
      updatedByUserId: caller.userId,
    }
    return c.json({ draft: draftEnvelope(updated, activeSnapshot) }, 200)
  })


export const handleValidateDraft = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async () => {
    const draft = await readLatestDraft()
    if (draft === undefined) {
      return jsonError(c, 404, { code: 'NOT_FOUND', message: 'no draft exists' })
    }
    const validation = validateSnapshot(draft.snapshot)
    return c.json(
      {
        valid: validation.valid,
        errors: validation.errors.map((e) => ({ path: e.path, message: e.message })),
      },
      200
    )
  })


const restoredFromVersionOf = (row: Readonly<Record<string, unknown>>): number | undefined => {
  const raw = row['restored_from_version']
  if (raw === null || raw === undefined) return undefined
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 ? value : undefined
}

const sourceOf = (row: Readonly<Record<string, unknown>>): string => {
  const raw = row['source']
  if (typeof raw !== 'string' || raw === '') return 'config-file'
  return raw
}

const versionListItem = (row: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const createdAt = row['created_at']
  const restoredFromVersion = restoredFromVersionOf(row)
  const fileChecksum = row['file_checksum']
  return {
    versionNumber: Number(row['version_number']),
    checksum: String(row['checksum'] ?? ''),
    createdAt: createdAt !== undefined ? String(createdAt) : new Date().toISOString(),
    createdByUserId: String(row['created_by_user_id'] ?? ''),
    source: sourceOf(row),
    message: typeof row['message'] === 'string' ? row['message'] : '',
    ...(typeof fileChecksum === 'string' && fileChecksum.length > 0 ? { fileChecksum } : {}),
    ...(restoredFromVersion !== undefined ? { restoredFromVersion } : {}),
  }
}

export const handleListVersions = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async () => {
    const rows = await readAllVersionRows()
    const versions = rows.map(versionListItem)
    const activeVersion = await readActiveVersionNumber()
    const draft = await readLatestDraft()
    return c.json(
      {
        versions,
        activeVersion,
        draftBaseVersion: draft?.baseVersion ?? activeVersion,
      },
      200
    )
  })


const commitVersion = async (input: {
  readonly c: Readonly<Context>
  readonly snapshot: Snapshot
  readonly userId: string
  readonly message: string
  readonly insert: () => Promise<number>
  readonly restoredFromVersion?: number
  readonly migration?: SchemaMigrationResult
}): Promise<Response> => {
  const { c, snapshot, userId, message, insert, restoredFromVersion, migration } = input

  const newVersionNumber = await insert()
  setLiveApp(snapshot as { readonly name: string; readonly [key: string]: unknown })

  const row = await writeDraft({ snapshot, baseVersion: newVersionNumber, userId }).then(() =>
    readVersionRow(newVersionNumber)
  )
  const version =
    row !== undefined
      ? versionListItem(row)
      : {
          versionNumber: newVersionNumber,
          checksum: '',
          createdAt: new Date().toISOString(),
          createdByUserId: userId,
          message,
          ...(restoredFromVersion !== undefined ? { restoredFromVersion } : {}),
        }
  return c.json(
    {
      version,
      activeVersion: newVersionNumber,
      ...(migration !== undefined
        ? { migration: { applied: migration.applied, deferred: migration.deferred } }
        : {}),
    },
    200
  )
}

const commitPublish = async (input: {
  readonly c: Readonly<Context>
  readonly draft: DraftRow
  readonly userId: string
  readonly message: string
}): Promise<Response> => {
  const { c, draft, userId, message } = input

  const previousSnapshot = await readActiveVersionSnapshot()
  const migration = await runPublishMigration(previousSnapshot, draft.snapshot)
  if (!migration.ok) {
    return jsonError(c, 500, {
      code: 'MIGRATION_ERROR',
      message: `Live schema migration failed — publish aborted: ${migration.message}`,
    })
  }

  return commitVersion({
    c,
    snapshot: draft.snapshot,
    userId,
    message,
    migration: migration.result,
    insert: () => insertVersion({ snapshot: draft.snapshot, message, userId, source: 'api' }),
  })
}

export const handlePublishDraft = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async (caller) => {
    const draft = await readLatestDraft()
    if (draft === undefined) {
      return jsonError(c, 404, { code: 'NOT_FOUND', message: 'no draft exists' })
    }

    const body = await parseBody(c)
    const activeVersion = await readActiveVersionNumber()
    const requestedBaseVersion = body?.['baseVersion']
    const baseVersion =
      typeof requestedBaseVersion === 'number' ? requestedBaseVersion : draft.baseVersion

    if (baseVersion !== activeVersion) {
      return c.json(
        {
          success: false,
          code: 'CONFLICT',
          message: 'draft baseVersion is stale — another version was published',
          expected: baseVersion,
          actual: activeVersion,
        },
        409
      )
    }

    const validation = validateSnapshot(draft.snapshot)
    if (!validation.valid) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: 'draft failed schema validation',
        errors: validation.errors.map((e) => ({ field: e.field, message: e.message })),
      })
    }

    const message = typeof body?.['message'] === 'string' ? (body['message'] as string) : ''
    return commitPublish({ c, draft, userId: caller.userId, message })
  })


export const handleRebaseDraft = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async (caller) => {
    const draft = await readLatestDraft()
    if (draft === undefined) {
      return jsonError(c, 404, { code: 'NOT_FOUND', message: 'no draft exists' })
    }

    const activeVersion = await readActiveVersionNumber()
    const previousBaseVersion = draft.baseVersion

    const activeSnapshot = await writeDraft({
      snapshot: draft.snapshot,
      baseVersion: activeVersion,
      userId: caller.userId,
    }).then(() => readActiveVersionSnapshot())
    const rebased: DraftRow = {
      snapshot: draft.snapshot,
      baseVersion: activeVersion,
      updatedAt: new Date().toISOString(),
      updatedByUserId: caller.userId,
    }
    return c.json(
      {
        previousBaseVersion,
        rebasedToVersion: activeVersion,
        draft: draftEnvelope(rebased, activeSnapshot),
      },
      200
    )
  })


const commitRestore = (input: {
  readonly c: Readonly<Context>
  readonly snapshot: Snapshot
  readonly userId: string
  readonly message: string
  readonly sourceVersion: number
}): Promise<Response> => {
  const { c, snapshot, userId, message, sourceVersion } = input
  return commitVersion({
    c,
    snapshot,
    userId,
    message,
    restoredFromVersion: sourceVersion,
    insert: () =>
      insertRestoredVersion({ snapshot, message, userId, restoredFromVersion: sourceVersion }),
  })
}

export const handleRestoreVersion = (
  c: Readonly<Context>,
  app: Readonly<App>,
  versionParam: string | undefined
): Promise<Response> =>
  withAdmin(c, app, async (caller) => {
    const sourceVersion = Number(versionParam)
    if (!Number.isInteger(sourceVersion) || sourceVersion < 1) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: 'version number must be a positive integer',
      })
    }

    const sourceRow = await readVersionRow(sourceVersion)
    if (sourceRow === undefined) {
      return jsonError(c, 404, {
        code: 'NOT_FOUND',
        message: `version ${sourceVersion} not found`,
      })
    }

    const snapshot =
      typeof sourceRow['snapshot'] === 'object' && sourceRow['snapshot'] !== null
        ? (sourceRow['snapshot'] as Snapshot)
        : {}

    const body = await parseBody(c)
    const message =
      typeof body?.['message'] === 'string'
        ? (body['message'] as string)
        : `Restored from version ${sourceVersion}`

    return commitRestore({ c, snapshot, userId: caller.userId, message, sourceVersion })
  })
