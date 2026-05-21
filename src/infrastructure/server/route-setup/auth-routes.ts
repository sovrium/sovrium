/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider'
import { eq } from 'drizzle-orm'
import { type Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'
import { oauthAccessTokens, oauthClients } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'
import { logError } from '@/infrastructure/logging/logger'
import { chainAdminInvitationRoutes } from './admin-invitation-routes'
import {
  isRateLimitExceeded,
  recordRateLimitRequest,
  extractClientIp,
  isAuthRateLimitExceeded,
  recordAuthRateLimitRequest,
  getAuthRateLimitRetryAfter,
} from './auth-route-utils'
import { chainOrganizationTeamRoutes } from './organization-team-routes'
import type { App } from '@/domain/models/app'

const PUBLIC_ADMIN_PATHS: ReadonlySet<string> = new Set(['/api/auth/admin/accept-invitation'])

const ADMIN_ROLE_CHECK_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  '/api/auth/admin/stop-impersonating',
])

const applyAuthCheckMiddleware = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>
): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    if (PUBLIC_ADMIN_PATHS.has(c.req.path)) {
      await next()
      return
    }

    try {
      const session = await authInstance.api.getSession({
        headers: c.req.raw.headers,
      })

      if (!session) {
        return c.json(
          { success: false, message: 'Authentication required', code: 'UNAUTHORIZED' },
          401
        )
      }

      await next()
    } catch (error) {
      logError('[Auth Middleware] Session check error', error)
      return c.json(
        { success: false, message: 'Authentication required', code: 'UNAUTHORIZED' },
        401
      )
    }
  })
}

const applyAdminRoleCheckMiddleware = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>
): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    if (PUBLIC_ADMIN_PATHS.has(c.req.path) || ADMIN_ROLE_CHECK_EXEMPT_PATHS.has(c.req.path)) {
      await next()
      return
    }

    try {
      const sessionResult = (await authInstance.api.getSession({
        headers: c.req.raw.headers,
      })) as { readonly user?: { readonly role?: string } } | null

      const role = sessionResult?.user?.role
      if (role !== 'admin') {
        return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
      }

      await next()
    } catch (error) {
      logError('[Admin Role Middleware] Session check error', error)
      return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
    }
  })
}

const applyRateLimitMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    const ip = extractClientIp(c.req.header('x-forwarded-for'))

    if (isRateLimitExceeded(ip)) {
      return c.json(
        {
          success: false,
          message: 'Too many requests. Please try again later.',
          code: 'RATE_LIMITED',
        },
        429
      )
    }

    recordRateLimitRequest(ip)

    await next()
  })
}

const applyAuthRateLimitMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  const endpoints = [
    '/api/auth/sign-in/email',
    '/api/auth/sign-up/email',
    '/api/auth/request-password-reset',
  ]

  const result = endpoints.reduce((app, endpoint) => {
    return app.use(endpoint, async (c, next) => {
      const ip = extractClientIp(c.req.header('x-forwarded-for'))
      const { path } = c.req

      if (isAuthRateLimitExceeded(path, ip)) {
        const retryAfter = getAuthRateLimitRetryAfter(path, ip)
        return c.json(
          {
            success: false,
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
          },
          429,
          { 'Retry-After': retryAfter.toString() }
        )
      }

      recordAuthRateLimitRequest(path, ip)

      await next()
    })
  }, honoApp)

  return result
}

export function setupAuthMiddleware(honoApp: Readonly<Hono>, app?: App): Readonly<Hono> {
  if (!app?.auth) {
    return honoApp
  }

  return honoApp.use(
    '/api/auth/*',
    cors({
      origin: (origin) => {
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return origin
        }
        return origin
      },
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true,
    })
  )
}

const setupOauthProtectedResourceRoute = (honoApp: Readonly<Hono>, app?: App): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  return honoApp.get('/.well-known/oauth-protected-resource', (c) => {
    const baseUrl = process.env['BASE_URL'] ?? `http://localhost:${process.env['PORT'] ?? '3000'}`
    return c.json({
      resource: baseUrl,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header'],
      resource_documentation: 'https://docs.sovrium.com/mcp',
    })
  })
}

const AGENT_EMAIL_SUFFIX = '@agents.sovrium.local'

const setupAgentUserListFilter = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app?: App
): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  return honoApp.get('/api/auth/admin/list-users', async (c) => {
    const response = await authInstance.handler(c.req.raw)
    if (response.status !== 200) return response

    const includeAgents = c.req.query('includeAgents') === 'true'
    if (includeAgents) return response

    const body = (await response
      .clone()
      .json()
      .catch(() => undefined)) as { users?: ReadonlyArray<{ email?: unknown }> } | undefined
    if (body === undefined || !Array.isArray(body.users)) return response

    const filtered = body.users.filter(
      (user) => typeof user.email !== 'string' || !user.email.endsWith(AGENT_EMAIL_SUFFIX)
    )
    return c.json({ ...body, users: filtered }, 200)
  })
}

const setupOauthWellKnownRoutes = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app?: App
): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  const authServerMetadataHandler = oauthProviderAuthServerMetadata(authInstance)
  const openIdConfigHandler = oauthProviderOpenIdConfigMetadata(authInstance)

  return honoApp
    .get('/.well-known/oauth-authorization-server', (c) => authServerMetadataHandler(c.req.raw))
    .get('/.well-known/openid-configuration', (c) => openIdConfigHandler(c.req.raw))
}

const setupOauthPublicClientIntrospect = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app?: App
): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  return honoApp.post('/api/auth/oauth2/introspect', async (c) => {
    const clonedRequest = c.req.raw.clone()

    const body = await c.req.parseBody()
    const clientId = body['client_id'] as string | undefined
    const clientSecret = body['client_secret'] as string | undefined
    const token = body['token'] as string | undefined

    const authHeader = c.req.header('authorization')
    if (clientSecret !== undefined || authHeader?.startsWith('Basic ')) {
      return authInstance.handler(clonedRequest)
    }

    if (!clientId || !token) {
      return c.json(
        { error: 'invalid_client', error_description: 'missing required credentials' },
        401
      )
    }

    const clientRows = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .limit(1)
    const client = clientRows[0]
    if (!client?.public) {
      return c.json(
        { error: 'invalid_client', error_description: 'missing required credentials' },
        401
      )
    }

    const tokenRows = await db
      .select()
      .from(oauthAccessTokens)
      .where(eq(oauthAccessTokens.token, token))
      .limit(1)
    const accessToken = tokenRows[0]

    if (!accessToken || accessToken.expiresAt < new Date()) {
      return c.json({ active: false })
    }

    if (accessToken.clientId !== clientId) {
      return c.json({ active: false })
    }

    return c.json({
      active: true,
      client_id: accessToken.clientId,
      sub: accessToken.userId ?? undefined,
      exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
      iat: Math.floor(accessToken.createdAt.getTime() / 1000),
      scope: accessToken.scopes?.join(' ') ?? undefined,
    })
  })
}

export function setupAuthRoutes(
  honoApp: Readonly<Hono>,
  app?: App,
  existingAuthInstance?: Readonly<ReturnType<typeof createAuthInstance>>
): Readonly<Hono> {
  if (!app?.auth) {
    return honoApp
  }

  const authInstance = existingAuthInstance ?? createAuthInstance(app.auth, app.connections)

  const appWithAuthCheck = applyAuthCheckMiddleware(honoApp, authInstance)

  const appWithAdminRoleCheck = applyAdminRoleCheckMiddleware(appWithAuthCheck, authInstance)

  const appWithAdminRateLimit = applyRateLimitMiddleware(appWithAdminRoleCheck)

  const appWithAuthRateLimit = applyAuthRateLimitMiddleware(appWithAdminRateLimit)

  const emailHandlers = createEmailHandlers(app.auth)
  const appWithInvitationRoutes = chainAdminInvitationRoutes(
    appWithAuthRateLimit,
    authInstance,
    app.auth,
    emailHandlers
  )

  const appWithProtectedResource = setupOauthProtectedResourceRoute(appWithInvitationRoutes, app)

  const appWithOauthPkceValidation = appWithProtectedResource.get(
    '/api/auth/oauth2/authorize',
    async (c) => {
      const codeChallengeMethod = c.req.query('code_challenge_method')
      if (codeChallengeMethod !== undefined && codeChallengeMethod !== 'S256') {
        return c.json(
          {
            error: 'invalid_request',
            error_description: 'Only S256 code_challenge_method is supported per OAuth 2.1',
          },
          400
        )
      }
      return authInstance.handler(c.req.raw)
    }
  )

  const appWithAgentUserFilter = setupAgentUserListFilter(
    appWithOauthPkceValidation,
    authInstance,
    app
  )

  const appWithWellKnown = setupOauthWellKnownRoutes(appWithAgentUserFilter, authInstance, app)

  const appWithPublicClientIntrospect = setupOauthPublicClientIntrospect(
    appWithWellKnown,
    authInstance,
    app
  )

  const appWithTeamRoutes = chainOrganizationTeamRoutes(
    appWithPublicClientIntrospect,
    authInstance,
    app
  )

  return appWithTeamRoutes.on(['POST', 'GET'], '/api/auth/*', async (c) => {
    const response = await authInstance.handler(c.req.raw)
    if (response.status === 403 && isS1RewritablePath(c.req.path)) {
      return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
    }
    return response
  })
}

const isS1RewritablePath = (path: string): boolean => {
  return path.startsWith('/api/auth/organization/') || path.startsWith('/api/auth/oauth2/')
}
