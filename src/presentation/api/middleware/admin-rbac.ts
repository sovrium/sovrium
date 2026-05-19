/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getUserRole } from '@/application/use-cases/tables/user-role'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, MiddlewareHandler, Next } from 'hono'

export type AdminRole = 'admin' | 'operator' | 'auditor'

export const ADMIN_ROLE_HIERARCHY: Readonly<Record<AdminRole, ReadonlyArray<AdminRole>>> = {
  admin: ['admin', 'operator', 'auditor'],
  operator: ['operator', 'auditor'],
  auditor: ['auditor'],
}

export type ContextWithAdminRole = ContextWithSession & {
  readonly var: {
    readonly adminRole?: AdminRole
  }
}

function notFound(c: Context): Response {
  return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
}

function isAdminRole(value: string): value is AdminRole {
  return value === 'admin' || value === 'operator' || value === 'auditor'
}

function expandAcceptedRoles(allowed: ReadonlyArray<AdminRole>): ReadonlyArray<AdminRole> {
  const accepted = allowed.flatMap((role) => {
    if (role === 'auditor') return ['auditor', 'operator', 'admin'] as const
    if (role === 'operator') return ['operator', 'admin'] as const
    return ['admin'] as const
  })
  return Array.from(new Set(accepted))
}

export function requireAdminRole(allowed: ReadonlyArray<AdminRole>): MiddlewareHandler {
  const accepted = new Set(expandAcceptedRoles(allowed))

  return async (c: Context, next: Next) => {
    const { session } = (c as ContextWithSession).var
    if (!session) {
      return notFound(c)
    }

    const rawRole = await getUserRole(session.userId)
    if (!isAdminRole(rawRole)) {
      return notFound(c)
    }

    if (!accepted.has(rawRole)) {
      return notFound(c)
    }

    c.set('adminRole', rawRole)

    await next()
    return undefined
  }
}

export function getAdminRole(c: Context): AdminRole | undefined {
  const value = c.get('adminRole') as unknown
  if (typeof value !== 'string') return undefined
  return isAdminRole(value) ? value : undefined
}
