/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type Context } from 'hono'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import {
  type DraftRow,
  type Snapshot,
  readActiveVersionSnapshot,
  writeDraft,
} from './schema-persistence'
import type { App } from '@/domain/models/app'

export {
  type DraftRow,
  type Snapshot,
  readActiveVersionNumber,
  readActiveVersionSnapshot,
  readLatestDraft,
  writeDraft,
} from './schema-persistence'


export type ResourceArray = ReadonlyArray<Record<string, unknown>>

export interface CallerContext {
  readonly userId: string
  readonly role: string
}

export interface FamilyConfig {
  readonly family: string
  readonly identityKey: string
  readonly label: string
}

export interface FieldError {
  readonly field: string
  readonly message: string
}


const isDirty = (draftSnapshot: Snapshot, activeSnapshot: Snapshot | undefined): boolean => {
  if (activeSnapshot === undefined) return true
  return JSON.stringify(draftSnapshot) !== JSON.stringify(activeSnapshot)
}

export const draftEnvelope = (
  draft: DraftRow,
  activeSnapshot: Snapshot | undefined
): Record<string, unknown> => ({
  snapshot: draft.snapshot,
  baseVersion: draft.baseVersion,
  updatedAt: draft.updatedAt,
  updatedByUserId: draft.updatedByUserId,
  dirty: isDirty(draft.snapshot, activeSnapshot),
})


export interface ErrorBody {
  readonly code: string
  readonly message: string
  readonly errors?: ReadonlyArray<FieldError>
}

export const jsonError = (
  c: Readonly<Context>,
  status: 400 | 401 | 403 | 404 | 409 | 500,
  body: ErrorBody
): Response =>
  c.json(
    {
      success: false,
      message: body.message,
      code: body.code,
      ...(body.errors !== undefined ? { errors: body.errors } : {}),
    },
    status
  )


const resolveCaller = async (
  c: Readonly<Context>,
  app: Readonly<App>
): Promise<CallerContext | undefined> => {
  if (!app.auth) return undefined
  const auth = createAuthInstance(app.auth)
  try {
    const result = (await auth.api.getSession({ headers: c.req.raw.headers })) as {
      readonly session?: { readonly userId?: string }
      readonly user?: { readonly id?: string }
    } | null
    const userId = result?.session?.userId ?? result?.user?.id
    if (typeof userId !== 'string' || userId.length === 0) return undefined
    const { getUserRole } = await import('@/application/use-cases/tables/user-role')
    const role = await getUserRole(userId)
    return { userId, role }
  } catch {
    return undefined
  }
}

export const withAdmin = async (
  c: Readonly<Context>,
  app: Readonly<App>,
  handler: (caller: CallerContext) => Promise<Response>
): Promise<Response> => {
  if (!app.auth) {
    return handler({ userId: 'system', role: 'admin' })
  }
  const caller = await resolveCaller(c, app)
  if (caller === undefined) {
    return jsonError(c, 401, { code: 'UNAUTHORIZED', message: 'Authentication required' })
  }
  if (caller.role !== 'admin') {
    return jsonError(c, 403, { code: 'FORBIDDEN', message: 'Admin access required' })
  }
  return handler(caller)
}


export const parseBody = async (
  c: Readonly<Context>
): Promise<Record<string, unknown> | undefined> => {
  try {
    const body = await c.req.json()
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

export const objectField = (
  body: Readonly<Record<string, unknown>> | undefined,
  key: string
): Record<string, unknown> | undefined => {
  const value = body?.[key]
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined
}


export const readFamily = (snapshot: Snapshot, family: string): ResourceArray => {
  const value = snapshot[family]
  return Array.isArray(value) ? (value as ResourceArray) : []
}

export const identityOf = (
  entry: Readonly<Record<string, unknown>>,
  key: string
): string | undefined => {
  const value = entry[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return undefined
}

export const deepMerge = (
  base: Readonly<Record<string, unknown>>,
  patch: Readonly<Record<string, unknown>>
): Record<string, unknown> =>
  Object.entries(patch).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      const existing = acc[key]
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof existing === 'object' &&
        existing !== null &&
        !Array.isArray(existing)
      ) {
        return {
          ...acc,
          [key]: deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>),
        }
      }
      return { ...acc, [key]: value }
    },
    { ...base }
  )


export const persistAndRespond = async (input: {
  readonly c: Readonly<Context>
  readonly draft: DraftRow
  readonly caller: CallerContext
  readonly nextSnapshot: Snapshot
  readonly changed: boolean
}): Promise<Response> => {
  const { c, draft, caller, nextSnapshot, changed } = input
  const persist = changed
    ? writeDraft({ snapshot: nextSnapshot, baseVersion: draft.baseVersion, userId: caller.userId })
    : Promise.resolve()
  const activeSnapshot = await persist.then(() => readActiveVersionSnapshot())
  const updated: DraftRow = changed
    ? {
        snapshot: nextSnapshot,
        baseVersion: draft.baseVersion,
        updatedAt: new Date().toISOString(),
        updatedByUserId: caller.userId,
      }
    : draft
  return c.json({ draft: draftEnvelope(updated, activeSnapshot), changed }, 200)
}
