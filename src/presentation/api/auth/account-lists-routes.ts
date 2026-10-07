/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/account/lists/:list` — the account lists a page binds with
 * `dataSource: { auth: <list> }`, and `POST /api/auth/revoke-session`'s
 * ownership check.
 *
 * Each list is read through Better Auth's OWN endpoint for the caller's session
 * (the request is replayed into `authInstance.handler` with her cookies), so the
 * scope is Better Auth's: her passkeys, her sessions, her API keys. `members`
 * and `invitations` range over the whole app and answer only a caller who may
 * administer accounts — anyone else gets the same 404 as an unknown list (S1).
 * Every row is projected through `src/domain/models/api/account/account-lists`
 * before it leaves: a session's token and a key's secret never reach a page.
 *
 * `revoke-session` is answered here, before Better Auth's catch-all, because
 * Better Auth's own route takes the session TOKEN, and a page's row holds only
 * the session id. The id is resolved among the CALLER'S sessions: an id that
 * is not hers answers 404 — exactly as an id that does not exist — and hers is
 * revoked through Better Auth's endpoint with its token.
 *
 * `decline-invitation` is the invitee's answer from her link: PUBLIC, because
 * she has no session yet, and authorised by the token alone — the credential
 * the invitation email carries. An unknown, used or revoked token answers 404.
 */

import {
  declineInvitation,
  listInvitations,
} from '@/application/use-cases/auth/admin-invitation-lifecycle'
import {
  accountApiKeysResponseSchema,
  accountDeclineInvitationRequestSchema,
  accountInvitationsResponseSchema,
  accountMembersResponseSchema,
  accountPasskeysResponseSchema,
  accountRevokeSessionRequestSchema,
  accountSessionsResponseSchema,
} from '@/domain/models/api/account/account'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { describeUserAgent } from '@/domain/models/app/auth/user-agent-label-service'
import { logError } from '@/infrastructure/logging/logger'
import { requireAdminCaller } from '@/presentation/api/auth/admin-invitation-guard'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { validateRequest } from '@/presentation/api/runtime/validate-request'
import type { InvitationServices } from '@/application/ports/contracts/invitation-services'
import type { accountDeclineInvitationResponseSchema } from '@/domain/models/api/account/account'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { Schema } from 'effect'
import type { Context, Hono } from 'hono'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>
type Row = Readonly<Record<string, unknown>>

interface AccountListDeps {
  readonly authInstance: AuthInstance
  readonly invitations: InvitationServices
  readonly app: App
}

/** Read one of Better Auth's own endpoints as the caller. */
const readAsCaller = async (deps: AccountListDeps, c: Context, path: string): Promise<unknown> => {
  const url = new URL(path, c.req.url)
  const headers = new Headers({ cookie: c.req.header('cookie') ?? '' })
  const agent = c.req.header('user-agent')
  if (agent !== undefined) headers.set('user-agent', agent)
  const response = await deps.authInstance.handler(new Request(url, { headers }))
  return response.ok ? ((await response.json()) as unknown) : undefined
}

/** The array a Better Auth list answers, bare or under `key`. */
const arrayOf = (body: unknown, key: string): readonly Row[] => {
  if (Array.isArray(body)) return body as readonly Row[]
  const nested = (body as Record<string, unknown> | undefined)?.[key]
  return Array.isArray(nested) ? (nested as readonly Row[]) : []
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')
const iso = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  return null
}

/** The 401 every route here answers a caller with no session. */
const unauthenticated = (c: Context): Response =>
  c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)

/** The session id the caller is reading with. */
const currentSessionId = async (deps: AccountListDeps, c: Context): Promise<string | undefined> => {
  const body = (await readAsCaller(deps, c, '/api/auth/get-session')) as
    { readonly session?: { readonly id?: unknown } } | undefined
  return typeof body?.session?.id === 'string' ? body.session.id : undefined
}

const passkeys = async (deps: AccountListDeps, c: Context) => ({
  rows: arrayOf(
    await readAsCaller(deps, c, '/api/auth/passkey/list-user-passkeys'),
    'passkeys'
  ).map((row) => ({
    id: str(row['id']),
    name: str(row['name']),
    deviceType: typeof row['deviceType'] === 'string' ? row['deviceType'] : null,
    createdAt: iso(row['createdAt']),
  })),
})

const sessions = async (deps: AccountListDeps, c: Context) => {
  const [list, current] = await Promise.all([
    readAsCaller(deps, c, '/api/auth/list-sessions'),
    currentSessionId(deps, c),
  ])
  return {
    rows: arrayOf(list, 'sessions').map((row) => ({
      id: str(row['id']),
      device: describeUserAgent(str(row['userAgent'])),
      ipAddress: typeof row['ipAddress'] === 'string' ? row['ipAddress'] : null,
      lastActiveAt: iso(row['updatedAt']),
      current: row['id'] === current,
    })),
  }
}

const apiKeys = async (deps: AccountListDeps, c: Context) => ({
  rows: arrayOf(await readAsCaller(deps, c, '/api/auth/api-key/list'), 'apiKeys').map((row) => ({
    id: str(row['id']),
    name: str(row['name']),
    prefix: str(row['start'] ?? row['prefix']),
    lastUsedAt: iso(row['lastRequest']),
    expiresAt: iso(row['expiresAt']),
  })),
})

const members = async (deps: AccountListDeps, c: Context) => ({
  rows: arrayOf(await readAsCaller(deps, c, '/api/auth/admin/list-users?limit=1000'), 'users').map(
    (row) => ({
      id: str(row['id']),
      name: str(row['name']),
      email: str(row['email']),
      image: typeof row['image'] === 'string' ? row['image'] : null,
      role: str(row['role']),
      joinedAt: iso(row['createdAt']),
    })
  ),
})

const invitations = async (deps: AccountListDeps) => ({
  rows: (await listInvitations(deps.invitations.store))
    .filter((item) => item.status === 'pending')
    .map((item) => ({
      id: item.id,
      email: item.email,
      role: item.role,
      invitedBy: item.invitedBy,
      sentAt: item.createdAt,
      expiresAt: item.expiresAt,
    })),
})

/** Each list: whether it needs an administrator, its reader, its wire schema. */
const LISTS: Readonly<
  Record<
    string,
    {
      readonly admin: boolean
      readonly read: (deps: AccountListDeps, c: Context) => Promise<unknown>
      readonly schema: Schema.Top
    }
  >
> = {
  passkeys: { admin: false, read: passkeys, schema: accountPasskeysResponseSchema },
  sessions: { admin: false, read: sessions, schema: accountSessionsResponseSchema },
  apiKeys: { admin: false, read: apiKeys, schema: accountApiKeysResponseSchema },
  members: { admin: true, read: members, schema: accountMembersResponseSchema },
  invitations: { admin: true, read: invitations, schema: accountInvitationsResponseSchema },
}

const handleList = (deps: AccountListDeps) => async (c: Context) => {
  const list = LISTS[c.req.param('list') ?? '']
  if (list === undefined) return notFound(c, 'Not Found')
  try {
    if (list.admin) {
      const authorized = await requireAdminCaller(deps.authInstance, c, deps.app)
      if (authorized instanceof Response)
        return authorized.status === 401 ? authorized : notFound(c, 'Not Found')
    } else if ((await currentSessionId(deps, c)) === undefined) {
      return unauthenticated(c)
    }
    const parsed = decodeSafe(list.schema)(await list.read(deps, c))
    if (!parsed.success) {
      logError('[account-lists] response validation failed', parsed.error)
      return c.json(
        { success: false, message: 'Failed to read the list', code: 'INTERNAL_ERROR' },
        500
      )
    }
    c.header('Cache-Control', 'no-store')
    return c.json(parsed.data as Record<string, unknown>, 200)
  } catch (error) {
    logError('[account-lists] list handler crashed', error)
    return c.json(
      { success: false, message: 'Failed to read the list', code: 'INTERNAL_ERROR' },
      500
    )
  }
}

/** `POST /api/auth/revoke-session` — the caller's own session by id or token, else 404. */
const handleRevokeSession = (deps: AccountListDeps) => async (c: Context) => {
  if ((await currentSessionId(deps, c)) === undefined) return unauthenticated(c)
  const parsed = await validateRequest(c, accountRevokeSessionRequestSchema)
  if (!parsed.success) return parsed.response
  const body = parsed.data
  const own = arrayOf(await readAsCaller(deps, c, '/api/auth/list-sessions'), 'sessions')
  const match = own.find(
    (row) =>
      (typeof body.id === 'string' && row['id'] === body.id) ||
      (typeof body.token === 'string' && row['token'] === body.token)
  )
  if (match === undefined) return notFound(c, 'Not Found')
  const headers = new Headers(c.req.raw.headers)
  headers.set('content-type', 'application/json')
  return deps.authInstance.handler(
    new Request(c.req.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token: match['token'] }),
    })
  )
}

/** `POST /api/auth/decline-invitation` — end the invitation the token names, else 404. */
const handleDeclineInvitation = (deps: AccountListDeps) => async (c: Context) => {
  const parsed = await validateRequest(c, accountDeclineInvitationRequestSchema)
  if (!parsed.success) return parsed.response
  try {
    const result = await declineInvitation(deps.invitations.store, parsed.data.token)
    if (result.status === 'not-found') return notFound(c, 'Not Found')
    if (result.status !== 'ok') {
      return c.json({ success: false, message: result.message, code: 'INTERNAL_ERROR' }, 500)
    }
    const declined: typeof accountDeclineInvitationResponseSchema.Type = { declined: true }
    return c.json(declined, 200)
  } catch (error) {
    logError('[account-lists] decline-invitation handler crashed', error)
    return c.json(
      { success: false, message: 'Failed to decline the invitation', code: 'INTERNAL_ERROR' },
      500
    )
  }
}

/** Chain the account lists and the revoke-session ownership check. */
export const chainAccountListRoutes = (
  honoApp: Readonly<Hono>,
  deps: AccountListDeps
): Readonly<Hono> =>
  honoApp
    .get('/api/account/lists/:list', handleList(deps))
    .post('/api/auth/revoke-session', handleRevokeSession(deps))
    .post('/api/auth/decline-invitation', handleDeclineInvitation(deps))
