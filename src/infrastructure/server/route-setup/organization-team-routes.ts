/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium organization-team route adapters.
 *
 * The Better Auth organization plugin exposes team CRUD under
 * `/api/auth/organization/*`. Sovrium's group-management API contract differs
 * from the raw plugin in two small ways, so a thin interception layer is
 * registered BEFORE the Better Auth catch-all:
 *
 *  1. **Envelope shape** — Better Auth's `list-teams` and `list-team-members`
 *     return a bare JSON array. Sovrium's API returns `{ teams: [...] }` and
 *     `{ members: [...] }` envelopes for forward-compatibility (pagination
 *     metadata can be added later without breaking clients).
 *
 *  2. **Missing endpoints** — Better Auth has no `get-team` (single team by
 *     id) and names team deletion `remove-team`. Sovrium exposes `get-team`
 *     and `delete-team` as part of its stable group-management surface.
 *
 * `delete-team` delegates to Better Auth's `remove-team` by rewriting the
 * request path, so all RBAC / validation stays in the plugin. `get-team`
 * reads the team row directly after confirming a valid session.
 *
 * Every handler is gated on a valid session — an unauthenticated request to
 * any team endpoint returns 401 (consistent with the rest of the org plugin).
 */

import { and, eq } from 'drizzle-orm'
import { type Hono } from 'hono'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
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

/** Standard 401 body for unauthenticated team-API requests. */
const unauthorized = { message: 'Authentication required' }

/**
 * Forward a request to the Better Auth handler under a (possibly rewritten)
 * path. Used so `delete-team` can reuse the plugin's `remove-team` route.
 */
const forwardToBetterAuth = async (
  authInstance: AuthInstance,
  request: Request,
  rewrittenPath?: string
): Promise<Response> => {
  if (!rewrittenPath) return authInstance.handler(request)

  const url = new URL(request.url)
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements
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

/** Minimal Hono context surface used by the team-API handlers. */
type TeamRouteContext = {
  readonly req: { readonly raw: Request; readonly query: (name: string) => string | undefined }
  readonly json: (body: unknown, status?: number) => Response
}

/**
 * Re-issue a Better Auth list response with a single-key envelope.
 *
 * Better Auth's `list-teams` / `list-team-members` return a bare JSON array;
 * Sovrium wraps it as `{ [key]: [...] }`. A non-200 or non-array response is
 * forwarded untouched.
 */
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

/**
 * Handle `GET /get-team` — single team lookup with no native Better Auth
 * equivalent. Returns 401 without a session, 400 without `teamId`, 404 when
 * the team is absent or belongs to another organization.
 */
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

/**
 * True when the session user is the organization owner (or admin).
 *
 * Better Auth's `listTeamMembers` requires the caller to be a member of the
 * team being queried. An organization owner managing teams legitimately needs
 * to list any team's members (e.g. to confirm an `add-team-member` succeeded),
 * so the owner is allowed a direct-query fallback.
 */
const isOrganizationManager = async (userId: string): Promise<boolean> => {
  const members = authMembersTable()
  const rows = await db
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.organizationId, SOVRIUM_ORGANIZATION_ID)))
    .limit(1)
  const role = rows[0]?.role
  // NOTE: this is the Better Auth ORGANIZATION role namespace, not Sovrium's
  // RBAC role — `isAdminRole` is used for the literal, not for the semantics.
  return role === 'owner' || isAdminRole(role ?? undefined)
}

/**
 * Handle `GET /list-team-members` with an org-manager fallback.
 *
 * Better Auth scopes `listTeamMembers` to team members only — a caller who is
 * not on the team gets a 400 `USER_IS_NOT_A_MEMBER_OF_THE_TEAM`. Sovrium's
 * group-management contract additionally lets the organization owner / admin
 * list any team's members (they manage every group). When Better Auth rejects
 * an org manager with that specific error, fall back to a direct membership
 * query so the owner sees the team roster.
 *
 * All other responses (200 success, 401 unauthenticated, other errors) are
 * forwarded through `envelopeListResponse` untouched.
 */
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

/**
 * Resolve the configured `maxMembers` limit for a team.
 *
 * Sovrium "groups" (`app.auth.groups[]`) are materialised as Better Auth
 * "teams" matched by name. A group MAY declare an optional `maxMembers` cap —
 * a Sovrium-specific extension with no native Better Auth equivalent. Returns
 * `undefined` when the team is unknown or its group declares no limit (the
 * group then allows unlimited members).
 */
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

/**
 * Resolve the configured `maxMembers` cap when the team is already at (or
 * over) capacity, otherwise `undefined`.
 *
 * Returns the cap value only when an add would breach it — callers use the
 * presence of a number to decide whether to reject the request. A team with
 * no declared `maxMembers` (or with spare capacity) yields `undefined`.
 */
const capacityExceededLimit = async (teamId: string, app: App): Promise<number | undefined> => {
  const maxMembers = await resolveMaxMembers(teamId, app)
  if (maxMembers === undefined) return undefined

  const teamMembers = authTeamMembersTable()
  const currentCount = (
    await db.select({ id: teamMembers.id }).from(teamMembers).where(eq(teamMembers.teamId, teamId))
  ).length

  return currentCount >= maxMembers ? maxMembers : undefined
}

/**
 * Handle `POST /add-team-member` — enforce duplicate + capacity rules.
 *
 * Better Auth's `add-team-member` is idempotent (`findOrCreateTeamMember`) and
 * silently succeeds when the user is already on the team, and has no concept
 * of a per-team member cap. Sovrium's group-management contract adds two
 * checks on top of the native endpoint:
 *
 *  1. **Duplicate membership** — a repeat add is an error (HTTP 400) rather
 *     than a silent no-op.
 *  2. **`maxMembers` capacity** — when the team's backing group declares a
 *     `maxMembers` cap, an add that would exceed it is rejected (HTTP 422)
 *     BEFORE forwarding to Better Auth, so the membership is never created.
 *
 * The capacity gate runs before the Better Auth call (the request must not
 * mutate state when the cap is hit); the duplicate gate runs after (so all
 * Better Auth auth / RBAC / validation runs first, and only an authorized
 * 200 on a pre-existing membership is overridden).
 */
/**
 * True when a `team_member` row already links the given user to the team.
 *
 * `teamId`/`userId` may be `undefined` (a malformed body) — in that case the
 * membership cannot be confirmed, so `false` is returned and the request is
 * left for Better Auth to reject.
 */
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

  // Capacity gate — runs before Better Auth so a rejected add never mutates
  // state. Skipped for duplicate adds (they do not increase the head count).
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

/**
 * Register the Sovrium team-API adapters.
 *
 * Returns the Hono app unchanged when auth is not configured (so all
 * `/api/auth/*` requests 404 as before).
 */
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
