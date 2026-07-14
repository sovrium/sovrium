/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface SessionUser {
  readonly email?: string
  readonly name?: string
  readonly role?: string
  readonly id?: string
}

const SESSION_TOKEN_PATTERN = /\$session\.(\w+)/g

export async function fetchSessionUser(): Promise<SessionUser | undefined> {
  if (typeof fetch === 'undefined') return undefined
  try {
    const res = await fetch('/api/auth/get-session', {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    if (!res.ok) return undefined
    const body = (await res.json().catch(() => undefined)) as
      { readonly user?: SessionUser } | undefined
    return body?.user ?? undefined
  } catch {
    return undefined
  }
}

export function resolveSessionTemplate(template: string, user: SessionUser | undefined): string {
  if (!template.includes('$session.')) return template
  return template.replaceAll(SESSION_TOKEN_PATTERN, (_full, field: string) => {
    const value = user ? (user as Record<string, unknown>)[field] : undefined
    return value === undefined || value === null ? '' : String(value)
  })
}
