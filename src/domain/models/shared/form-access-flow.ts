/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { PermissionValue } from '@/domain/models/shared/permissions'

export type FormAccessDecision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'unauthorized'; readonly require: string }
  | { readonly kind: 'not-found' }

export interface FormAccessSession {
  readonly userId: string
  readonly role: string
  readonly groups?: readonly string[]
}

const isAuthenticatedRequire = (require: PermissionValue): require is 'authenticated' =>
  require === 'authenticated'

export const evaluateFormAccess = (
  require: PermissionValue | undefined,
  session: FormAccessSession | undefined
): FormAccessDecision => {
  if (require === undefined || require === 'all') return { kind: 'allow' }

  if (isAuthenticatedRequire(require)) {
    return session === undefined
      ? { kind: 'unauthorized', require: 'authenticated' }
      : { kind: 'allow' }
  }

  if (session === undefined) return { kind: 'not-found' }
  const userGroups = session.groups ?? []
  const allowed = require.some((entry) => {
    if (entry.startsWith('group:')) return userGroups.includes(entry.slice('group:'.length))
    return entry === session.role
  })
  return allowed ? { kind: 'allow' } : { kind: 'not-found' }
}
