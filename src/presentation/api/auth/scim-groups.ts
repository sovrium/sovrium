/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { scimGroupRequestSchema, scimPatchRequestSchema } from '@/domain/models/api/auth/scim'
import {
  applyMemberChanges,
  isScimRefusal,
  scimMemberChanges,
} from '@/domain/models/app/auth/scim-service'
import { answerFailures, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import { recordScimWrite } from './scim-audit'
import {
  SCIM_BASE_PATH,
  decodeScimBody,
  scimError,
  scimJson,
  scimOrigin,
  toScimGroup,
  toScimList,
} from './scim-resources'
import {
  isUnverifiedSelfRegistered,
  readDeclaredGroups,
  readUser,
  scimStore,
  setGroupMembers,
  UNVERIFIED_ACCOUNT_DETAIL,
  type ScimAuthContext,
} from './scim-store'
import type { ScimGroupRow } from './scim-resources'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * SCIM Groups are the groups `auth.groups` declares, and only those: the
 * identity provider changes their members, and cannot create a group the
 * config does not declare (400 `invalidValue`). Each membership change is one
 * audit entry.
 */

type ContextOf = () => Promise<ScimAuthContext>

/** Whether any account `ids` adds to the group is one the directory may not manage. */
const addsUnmanageable = (ctx: ScimAuthContext, group: ScimGroupRow, ids: readonly string[]) =>
  Effect.gen(function* () {
    const added = ids.filter((id) => !group.memberIds.includes(id))
    const refused = yield* Effect.forEach(
      added,
      (id) =>
        Effect.gen(function* () {
          const user = yield* scimStore(() => readUser(ctx, id))
          return (
            user !== undefined && (yield* scimStore(() => isUnverifiedSelfRegistered(ctx, user)))
          )
        }),
      { concurrency: 'unbounded' }
    )
    return refused.includes(true)
  })

/**
 * Write a group's new member list, and record it when it changed. Adding an
 * account opened here on an unverified address is refused (409), and nothing
 * is written.
 */
const writeMembers = (
  c: Context,
  ctx: ScimAuthContext,
  group: ScimGroupRow,
  next: readonly string[]
) =>
  Effect.gen(function* () {
    const same =
      next.length === group.memberIds.length && next.every((id) => group.memberIds.includes(id))
    if (same) return undefined
    if (yield* addsUnmanageable(ctx, group, next)) {
      return scimError(409, UNVERIFIED_ACCOUNT_DETAIL, 'uniqueness')
    }
    yield* scimStore(() => setGroupMembers(ctx, group, next))
    yield* recordScimWrite('scim.group.members.updated', group.id)
    return undefined
  })

/** The group again, as stored after a write. */
const reread = (c: Context, app: App, ctx: ScimAuthContext, id: string) =>
  Effect.gen(function* () {
    const group = (yield* scimStore(() => readDeclaredGroups(ctx, app))).find(
      (candidate) => candidate.id === id
    )
    return group === undefined
      ? scimError(404, 'Group not found')
      : scimJson(toScimGroup(scimOrigin(c), group))
  })

const list = (app: App, context: ContextOf) => (c: Context) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const ctx = yield* scimStore(() => context())
        const groups = yield* scimStore(() => readDeclaredGroups(ctx, app))
        const filter = /^\s*displayName\s+eq\s+"([^"]*)"\s*$/i.exec(
          c.req.query('filter') ?? ''
        )?.[1]
        const selected =
          filter === undefined ? groups : groups.filter((group) => group.name === filter)
        const origin = scimOrigin(c)
        return scimJson(
          toScimList(
            selected.map((group) => toScimGroup(origin, group)),
            selected.length,
            1
          )
        )
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
        return yield* reread(c, app, ctx, c.req.param('id') ?? '')
      })
    )
  )

/** POST adopts a declared group (setting its members when given); an undeclared one is refused. */
const adopt = (app: App, context: ContextOf) => (c: Context) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const decoded = yield* scimStore(() => decodeScimBody(c, scimGroupRequestSchema, 'Group'))
        if (decoded instanceof Response) return decoded
        const ctx = yield* scimStore(() => context())
        const group = (yield* scimStore(() => readDeclaredGroups(ctx, app))).find(
          (candidate) => candidate.name === decoded.displayName
        )
        if (group === undefined) {
          return scimError(400, 'Only the groups declared in auth.groups exist', 'invalidValue')
        }
        const { members } = decoded
        const refused =
          members === undefined
            ? undefined
            : yield* writeMembers(
                c,
                ctx,
                group,
                members.map((member) => member.value)
              )
        if (refused !== undefined) return refused
        const stored = (yield* scimStore(() => readDeclaredGroups(ctx, app))).find(
          (candidate) => candidate.id === group.id
        )
        return scimJson(toScimGroup(scimOrigin(c), stored ?? group), 201)
      })
    )
  )

const patch = (app: App, context: ContextOf) => (c: Context) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const decoded = yield* scimStore(() => decodeScimBody(c, scimPatchRequestSchema, 'PatchOp'))
        if (decoded instanceof Response) return decoded
        const ctx = yield* scimStore(() => context())
        const id = c.req.param('id') ?? ''
        const group = (yield* scimStore(() => readDeclaredGroups(ctx, app))).find(
          (candidate) => candidate.id === id
        )
        if (group === undefined) return scimError(404, 'Group not found')
        const changes = scimMemberChanges(decoded.Operations)
        if (isScimRefusal(changes)) return scimError(400, changes.detail, changes.scimType)
        const refused = yield* writeMembers(
          c,
          ctx,
          group,
          applyMemberChanges(group.memberIds, changes)
        )
        return refused ?? (yield* reread(c, app, ctx, id))
      })
    )
  )

const replace = (app: App, context: ContextOf) => (c: Context) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const decoded = yield* scimStore(() => decodeScimBody(c, scimGroupRequestSchema, 'Group'))
        if (decoded instanceof Response) return decoded
        const ctx = yield* scimStore(() => context())
        const id = c.req.param('id') ?? ''
        const group = (yield* scimStore(() => readDeclaredGroups(ctx, app))).find(
          (candidate) => candidate.id === id
        )
        if (group === undefined) return scimError(404, 'Group not found')
        if (decoded.displayName !== group.name) {
          return scimError(400, 'A declared group cannot be renamed', 'mutability')
        }
        const refused = yield* writeMembers(
          c,
          ctx,
          group,
          (decoded.members ?? []).map((member) => member.value)
        )
        return refused ?? (yield* reread(c, app, ctx, id))
      })
    )
  )

/** Mount the Groups endpoints. */
export const chainScimGroupRoutes = (hono: Hono, app: App, context: ContextOf): Hono => {
  const path = `${SCIM_BASE_PATH}/Groups`
  hono.get(path, list(app, context))
  hono.post(path, adopt(app, context))
  hono.get(`${path}/:id`, read(app, context))
  hono.patch(`${path}/:id`, patch(app, context))
  hono.put(`${path}/:id`, replace(app, context))
  return hono
}
