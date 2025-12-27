/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { isRateLimitExceeded, recordRateLimitRequest, extractClientIp } from './auth-route-utils'
import type { App } from '@/domain/models/app'

/**
 * Apply rate limiting middleware for admin endpoints
 * Returns a Hono app with rate limiting middleware applied
 */
const applyRateLimitMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    const ip = extractClientIp(c.req.header('x-forwarded-for'))

    if (isRateLimitExceeded(ip)) {
      return c.json({ error: 'Too many requests' }, 429)
    }

    recordRateLimitRequest(ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

    // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
    await next()
  })
}

/**
 * Setup CORS middleware for Better Auth endpoints
 *
 * Configures CORS to allow:
 * - All localhost origins for development/testing
 * - Credentials for cookie-based authentication
 * - Common headers and methods
 *
 * If no auth configuration is provided in the app, middleware is not applied.
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration with auth settings
 * @returns Hono app with CORS middleware configured (or unchanged if auth is disabled)
 */
export function setupAuthMiddleware(honoApp: Readonly<Hono>, app?: App): Readonly<Hono> {
  // If no auth config is provided, don't apply CORS middleware
  if (!app?.auth) {
    return honoApp
  }

  return honoApp.use(
    '/api/auth/*',
    cors({
      origin: (origin) => {
        // Allow all localhost origins for development and testing
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return origin
        }
        // In production, this should be configured with specific allowed origins
        return origin
      },
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true, // Required for cookie-based authentication
    })
  )
}

/**
 * Setup Better Auth routes with dynamic configuration
 *
 * Mounts Better Auth handler at /api/auth/* which provides all authentication endpoints.
 *
 * Creates a Better Auth instance dynamically based on the app's auth configuration,
 * allowing features like requireEmailVerification to be controlled per app.
 *
 * IMPORTANT: Better Auth instance is created once per app configuration and reused
 * across all requests to maintain internal state consistency.
 *
 * If no auth configuration is provided, no auth routes are registered and all
 * /api/auth/* requests will return 404 Not Found.
 *
 * Better Auth natively provides:
 * - Authentication: sign-up, sign-in, sign-out, verify-email, send-verification-email
 * - Admin Plugin: list-users, get-user, set-role, ban-user, unban-user, impersonate-user, stop-impersonating
 * - Organization Plugin: create-organization, list-organizations, get-organization, set-active-organization
 * - Two-Factor: enable, disable, verify
 * - Magic Link: send, verify
 *
 * Native Better Auth handles:
 * - Banned user rejection (automatic in admin plugin)
 * - Single-use verification tokens (automatic)
 * - Admin role validation (via adminRoles/adminUserIds config)
 * - Organization membership validation (automatic)
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration with auth settings
 * @returns Hono app with auth routes configured (or unchanged if auth is disabled)
 */
export function setupAuthRoutes(honoApp: Readonly<Hono>, app?: App): Readonly<Hono> {
  // If no auth config is provided, don't register any auth routes
  // This causes all /api/auth/* requests to return 404 (not found)
  if (!app?.auth) {
    return honoApp
  }

  // Create Better Auth instance with app-specific configuration (once per app startup)
  // This instance is reused across all requests to maintain internal state
  const authInstance = createAuthInstance(app.auth)

  // Apply rate limiting middleware to admin routes (if admin plugin is enabled)
  const appWithRateLimit = app.auth.admin ? applyRateLimitMiddleware(honoApp) : honoApp

  // Add custom create-team endpoint (Better Auth doesn't provide this natively)
  const appWithCreateTeam =
    app.auth.organization &&
    typeof app.auth.organization === 'object' &&
    app.auth.organization.teams
      ? appWithRateLimit.post('/api/auth/organization/create-team', async (c) => {
          const session = await authInstance.api.getSession({ headers: c.req.raw.headers })

          if (!session) {
            return c.json({ error: 'Unauthorized' }, 401)
          }

          const { organizationId, name } = await c.req.json()

          if (!organizationId || !name) {
            return c.json({ error: 'Organization ID and team name are required' }, 400)
          }

          const { db } = await import('@/infrastructure/database')
          const { teams, members } = await import('@/infrastructure/auth/better-auth/schema')
          const { eq, and } = await import('drizzle-orm')

          // Check if user is a member of the organization
          const membership = await db
            .select()
            .from(members)
            .where(
              and(eq(members.organizationId, organizationId), eq(members.userId, session.user.id))
            )
            .then((rows: readonly (typeof members.$inferSelect)[]) => rows[0])

          if (!membership) {
            return c.json({ error: 'Not a member of this organization' }, 403)
          }

          // Check if user has owner or admin role
          if (membership.role !== 'owner' && membership.role !== 'admin') {
            return c.json(
              { error: 'Insufficient permissions. Only owners and admins can create teams.' },
              403
            )
          }

          // Create the team
          const newTeam = await db
            .insert(teams)
            .values({
              id: crypto.randomUUID(),
              organizationId,
              name,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning()
            .then((rows: readonly (typeof teams.$inferSelect)[]) => rows[0])

          return c.json(newTeam, 200)
        })
      : appWithRateLimit

  // Add authorization middleware for team member operations (if organization plugin with teams is enabled)
  const appWithTeamAuth =
    app.auth.organization &&
    typeof app.auth.organization === 'object' &&
    app.auth.organization.teams
      ? appWithCreateTeam.use('/api/auth/organization/add-team-member', async (c, next) => {
          const session = await authInstance.api.getSession({ headers: c.req.raw.headers })

          if (!session) {
            return c.json({ error: 'Unauthorized' }, 401)
          }

          // Clone request to preserve body for Better Auth handler
          const clonedRequest = c.req.raw.clone()
          const { teamId, userId } = await clonedRequest.json()

          if (!teamId) {
            return c.json({ error: 'Team ID is required' }, 400)
          }

          // Get the team to find its organization
          const { db } = await import('@/infrastructure/database')
          const { teams, members, teamMembers } =
            await import('@/infrastructure/auth/better-auth/schema')
          const { eq, and } = await import('drizzle-orm')

          const teamResult = await db
            .select()
            .from(teams)
            .where(eq(teams.id, teamId))
            .then((rows: readonly (typeof teams.$inferSelect)[]) => rows[0])
            .catch(() => undefined)

          if (!teamResult) {
            return c.json({ error: 'Team not found' }, 404)
          }

          const team = teamResult

          if (!team) {
            return c.json({ error: 'Team not found' }, 404)
          }

          // Check if user is a member of the organization
          const membership = await db
            .select()
            .from(members)
            .where(
              and(
                eq(members.organizationId, team.organizationId),
                eq(members.userId, session.user.id)
              )
            )
            .then((rows: readonly (typeof members.$inferSelect)[]) => rows[0])

          if (!membership) {
            return c.json({ error: 'Not a member of this organization' }, 403)
          }

          // Check if user has owner or admin role
          if (membership.role !== 'owner' && membership.role !== 'admin') {
            return c.json(
              { error: 'Insufficient permissions. Only owners and admins can add team members.' },
              403
            )
          }

          // Check if the target user is a member of the organization (400 Bad Request)
          if (userId) {
            const targetUserMembership = await db
              .select()
              .from(members)
              .where(
                and(eq(members.organizationId, team.organizationId), eq(members.userId, userId))
              )
              .then((rows: readonly (typeof members.$inferSelect)[]) => rows[0])

            if (!targetUserMembership) {
              return c.json({ error: 'User is not a member of this organization' }, 400)
            }
          }

          // Check if the target user is already a team member (409 Conflict)
          if (userId) {
            const existingTeamMember = await db
              .select()
              .from(teamMembers)
              .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
              .then((rows: readonly (typeof teamMembers.$inferSelect)[]) => rows[0])

            if (existingTeamMember) {
              return c.json({ error: 'User is already a member of this team' }, 409)
            }
          }

          // Authorization passed, continue to Better Auth handler
          // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
          await next()
        })
      : appWithCreateTeam

  // Mount Better Auth handler for all /api/auth/* routes
  // Better Auth natively handles:
  // - Authentication flows (sign-up, sign-in, sign-out, email verification)
  // - Admin operations (list-users, get-user, set-role, ban-user, impersonation)
  // - Organization management (create, list, get, set-active, invite members)
  // - Two-factor authentication (enable, disable, verify)
  // - Magic link authentication (send, verify)
  // - Banned user rejection (automatic for admin plugin)
  // - Single-use verification tokens (automatic)
  //
  // IMPORTANT: Better Auth handles its own routing and expects the FULL request path
  // including the /api/auth prefix. We pass the original request without modification.
  return appWithTeamAuth.on(['POST', 'GET'], '/api/auth/*', async (c) => {
    return authInstance.handler(c.req.raw)
  })
}
