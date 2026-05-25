/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Session } from '@/application/ports/models/user-session'
import type { Context, Next } from 'hono'

interface BetterAuthLike {
  readonly api: {
    readonly getSession: (options: { readonly headers: Headers }) => Promise<unknown>
  }
}

export type ContextWithSession = Context & {
  readonly var: {
    readonly session?: Session
  }
}

function getClientIP(c: Context): string | undefined {
  const xForwardedFor = c.req.header('x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0]?.trim()
  }

  const xRealIp = c.req.header('x-real-ip')
  if (xRealIp) {
    return xRealIp
  }

  const cfConnectingIp = c.req.header('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  return undefined
}

function validateSessionBinding(
  session: Session,
  currentIP: string | undefined,
  currentUserAgent: string | undefined
): boolean {
  if (!session.ipAddress && !session.userAgent) {
    return true
  }

  if (session.ipAddress && currentIP && session.ipAddress !== currentIP) {
    return false
  }

  if (session.userAgent && currentUserAgent && session.userAgent !== currentUserAgent) {
    return false
  }

  return true
}

function processSessionResult(
  c: Context,
  sessionResult: { readonly session?: Session } | null
): void {
  if (!sessionResult?.session) {
    return
  }

  const currentIP = getClientIP(c)
  const currentUserAgent = c.req.header('user-agent')

  if (validateSessionBinding(sessionResult.session as Session, currentIP, currentUserAgent)) {
    c.set('session', sessionResult.session as Session)
  } else {
    console.warn(
      `[AUTH] Session binding validation failed: ${JSON.stringify({
        sessionId: sessionResult.session.id,
        expectedIP: sessionResult.session.ipAddress,
        currentIP,
        expectedUserAgent: sessionResult.session.userAgent,
        currentUserAgent,
      })}`
    )
  }
}

export function authMiddleware(auth: BetterAuthLike) {
  return async (c: Context, next: Next) => {
    try {
      const authHeader = c.req.header('authorization')

      if (authHeader?.toLowerCase().startsWith('bearer ')) {
        const apiKey = authHeader.slice(7)
        const result = (await auth.api.getSession({
          headers: new Headers({ authorization: apiKey }),
        })) as { readonly session?: Session } | null
        processSessionResult(c, result)
      } else {
        const result = (await auth.api.getSession({
          headers: c.req.raw.headers,
        })) as { readonly session?: Session } | null
        processSessionResult(c, result)
      }
    } catch (error) {
      console.error('[AUTH] Session extraction failed', error)
    }

    await next()
  }
}

async function requireAuthHandler(c: ContextWithSession, next: Next) {
  const { session } = c.var

  if (!session) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      },
      401
    )
  }

  await next()
}

export function requireAuth() {
  return requireAuthHandler
}

function makeRoleGuard(allowedRoles: ReadonlyArray<string>, notFoundOnMissingSession: boolean) {
  return async (c: ContextWithSession, next: Next) => {
    const { session } = c.var

    if (!session) {
      if (notFoundOnMissingSession) {
        return c.json(
          {
            success: false,
            message: 'Not found',
            code: 'NOT_FOUND',
          },
          404
        )
      }
      return c.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        401
      )
    }

    const { getUserRole } = await import('@/application/use-cases/tables/user-role')
    const role = await getUserRole(session.userId)

    if (!allowedRoles.includes(role)) {
      return c.json(
        {
          success: false,
          message: 'Not found',
          code: 'NOT_FOUND',
        },
        404
      )
    }

    await next()
  }
}

export function requireAdmin() {
  return makeRoleGuard(['admin'], false)
}

export function requireAdminTier() {
  return makeRoleGuard(['admin', 'operator'], true)
}
