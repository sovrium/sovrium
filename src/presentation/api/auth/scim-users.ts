/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { countActiveAdmins } from '@/application/use-cases/auth/count-admins'
import { scimPatchRequestSchema, scimUserRequestSchema } from '@/domain/models/api/auth/scim'
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
import { answerFailures, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
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
  isLiftableByDirectory,
  isUnverifiedSelfRegistered,
  listUsers,
  readDeclaredGroups,
  readUser,
  readUserByEmail,
  renameUser,
  scimStore,
  setUserActive,
  UNVERIFIED_ACCOUNT_DETAIL,
  type ScimAuthContext,
} from './scim-store'
import type { ScimUserRow } from './scim-resources'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

type ContextOf = () => Promise<ScimAuthContext>

const MAX_PAGE = 200

/** A user as its SCIM resource, with the declared groups it belongs to. */
const userResource = (c: Context, app: App, ctx: ScimAuthContext, user: ScimUserRow) =>
  Effect.gen(function* () {
    const groups = (yield* scimStore(() => readDeclaredGroups(ctx, app))).filter((group) =>
      group.memberIds.includes(user.id)
    )
    return toScimUser(scimOrigin(c), user, groups)
  })

const pageParameter = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const list = (app: App, context: ContextOf) => (c: Context) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const email = scimUserNameFilter(c.req.query('filter'))
        if (isScimRefusal(email)) return scimError(400, email.detail, email.scimType)
        const ctx = yield* scimStore(() => context())
        const startIndex = pageParameter(c.req.query('startIndex'), 1)
        const count = Math.min(pageParameter(c.req.query('count'), 100), MAX_PAGE)
        const page = yield* scimStore(() => listUsers(ctx, { email, startIndex, count }))
        const resources = yield* Effect.forEach(
          page.rows,
          (user) => userResource(c, app, ctx, user),
          {
            concurrency: 'unbounded',
          }
        )
        return scimJson(toScimList(resources, page.total, startIndex))
      })
    )
  )

const create = (app: App, context: ContextOf) => (c: Context) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const body = yield* scimStore(() => decodeScimBody(c, scimUserRequestSchema, 'User'))
        if (body instanceof Response) return body
        const ctx = yield* scimStore(() => context())
        const email = scimEmailOf(body)
        if ((yield* scimStore(() => readUserByEmail(ctx, email))) !== undefined) {
          return scimError(409, 'A user with this userName already exists', 'uniqueness')
        }
        const user = yield* scimStore(() =>
          createUser(ctx, { email, name: scimDisplayNameOf(body) })
        )
        if (body.active === false) yield* scimStore(() => setUserActive(ctx, user.id, false))
        yield* recordScimWrite('scim.user.created', user.id)
        const resource = yield* userResource(
          c,
          app,
          ctx,
          (yield* scimStore(() => readUser(ctx, user.id))) ?? user
        )
        return scimJson(resource, 201, { location: resource.meta.location })
      })
    )
  )

const read = (app: App, context: ContextOf) => (c: Context) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const ctx = yield* scimStore(() => context())
        const user = yield* scimStore(() => readUser(ctx, c.req.param('id') ?? ''))
        return user === undefined
          ? scimError(404, 'User not found')
          : scimJson(yield* userResource(c, app, ctx, user))
      })
    )
  )

/**
 * Apply name and active changes, recording one audit entry per kind of write.
 * Deactivating the last account able to administer the app is refused.
 */
const applyChanges = (
  c: Context,
  app: App,
  ctx: ScimAuthContext,
  write: {
    readonly user: ScimUserRow & { readonly role?: string | null }
    readonly changes: ScimUserChanges
  }
) =>
  Effect.gen(function* () {
    const { user, changes } = write
    const wasActive = user.banned !== true
    if (changes.active === false && bansAnAdmin(user.role ?? undefined, !wasActive, app)) {
      const remaining = yield* countActiveAdmins(adminRoleNamesFor(app))
      if (isLastAdmin(remaining)) return scimError(409, lastAdminRemovalMessage(app), 'mutability')
    }
    const { name } = changes
    if (name !== undefined && name !== user.name) {
      yield* scimStore(() => renameUser(ctx, user.id, name))
      yield* recordScimWrite('scim.user.updated', user.id)
    }
    if (activationWrites(user, changes.active)) {
      const active = changes.active === true
      yield* scimStore(() => setUserActive(ctx, user.id, active))
      yield* recordScimWrite(active ? 'scim.user.reactivated' : 'scim.user.deactivated', user.id)
    }
    return undefined
  })

/**
 * Whether `active` changes anything: a deactivation of an active account, or a
 * reactivation of one the directory itself deactivated. An administrator's
 * ban is never lifted by the directory; the account keeps reading `active: false`.
 */
const activationWrites = (user: ScimUserRow, active: boolean | undefined): boolean => {
  const wasActive = user.banned !== true
  if (active === undefined || active === wasActive) return false
  return !active || isLiftableByDirectory(user)
}

/** PATCH, PUT and DELETE share one shape: decode, apply, answer the resource. */
const update =
  (app: App, context: ContextOf, decode: (c: Context) => Promise<ScimUserChanges | Response>) =>
  (c: Context) =>
    runHandlerEffect(
      c,
      answerFailures(
        c,
        Effect.gen(function* () {
          const ctx = yield* scimStore(() => context())
          const user = yield* scimStore(() => readUser(ctx, c.req.param('id') ?? ''))
          if (user === undefined) return scimError(404, 'User not found')
          const changes = yield* scimStore(() => decode(c))
          if (changes instanceof Response) return changes
          if (yield* scimStore(() => isUnverifiedSelfRegistered(ctx, user))) {
            return scimError(409, UNVERIFIED_ACCOUNT_DETAIL, 'uniqueness')
          }
          const refused = yield* applyChanges(c, app, ctx, { user, changes })
          if (refused !== undefined) return refused
          if (c.req.method === 'DELETE') return new Response(null, { status: 204 })
          return scimJson(
            yield* userResource(
              c,
              app,
              ctx,
              (yield* scimStore(() => readUser(ctx, user.id))) ?? user
            )
          )
        })
      )
    )

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
