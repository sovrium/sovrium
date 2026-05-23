/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { count } from 'drizzle-orm'
import { type Context } from 'hono'
import { db } from '@/infrastructure/database'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { resolveDriftPosture } from '@/infrastructure/server/route-setup/drift-posture'
import {
  type FamilyConfig,
  type FieldError,
  type ResourceArray,
  type Snapshot,
  type CallerContext,
  type DraftRow,
  deepMerge,
  draftEnvelope,
  identityOf,
  jsonError,
  objectField,
  parseBody,
  persistAndRespond,
  readActiveVersionNumber,
  readActiveVersionSnapshot,
  readFamily,
  readLatestDraft,
  withAdmin,
} from './schema-routes-core'
import type { App } from '@/domain/models/app'


export const TABLES: FamilyConfig = { family: 'tables', identityKey: 'name', label: 'table' }
export const PAGES: FamilyConfig = { family: 'pages', identityKey: 'id', label: 'page' }
export const FORMS: FamilyConfig = { family: 'forms', identityKey: 'name', label: 'form' }
export const AUTOMATIONS: FamilyConfig = {
  family: 'automations',
  identityKey: 'name',
  label: 'automation',
}
export const CONNECTIONS: FamilyConfig = {
  family: 'connections',
  identityKey: 'name',
  label: 'connection',
}


const KNOWN_SECTION_TYPES: ReadonlySet<string> = new Set([
  'static',
  'data',
  'form',
  'collection',
  'markdown',
  'heading',
  'text',
  'hero',
  'list',
  'table',
])

const validatePageSections = (
  page: Readonly<Record<string, unknown>>
): ReadonlyArray<FieldError> => {
  const { sections } = page
  if (!Array.isArray(sections)) return []
  return sections.flatMap((section, index) => {
    if (typeof section !== 'object' || section === null) {
      return [{ field: `page.sections[${index}]`, message: 'Section must be an object' }]
    }
    const { type } = section as { readonly type?: unknown }
    if (typeof type !== 'string' || !KNOWN_SECTION_TYPES.has(type)) {
      return [
        {
          field: `page.sections[${index}].type`,
          message: `Unknown section type: ${typeof type === 'string' ? type : 'missing'}`,
        },
      ]
    }
    return []
  })
}


interface MutationInput {
  readonly c: Readonly<Context>
  readonly caller: CallerContext
  readonly cfg: FamilyConfig
}

const applyCreate = async (
  input: MutationInput & { readonly payload: Record<string, unknown> }
): Promise<Response> => {
  const { c, caller, cfg, payload } = input
  const draft = await readLatestDraft()
  if (draft === undefined) {
    return jsonError(c, 404, { code: 'NOT_FOUND', message: 'no draft exists' })
  }
  const existing = readFamily(draft.snapshot, cfg.family)
  const newIdent = identityOf(payload, cfg.identityKey)
  if (newIdent !== undefined && existing.some((e) => identityOf(e, cfg.identityKey) === newIdent)) {
    return jsonError(c, 400, {
      code: 'VALIDATION_ERROR',
      message: `${cfg.label} '${newIdent}' already exists`,
      errors: [
        {
          field: `${cfg.label}.${cfg.identityKey}`,
          message: `A ${cfg.label} with ${cfg.identityKey} '${newIdent}' already exists in the draft`,
        },
      ],
    })
  }
  const nextSnapshot: Snapshot = { ...draft.snapshot, [cfg.family]: [...existing, payload] }
  return persistAndRespond({ c, draft, caller, nextSnapshot, changed: true })
}

const applyPatch = async (
  input: MutationInput & {
    readonly ident: string | undefined
    readonly patch: Record<string, unknown>
  }
): Promise<Response> => {
  const { c, caller, cfg, ident, patch } = input
  const draft = await readLatestDraft()
  if (draft === undefined) {
    return jsonError(c, 404, { code: 'NOT_FOUND', message: 'no draft exists' })
  }
  const existing = readFamily(draft.snapshot, cfg.family)
  const index = existing.findIndex((e) => identityOf(e, cfg.identityKey) === ident)
  if (index === -1) {
    return jsonError(c, 404, { code: 'NOT_FOUND', message: `${cfg.label} '${ident}' not found` })
  }
  const current = existing[index] ?? {}
  const updatedEntry = deepMerge(current, patch)
  const changed = JSON.stringify(updatedEntry) !== JSON.stringify(current)
  const nextFamily = existing.map((e, i) => (i === index ? updatedEntry : e))
  const nextSnapshot: Snapshot = { ...draft.snapshot, [cfg.family]: nextFamily }
  return persistAndRespond({ c, draft, caller, nextSnapshot, changed })
}

const applyDelete = async (
  input: MutationInput & { readonly ident: string | undefined }
): Promise<Response> => {
  const { c, caller, cfg, ident } = input
  const draft = await readLatestDraft()
  if (draft === undefined) {
    return jsonError(c, 404, { code: 'NOT_FOUND', message: 'no draft exists' })
  }
  const existing = readFamily(draft.snapshot, cfg.family)
  const index = existing.findIndex((e) => identityOf(e, cfg.identityKey) === ident)
  if (index === -1) {
    return jsonError(c, 404, { code: 'NOT_FOUND', message: `${cfg.label} '${ident}' not found` })
  }
  const nextFamily = existing.filter((_, i) => i !== index)
  const nextSnapshot: Snapshot = { ...draft.snapshot, [cfg.family]: nextFamily }
  return persistAndRespond({ c, draft, caller, nextSnapshot, changed: true })
}


const readAuthStrategies = (snapshot: Snapshot): ResourceArray => {
  const { auth } = snapshot
  if (typeof auth !== 'object' || auth === null) return []
  const { strategies } = auth as { readonly strategies?: unknown }
  return Array.isArray(strategies) ? (strategies as ResourceArray) : []
}

const writeAuthStrategies = (snapshot: Snapshot, strategies: ResourceArray): Snapshot => {
  const { auth } = snapshot
  const authObj = typeof auth === 'object' && auth !== null ? (auth as Snapshot) : {}
  return { ...snapshot, auth: { ...authObj, strategies } }
}


export const handleGetDraft = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async (caller) => {
    const activeSnapshot = await readActiveVersionSnapshot()
    const draft = await readLatestDraft()
    if (draft === undefined) {
      const synthesised: DraftRow = {
        snapshot: activeSnapshot ?? {},
        baseVersion: await readActiveVersionNumber(),
        updatedAt: new Date().toISOString(),
        updatedByUserId: caller.userId,
      }
      return c.json(draftEnvelope(synthesised, activeSnapshot), 200)
    }
    return c.json(draftEnvelope(draft, activeSnapshot), 200)
  })

export const handleFamilyCreate = (
  c: Readonly<Context>,
  app: Readonly<App>,
  cfg: FamilyConfig,
  bodyKey: string
): Promise<Response> =>
  withAdmin(c, app, async (caller) => {
    const body = await parseBody(c)
    const payload = objectField(body, bodyKey)
    if (payload === undefined) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: `${bodyKey} is required`,
        errors: [{ field: bodyKey, message: `${bodyKey} is required` }],
      })
    }
    return applyCreate({ c, caller, cfg, payload })
  })

export const handleFamilyPatch = (
  c: Readonly<Context>,
  app: Readonly<App>,
  cfg: FamilyConfig,
  ident: string | undefined
): Promise<Response> =>
  withAdmin(c, app, async (caller) => {
    const body = await parseBody(c)
    const patch = objectField(body, 'patch')
    if (patch === undefined) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: 'patch is required',
        errors: [{ field: 'patch', message: 'patch is required' }],
      })
    }
    return applyPatch({ c, caller, cfg, ident, patch })
  })

export const handleFamilyDelete = (
  c: Readonly<Context>,
  app: Readonly<App>,
  cfg: FamilyConfig,
  ident: string | undefined
): Promise<Response> => withAdmin(c, app, (caller) => applyDelete({ c, caller, cfg, ident }))

export const handlePageCreate = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async (caller) => {
    const body = await parseBody(c)
    const page = objectField(body, 'page')
    if (page === undefined) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: 'page is required',
        errors: [{ field: 'page', message: 'page is required' }],
      })
    }
    const sectionErrors = validatePageSections(page)
    if (sectionErrors.length > 0) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: 'page has invalid sections',
        errors: sectionErrors,
      })
    }
    return applyCreate({ c, caller, cfg: PAGES, payload: page })
  })

const withAuthStrategyDraft = (
  c: Readonly<Context>,
  app: Readonly<App>,
  mutate: (input: {
    readonly caller: CallerContext
    readonly draft: DraftRow
    readonly strategies: ResourceArray
  }) => Promise<Response>
): Promise<Response> =>
  withAdmin(c, app, async (caller) => {
    const draft = await readLatestDraft()
    if (draft === undefined) {
      return jsonError(c, 404, { code: 'NOT_FOUND', message: 'no draft exists' })
    }
    return mutate({ caller, draft, strategies: readAuthStrategies(draft.snapshot) })
  })

export const handleAuthStrategyCreate = (
  c: Readonly<Context>,
  app: Readonly<App>
): Promise<Response> =>
  withAuthStrategyDraft(c, app, async ({ caller, draft, strategies }) => {
    const body = await parseBody(c)
    const strategy = objectField(body, 'strategy')
    if (strategy === undefined) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: 'strategy is required',
        errors: [{ field: 'strategy', message: 'strategy is required' }],
      })
    }
    const newType = identityOf(strategy, 'type')
    if (newType !== undefined && strategies.some((s) => identityOf(s, 'type') === newType)) {
      return jsonError(c, 400, {
        code: 'VALIDATION_ERROR',
        message: `auth strategy '${newType}' already exists`,
        errors: [
          {
            field: 'auth.strategies.type',
            message: `An auth strategy of type '${newType}' already exists in the draft`,
          },
        ],
      })
    }
    const nextSnapshot = writeAuthStrategies(draft.snapshot, [...strategies, strategy])
    return persistAndRespond({ c, draft, caller, nextSnapshot, changed: true })
  })

export const handleAuthStrategyDelete = (
  c: Readonly<Context>,
  app: Readonly<App>,
  type: string | undefined
): Promise<Response> =>
  withAuthStrategyDraft(c, app, ({ caller, draft, strategies }) => {
    const index = strategies.findIndex((s) => identityOf(s, 'type') === type)
    if (index === -1) {
      return Promise.resolve(
        jsonError(c, 404, { code: 'NOT_FOUND', message: `auth strategy '${type}' not found` })
      )
    }
    const nextStrategies = strategies.filter((_, i) => i !== index)
    const nextSnapshot = writeAuthStrategies(draft.snapshot, nextStrategies)
    return persistAndRespond({ c, draft, caller, nextSnapshot, changed: true })
  })

export const handleSchemaApiDisabled = (c: Readonly<Context>): Response =>
  jsonError(c, 404, { code: 'NOT_FOUND', message: 'Schema-edit API is not enabled' })


const isSchemaBootstrapMode = async (): Promise<boolean> => {
  if (process.env.AUTH_ADMIN_EMAIL) return false
  try {
    const users = authUsersTable()
    const rows = await db.select({ value: count() }).from(users)
    return Number(rows[0]?.value ?? 0) === 0
  } catch {
    return false
  }
}

export const handleSchemaStatus = async (c: Readonly<Context>): Promise<Response> => {
  const activeVersion = await readActiveVersionNumber()
  const activeSnapshot = await readActiveVersionSnapshot()
  const draft = await readLatestDraft()
  const bootstrapMode = await isSchemaBootstrapMode()

  const draftSnapshot = draft?.snapshot ?? activeSnapshot ?? {}
  const draftBaseVersion = draft?.baseVersion ?? activeVersion
  const draftDirty = JSON.stringify(draftSnapshot) !== JSON.stringify(activeSnapshot ?? {})
  const draftStale = draft !== undefined && draftBaseVersion !== activeVersion
  const drift = await resolveDriftPosture()

  return c.json(
    {
      apiEnabled: true,
      bootstrapMode,
      activeVersion,
      draftDirty,
      draftBaseVersion,
      draftStale,
      driftStatus: drift.driftStatus,
      ...(drift.source !== undefined ? { source: drift.source } : {}),
      ...(drift.fileChecksum !== undefined ? { fileChecksum: drift.fileChecksum } : {}),
      previewActive: false,
    },
    200
  )
}



const topLevelKeysOf = (snapshot: Readonly<Record<string, unknown>>): ReadonlySet<string> =>
  new Set(Object.keys(snapshot))

const findFileAncestorSnapshot = (
  rows: ReadonlyArray<Record<string, unknown>>
): Record<string, unknown> | undefined => {
  const fileRow = rows.find((r) => {
    const s = r['source']
    return s === 'config-file' || s === 'env' || s === undefined || s === null
  })
  const snapshot = fileRow?.['snapshot']
  return typeof snapshot === 'object' && snapshot !== null
    ? (snapshot as Record<string, unknown>)
    : undefined
}

const computeChangedPaths = (
  live: Readonly<Record<string, unknown>>,
  file: Readonly<Record<string, unknown>>
): ReadonlyArray<{ readonly path: string }> => {
  const liveKeys = topLevelKeysOf(live)
  const fileKeys = topLevelKeysOf(file)
  const allKeys = new Set([...liveKeys, ...fileKeys])
  return Array.from(allKeys)
    .filter((key) => {
      const inLive = liveKeys.has(key)
      const inFile = fileKeys.has(key)
      if (inLive !== inFile) return true
      return JSON.stringify(live[key]) !== JSON.stringify(file[key])
    })
    .map((path) => ({ path }))
}

export const handleSchemaDiff = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async () => {
    const drift = await resolveDriftPosture()
    if (drift.driftStatus === 'in-sync') {
      return c.json({ driftStatus: drift.driftStatus, changes: [] }, 200)
    }
    const { readAllVersionRows } = await import('./schema-persistence')
    const rows = await readAllVersionRows()
    const liveSnapshot =
      rows[0] && typeof rows[0]['snapshot'] === 'object' && rows[0]['snapshot'] !== null
        ? (rows[0]['snapshot'] as Record<string, unknown>)
        : {}
    const fileSnapshot = findFileAncestorSnapshot(rows) ?? {}
    const changes = computeChangedPaths(liveSnapshot, fileSnapshot)
    return c.json({ driftStatus: drift.driftStatus, changes }, 200)
  })


const snapshotToYaml = (snapshot: Readonly<Record<string, unknown>>): string =>
  JSON.stringify(snapshot, null, 2) + '\n'

export const handleSchemaExport = (c: Readonly<Context>, app: Readonly<App>): Promise<Response> =>
  withAdmin(c, app, async () => {
    const snapshot = await readActiveVersionSnapshot()
    if (snapshot === undefined) {
      return c.text('No active version', 404)
    }
    return c.body(snapshotToYaml(snapshot), 200, {
      'Content-Type': 'application/yaml; charset=utf-8',
    })
  })
