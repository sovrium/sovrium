/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { setSignedCookie } from 'hono/cookie'
import {
  forbidden,
  notFound,
  unauthorized,
  validationError,
} from '@/presentation/api/utils/auth-helpers'
import type { Context, Hono } from 'hono'


interface BetterAuthAPI {
  api: {
    getSession: (context: {
      headers: Headers
    }) => Promise<{ user: unknown; session: { id: string; userId: string } } | null>
  }
}

const handleUserUpdate = async (c: Context) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>

    if ('role' in body) {
      return forbidden(c, 'Cannot update user role through this endpoint')
    }

    return c.json(
      { success: false, message: 'User updates not yet implemented', code: 'BAD_REQUEST' },
      400
    )
  } catch {
    return c.json(
      { success: false, message: 'Could not parse request body', code: 'BAD_REQUEST' },
      400
    )
  }
}

const createSessionRefreshHandler = (authInstance?: unknown) => async (c: Context) => {
  try {
    if (!authInstance || typeof authInstance !== 'object' || !('api' in authInstance)) {
      return c.json(
        {
          success: false,
          message: 'Auth instance not configured',
          code: 'SERVICE_UNAVAILABLE',
        },
        500
      )
    }

    const auth = authInstance as BetterAuthAPI

    const currentSession = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    if (!currentSession) {
      return unauthorized(c)
    }


    return c.json(
      {
        message: 'Session refreshed successfully',
      },
      200
    )
  } catch {
    return c.json(
      { success: false, message: 'Failed to refresh session', code: 'INTERNAL_ERROR' },
      500
    )
  }
}

const resolveAuthInstance = (authInstance?: unknown): BetterAuthAPI | undefined => {
  if (!authInstance || typeof authInstance !== 'object' || !('api' in authInstance)) {
    return undefined
  }
  return authInstance as BetterAuthAPI
}

const authorizeAdminCaller = async (
  auth: BetterAuthAPI,
  c: Context
): Promise<Response | undefined> => {
  const callerSession = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!callerSession) {
    return unauthorized(c)
  }

  const { getUserRole } = await import('@/application/use-cases/tables/user-role')
  const callerRole = await getUserRole(callerSession.session.userId)
  if (callerRole !== 'admin') {
    return notFound(c)
  }

  return undefined
}

const parseRoleUpdateRequest = async (
  c: Context
): Promise<{ role: string; targetUserId: string } | Response> => {
  const body = (await c.req.json()) as Record<string, unknown>
  const { role } = body as { role?: string }
  if (typeof role !== 'string' || !role) {
    return validationError(c, [{ field: 'role', message: 'role field is required' }])
  }

  const targetUserId = c.req.param('id')
  if (!targetUserId) {
    return validationError(c, [{ field: 'id', message: 'User ID is required' }])
  }

  return { role, targetUserId }
}

const applyRoleAndReadSession = async (
  targetUserId: string,
  role: string
): Promise<{ sessionToken: string | undefined }> => {
  const userRoleModule = await import('@/application/use-cases/tables/user-role')
  const sessionToken = await userRoleModule
    .updateUserRole(targetUserId, role)
    .then(() => userRoleModule.getUserSessionToken(targetUserId))
  return { sessionToken }
}

const buildRoleUpdateSuccessResponse = (
  c: Context,
  sessionToken: string | undefined
): Promise<Response> => {
  const authSecret = process.env['AUTH_SECRET']
  if (!sessionToken || !authSecret) {
    return Promise.resolve(
      c.json({ success: true, message: 'User role updated successfully' }, 200)
    )
  }

  return setSignedCookie(c, 'better-auth.session_token', sessionToken, authSecret, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
  }).then(() => c.json({ success: true, message: 'User role updated successfully' }, 200))
}

const createAdminUserUpdateHandler = (authInstance?: unknown) => async (c: Context) => {
  try {
    const auth = resolveAuthInstance(authInstance)
    if (!auth) {
      return c.json(
        { success: false, message: 'Auth instance not configured', code: 'SERVICE_UNAVAILABLE' },
        500
      )
    }

    const authorizationFailure = await authorizeAdminCaller(auth, c)
    if (authorizationFailure) {
      return authorizationFailure
    }

    const request = await parseRoleUpdateRequest(c)
    if (request instanceof Response) {
      return request
    }

    const { sessionToken } = await applyRoleAndReadSession(request.targetUserId, request.role)
    return await buildRoleUpdateSuccessResponse(c, sessionToken)
  } catch {
    return c.json(
      { success: false, message: 'Failed to update user role', code: 'INTERNAL_ERROR' },
      500
    )
  }
}

export const chainAuthRoutes = (app: Hono, authInstance?: unknown): Hono => {
  app.patch('/api/auth/user/update', handleUserUpdate)

  app.post('/api/auth/session/refresh', createSessionRefreshHandler(authInstance))

  app.patch('/api/auth/admin/users/:id', createAdminUserUpdateHandler(authInstance))

  return app
}
