/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ScimGroupRow, ScimUserRow } from './scim-resources'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'

/**
 * SCIM's reads and writes, through Better Auth's own adapters — the ones its
 * routes use — so a provisioned user is created with the same hooks (the
 * default role, organization membership) as any other, and a deactivation
 * deletes sessions the same way a ban does.
 *
 * Groups are the teams backing `auth.groups`, so SCIM ids for groups are team
 * ids, and only declared groups exist.
 */

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>
export type ScimAuthContext = Awaited<AuthInstance['$context']>

/** The reason a deactivated account carries, shown nowhere a stranger can read. */
const DEACTIVATED_REASON = 'Deactivated by the identity provider'

interface TeamRow {
  readonly id: string
  readonly name: string
  readonly createdAt: Date
  readonly updatedAt?: Date | null
}

interface TeamMemberRow {
  readonly id: string
  readonly teamId: string
  readonly userId: string
}

/** The user with this id, or `undefined`. */
export const readUser = async (
  ctx: ScimAuthContext,
  id: string
): Promise<ScimUserRow | undefined> =>
  ((await ctx.internalAdapter.findUserById(id)) as ScimUserRow | null) ?? undefined

/** The user with this email (case-insensitive), or `undefined`. */
export const readUserByEmail = async (
  ctx: ScimAuthContext,
  email: string
): Promise<ScimUserRow | undefined> => {
  const found = await ctx.internalAdapter.findUserByEmail(email.toLowerCase())
  return (found?.user as ScimUserRow | undefined) ?? undefined
}

/** One page of users, oldest first, optionally narrowed to one email. */
export const listUsers = async (
  ctx: ScimAuthContext,
  query: { readonly email?: string; readonly startIndex: number; readonly count: number }
): Promise<{ readonly rows: readonly ScimUserRow[]; readonly total: number }> => {
  const where =
    query.email === undefined ? undefined : [{ field: 'email', value: query.email.toLowerCase() }]
  const [rows, total] = await Promise.all([
    ctx.internalAdapter.listUsers(
      query.count,
      query.startIndex - 1,
      { field: 'createdAt', direction: 'asc' },
      where
    ),
    ctx.internalAdapter.countTotalUsers(where),
  ])
  return { rows: rows as readonly ScimUserRow[], total }
}

/** Create a provisioned user; Better Auth's create hooks give it the default role. */
export const createUser = async (
  ctx: ScimAuthContext,
  data: { readonly email: string; readonly name: string }
): Promise<ScimUserRow> =>
  (await ctx.internalAdapter.createUser(
    { email: data.email, name: data.name, emailVerified: false },
    { method: 'scim' }
  )) as ScimUserRow

/** Rename a user. */
export const renameUser = async (ctx: ScimAuthContext, id: string, name: string): Promise<void> => {
  await ctx.internalAdapter.updateUser(id, { name })
}

/**
 * Activate or deactivate a user. Deactivation is a ban that ends every
 * session at once; reactivation lifts it. Nothing the user wrote is touched.
 */
export const setUserActive = async (
  ctx: ScimAuthContext,
  id: string,
  active: boolean
): Promise<void> => {
  await ctx.internalAdapter.updateUser(
    id,
    active
      ? { banned: false, banReason: null, banExpires: null }
      : { banned: true, banReason: DEACTIVATED_REASON, banExpires: null }
  )
  if (!active) await ctx.internalAdapter.deleteUserSessions(id)
}

/** The declared groups, each with its members, in declaration order. */
export const readDeclaredGroups = async (
  ctx: ScimAuthContext,
  app: App
): Promise<readonly ScimGroupRow[]> => {
  const declared = (app.auth?.groups ?? []).map((group) => group.name)
  if (declared.length === 0) return []
  const teams = (await ctx.adapter.findMany({ model: 'team' })) as readonly TeamRow[]
  const members = (await ctx.adapter.findMany({ model: 'teamMember' })) as readonly TeamMemberRow[]
  return declared.flatMap((name) => {
    const team = teams.find((candidate) => candidate.name === name)
    if (team === undefined) return []
    return [
      {
        id: team.id,
        name: team.name,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt ?? null,
        memberIds: members.filter((m) => m.teamId === team.id).map((m) => m.userId),
      },
    ]
  })
}

/**
 * Bring a group's members to `next`: rows for new members are added, rows for
 * members no longer listed removed. Ids that name no user are ignored.
 */
export const setGroupMembers = async (
  ctx: ScimAuthContext,
  group: ScimGroupRow,
  next: readonly string[]
): Promise<void> => {
  const known = await Promise.all(
    next.map(async (id) => ((await readUser(ctx, id)) ? id : undefined))
  )
  const target = known.filter((id): id is string => id !== undefined)
  const added = target.filter((id) => !group.memberIds.includes(id))
  const removed = group.memberIds.filter((id) => !target.includes(id))
  await Promise.all([
    ...added.map((userId) =>
      ctx.adapter.create({
        model: 'teamMember',
        data: { teamId: group.id, userId, createdAt: new Date() },
      })
    ),
    ...removed.map((userId) =>
      ctx.adapter.deleteMany({
        model: 'teamMember',
        where: [
          { field: 'teamId', value: group.id },
          { field: 'userId', value: userId },
        ],
      })
    ),
  ])
}
