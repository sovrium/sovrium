/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { and, eq } from 'drizzle-orm'
import { type Hono } from 'hono'
import { SOVRIUM_ORGANIZATION_ID } from '@/infrastructure/auth/better-auth/org-team-seeder'
import { db } from '@/infrastructure/database'
import {
  authMembersTable,
  authTeamMembersTable,
  authTeamsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>

const unauthorized = { message: 'Authentication required' }

const forwardToBetterAuth = async (
  authInstance: AuthInstance,
  request: Request,
  rewrittenPath?: string
): Promise<Response> => {
  if (!rewrittenPath) return authInstance.handler(request)

  const url = new URL(request.url)
  url.pathname = rewrittenPath
  const body = await request.clone().arrayBuffer()
  return authInstance.handler(
    new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: body.byteLength > 0 ? body : undefined,
    })
  )
}

type TeamRouteContext = {
  readonly req: { readonly raw: Request; readonly query: (name: string) => string | undefined }
  readonly json: (body: unknown, status?: number) => Response
}

const envelopeListResponse = async (
  authInstance: AuthInstance,
  c: TeamRouteContext,
  key: 'teams' | 'members'
): Promise<Response> => {
  const response = await authInstance.handler(c.req.raw)
  if (response.status !== 200) return response
  const data = await response
    .clone()
    .json()
    .catch(() => undefined)
  if (!Array.isArray(data)) return response
  return c.json({ [key]: data }, 200)
}

const handleGetTeam = async (
  authInstance: AuthInstance,
  c: TeamRouteContext
): Promise<Response> => {
  const session = await authInstance.api
    .getSession({ headers: c.req.raw.headers })
    .catch(() => undefined)
  if (!session) return c.json(unauthorized, 401)

  const teamId = c.req.query('teamId')
  if (!teamId) {
    return c.json({ message: 'teamId query parameter is required' }, 400)
  }

  const teams = authTeamsTable()
  const rows = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  const team = rows[0]
  if (!team || team.organizationId !== SOVRIUM_ORGANIZATION_ID) {
    return c.json({ message: 'Team not found' }, 404)
  }
  return c.json(team, 200)
}

const isOrganizationManager = async (userId: string): Promise<boolean> => {
  const members = authMembersTable()
  const rows = await db
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.organizationId, SOVRIUM_ORGANIZATION_ID)))
    .limit(1)
  const role = rows[0]?.role
  return role === 'owner' || role === 'admin'
}

const handleListTeamMembers = async (
  authInstance: AuthInstance,
  c: TeamRouteContext
): Promise<Response> => {
  const enveloped = await envelopeListResponse(authInstance, c, 'members')
  if (enveloped.status !== 400) return enveloped

  const errorBody = await enveloped
    .clone()
    .json()
    .catch(() => undefined)
  const code = (errorBody as { code?: unknown } | undefined)?.code
  if (code !== 'USER_IS_NOT_A_MEMBER_OF_THE_TEAM') return enveloped

  const session = await authInstance.api
    .getSession({ headers: c.req.raw.headers })
    .catch(() => undefined)
  const userId = session?.user?.id
  if (!userId || !(await isOrganizationManager(userId))) return enveloped

  const teamId = c.req.query('teamId')
  if (!teamId) return enveloped

  const teamMembers = authTeamMembersTable()
  const rows = await db
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      createdAt: teamMembers.createdAt,
    })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))

  return c.json({ members: rows }, 200)
}

const resolveMaxMembers = async (teamId: string, app: App): Promise<number | undefined> => {
  const groups = app.auth?.groups ?? []
  if (groups.length === 0) return undefined

  const teams = authTeamsTable()
  const rows = await db
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  const teamName = rows[0]?.name
  if (!teamName) return undefined

  return groups.find((group) => group.name === teamName)?.maxMembers
}

const capacityExceededLimit = async (teamId: string, app: App): Promise<number | undefined> => {
  const maxMembers = await resolveMaxMembers(teamId, app)
  if (maxMembers === undefined) return undefined

  const teamMembers = authTeamMembersTable()
  const currentCount = (
    await db.select({ id: teamMembers.id }).from(teamMembers).where(eq(teamMembers.teamId, teamId))
  ).length

  return currentCount >= maxMembers ? maxMembers : undefined
}

const isExistingTeamMember = async (
  teamId: string | undefined,
  userId: string | undefined
): Promise<boolean> => {
  if (teamId === undefined || userId === undefined) return false
  const teamMembers = authTeamMembersTable()
  const rows = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1)
  return rows.length > 0
}

const handleAddTeamMember = async (
  authInstance: AuthInstance,
  c: TeamRouteContext,
  app: App
): Promise<Response> => {
  const body = (await c.req.raw
    .clone()
    .json()
    .catch(() => undefined)) as { teamId?: unknown; userId?: unknown } | undefined
  const teamId = typeof body?.teamId === 'string' ? body.teamId : undefined
  const userId = typeof body?.userId === 'string' ? body.userId : undefined

  const alreadyMember = await isExistingTeamMember(teamId, userId)

  const breachedLimit =
    teamId !== undefined && !alreadyMember ? await capacityExceededLimit(teamId, app) : undefined
  if (breachedLimit !== undefined) {
    return c.json({ message: `Team has reached its maximum of ${breachedLimit} members` }, 422)
  }

  const response = await authInstance.handler(c.req.raw)
  if (response.status !== 200) return response

  if (alreadyMember) {
    return c.json({ message: 'User is already a member of this team' }, 400)
  }
  return response
}

export const chainOrganizationTeamRoutes = (
  honoApp: Readonly<Hono>,
  authInstance: AuthInstance,
  app?: App
): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  return honoApp
    .get('/api/auth/organization/list-teams', (c) => envelopeListResponse(authInstance, c, 'teams'))
    .get('/api/auth/organization/list-team-members', (c) => handleListTeamMembers(authInstance, c))
    .get('/api/auth/organization/get-team', (c) => handleGetTeam(authInstance, c))
    .post('/api/auth/organization/delete-team', (c) =>
      forwardToBetterAuth(authInstance, c.req.raw, '/api/auth/organization/remove-team')
    )
    .post('/api/auth/organization/add-team-member', (c) =>
      handleAddTeamMember(authInstance, c, app)
    )
}
