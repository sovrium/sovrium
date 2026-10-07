/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { scimGroupRequestSchema, scimPatchRequestSchema } from '@/domain/models/api/scim'
import {
  applyMemberChanges,
  isScimRefusal,
  scimMemberChanges,
} from '@/domain/models/app/auth/scim-service'
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
import { readDeclaredGroups, setGroupMembers, type ScimAuthContext } from './scim-store'
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

/** Write a group's new member list, and record it when it changed. */
const writeMembers = async (
  ctx: ScimAuthContext,
  group: ScimGroupRow,
  next: readonly string[]
): Promise<void> => {
  const same =
    next.length === group.memberIds.length && next.every((id) => group.memberIds.includes(id))
  if (same) return
  await setGroupMembers(ctx, group, next)
  await recordScimWrite('scim.group.members.updated', group.id)
}

/** The group again, as stored after a write. */
const reread = async (
  c: Context,
  app: App,
  ctx: ScimAuthContext,
  id: string
): Promise<Response> => {
  const group = (await readDeclaredGroups(ctx, app)).find((candidate) => candidate.id === id)
  return group === undefined
    ? scimError(404, 'Group not found')
    : scimJson(toScimGroup(scimOrigin(c), group))
}

const list = (app: App, context: ContextOf) => async (c: Context) => {
  const groups = await readDeclaredGroups(await context(), app)
  const filter = /^\s*displayName\s+eq\s+"([^"]*)"\s*$/i.exec(c.req.query('filter') ?? '')?.[1]
  const selected = filter === undefined ? groups : groups.filter((group) => group.name === filter)
  const origin = scimOrigin(c)
  return scimJson(
    toScimList(
      selected.map((group) => toScimGroup(origin, group)),
      selected.length,
      1
    )
  )
}

const read = (app: App, context: ContextOf) => async (c: Context) =>
  reread(c, app, await context(), c.req.param('id') ?? '')

/** POST adopts a declared group (setting its members when given); an undeclared one is refused. */
const adopt = (app: App, context: ContextOf) => async (c: Context) => {
  const decoded = await decodeScimBody(c, scimGroupRequestSchema, 'Group')
  if (decoded instanceof Response) return decoded
  const ctx = await context()
  const group = (await readDeclaredGroups(ctx, app)).find(
    (candidate) => candidate.name === decoded.displayName
  )
  if (group === undefined) {
    return scimError(400, 'Only the groups declared in auth.groups exist', 'invalidValue')
  }
  const { members } = decoded
  if (members !== undefined)
    await writeMembers(
      ctx,
      group,
      members.map((member) => member.value)
    )
  const stored = (await readDeclaredGroups(ctx, app)).find((candidate) => candidate.id === group.id)
  return scimJson(toScimGroup(scimOrigin(c), stored ?? group), 201)
}

const patch = (app: App, context: ContextOf) => async (c: Context) => {
  const decoded = await decodeScimBody(c, scimPatchRequestSchema, 'PatchOp')
  if (decoded instanceof Response) return decoded
  const ctx = await context()
  const id = c.req.param('id') ?? ''
  const group = (await readDeclaredGroups(ctx, app)).find((candidate) => candidate.id === id)
  if (group === undefined) return scimError(404, 'Group not found')
  const changes = scimMemberChanges(decoded.Operations)
  if (isScimRefusal(changes)) return scimError(400, changes.detail, changes.scimType)
  await writeMembers(ctx, group, applyMemberChanges(group.memberIds, changes))
  return reread(c, app, ctx, id)
}

const replace = (app: App, context: ContextOf) => async (c: Context) => {
  const decoded = await decodeScimBody(c, scimGroupRequestSchema, 'Group')
  if (decoded instanceof Response) return decoded
  const ctx = await context()
  const id = c.req.param('id') ?? ''
  const group = (await readDeclaredGroups(ctx, app)).find((candidate) => candidate.id === id)
  if (group === undefined) return scimError(404, 'Group not found')
  if (decoded.displayName !== group.name) {
    return scimError(400, 'A declared group cannot be renamed', 'mutability')
  }
  await writeMembers(
    ctx,
    group,
    (decoded.members ?? []).map((member) => member.value)
  )
  return reread(c, app, ctx, id)
}

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
