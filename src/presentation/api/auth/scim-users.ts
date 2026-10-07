/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { countActiveAdmins } from '@/application/use-cases/auth/count-admins'
import { scimPatchRequestSchema, scimUserRequestSchema } from '@/domain/models/api/scim'
import {
  adminRoleNamesFor,
  bansAnAdmin,
  isLastAdmin,
  lastAdminRemovalMessage,
} from '@/domain/models/app/auth/roles/role-write-validation'
import {
  isScimRefusal,
  scimDisplayNameOf,
  scimEmailOf,
  scimUserChanges,
  scimUserNameFilter,
  type ScimUserChanges,
} from '@/domain/models/app/auth/scim-service'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { recordScimWrite } from './scim-audit'
import {
  SCIM_BASE_PATH,
  decodeScimBody,
  scimError,
  scimJson,
  scimOrigin,
  toScimList,
  toScimUser,
} from './scim-resources'
import {
  createUser,
  listUsers,
  readDeclaredGroups,
  readUser,
  readUserByEmail,
  renameUser,
  setUserActive,
  type ScimAuthContext,
} from './scim-store'
import type { ScimUserRow } from './scim-resources'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

type ContextOf = () => Promise<ScimAuthContext>

const MAX_PAGE = 200

/** A user as its SCIM resource, with the declared groups it belongs to. */
const userResource = async (
  c: Context,
  app: App,
  ctx: ScimAuthContext,
  user: ScimUserRow
): Promise<ReturnType<typeof toScimUser>> => {
  const groups = (await readDeclaredGroups(ctx, app)).filter((group) =>
    group.memberIds.includes(user.id)
  )
  return toScimUser(scimOrigin(c), user, groups)
}

const pageParameter = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const list = (app: App, context: ContextOf) => async (c: Context) => {
  const email = scimUserNameFilter(c.req.query('filter'))
  if (isScimRefusal(email)) return scimError(400, email.detail, email.scimType)
  const ctx = await context()
  const startIndex = pageParameter(c.req.query('startIndex'), 1)
  const count = Math.min(pageParameter(c.req.query('count'), 100), MAX_PAGE)
  const page = await listUsers(ctx, { email, startIndex, count })
  const resources = await Promise.all(page.rows.map((user) => userResource(c, app, ctx, user)))
  return scimJson(toScimList(resources, page.total, startIndex))
}

const create = (app: App, context: ContextOf) => async (c: Context) => {
  const body = await decodeScimBody(c, scimUserRequestSchema, 'User')
  if (body instanceof Response) return body
  const ctx = await context()
  const email = scimEmailOf(body)
  if ((await readUserByEmail(ctx, email)) !== undefined) {
    return scimError(409, 'A user with this userName already exists', 'uniqueness')
  }
  const user = await createUser(ctx, { email, name: scimDisplayNameOf(body) })
  if (body.active === false) await setUserActive(ctx, user.id, false)
  await recordScimWrite('scim.user.created', user.id)
  const resource = await userResource(c, app, ctx, (await readUser(ctx, user.id)) ?? user)
  return scimJson(resource, 201, { location: resource.meta.location })
}

const read = (app: App, context: ContextOf) => async (c: Context) => {
  const ctx = await context()
  const user = await readUser(ctx, c.req.param('id') ?? '')
  return user === undefined
    ? scimError(404, 'User not found')
    : scimJson(await userResource(c, app, ctx, user))
}

/**
 * Apply name and active changes, recording one audit entry per kind of write.
 * Deactivating the last account able to administer the app is refused.
 */
const applyChanges = async (
  c: Context,
  app: App,
  ctx: ScimAuthContext,
  write: {
    readonly user: ScimUserRow & { readonly role?: string | null }
    readonly changes: ScimUserChanges
  }
): Promise<Response | undefined> => {
  const { user, changes } = write
  const wasActive = user.banned !== true
  if (changes.active === false && bansAnAdmin(user.role ?? undefined, !wasActive, app)) {
    const remaining = await runDomainPromise(c, countActiveAdmins(adminRoleNamesFor(app)))
    if (isLastAdmin(remaining)) return scimError(409, lastAdminRemovalMessage(app), 'mutability')
  }
  if (changes.name !== undefined && changes.name !== user.name) {
    await renameUser(ctx, user.id, changes.name)
    await recordScimWrite('scim.user.updated', user.id)
  }
  if (changes.active !== undefined && changes.active !== wasActive) {
    await setUserActive(ctx, user.id, changes.active)
    await recordScimWrite(
      changes.active ? 'scim.user.reactivated' : 'scim.user.deactivated',
      user.id
    )
  }
  return undefined
}

/** PATCH, PUT and DELETE share one shape: decode, apply, answer the resource. */
const update =
  (app: App, context: ContextOf, decode: (c: Context) => Promise<ScimUserChanges | Response>) =>
  async (c: Context) => {
    const ctx = await context()
    const user = await readUser(ctx, c.req.param('id') ?? '')
    if (user === undefined) return scimError(404, 'User not found')
    const changes = await decode(c)
    if (changes instanceof Response) return changes
    const refused = await applyChanges(c, app, ctx, { user, changes })
    if (refused !== undefined) return refused
    if (c.req.method === 'DELETE') return new Response(null, { status: 204 })
    return scimJson(await userResource(c, app, ctx, (await readUser(ctx, user.id)) ?? user))
  }

const decodePatch = async (c: Context): Promise<ScimUserChanges | Response> => {
  const body = await decodeScimBody(c, scimPatchRequestSchema, 'PatchOp')
  if (body instanceof Response) return body
  const changes = scimUserChanges(body.Operations)
  return isScimRefusal(changes) ? scimError(400, changes.detail, changes.scimType) : changes
}

const decodeReplace = async (c: Context): Promise<ScimUserChanges | Response> => {
  const body = await decodeScimBody(c, scimUserRequestSchema, 'User')
  if (body instanceof Response) return body
  return {
    name: scimDisplayNameOf(body),
    ...(body.active === undefined ? {} : { active: body.active }),
  }
}

/** DELETE deactivates; it never erases. */
const decodeDelete = async (): Promise<ScimUserChanges> => ({ active: false })

/** Mount the Users endpoints. */
export const chainScimUserRoutes = (hono: Hono, app: App, context: ContextOf): Hono => {
  const path = `${SCIM_BASE_PATH}/Users`
  hono.get(path, list(app, context))
  hono.post(path, create(app, context))
  hono.get(`${path}/:id`, read(app, context))
  hono.patch(`${path}/:id`, update(app, context, decodePatch))
  hono.put(`${path}/:id`, update(app, context, decodeReplace))
  hono.delete(`${path}/:id`, update(app, context, decodeDelete))
  return hono
}
