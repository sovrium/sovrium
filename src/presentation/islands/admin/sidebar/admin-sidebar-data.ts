/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Native Admin Dashboard sidebar data helpers: the
 * signed-in operator hook + the brand-label derivation. Kept in a non-component
 * module so the sidebar chrome file only exports React components (React Fast
 * Refresh / `react-refresh/only-export-components`). The operator read uses the
 * existing Better Auth session endpoint — no new route, display only.
 */

import { useEffect, useState } from 'react'
import { brandLabel } from '@/domain/utils/admin-data-nav'

// Re-export the pure, cross-layer brand-label helper so the sidebar chrome keeps
// importing it from this co-located data module. The derivation lives in the
// domain (`@/domain/utils/admin-data-nav`) so the application-layer breadcrumb
// home crumb derives the SAME display name from one source of truth.
export { brandLabel }

/** The signed-in operator, read once from the existing session endpoint. */
export interface Operator {
  readonly name: string
  readonly email: string
  readonly role: string
}

/** Read the signed-in operator from Better Auth's session endpoint (display only). */
async function fetchOperator(): Promise<Operator | undefined> {
  try {
    const res = await fetch('/api/auth/get-session', { headers: { Accept: 'application/json' } })
    if (!res.ok) return undefined
    const { user } = (await res.json()) as {
      readonly user?: { readonly name?: string; readonly email?: string; readonly role?: string }
    }
    if (!user?.email) return undefined
    return { name: user.name ?? user.email, email: user.email, role: user.role ?? '' }
  } catch {
    return undefined
  }
}

/** Load the signed-in operator once on mount (display-only identity bar). */
export function useOperator(): Operator | undefined {
  const [operator, setOperator] = useState<Operator | undefined>(undefined)
  useEffect(() => {
    void fetchOperator().then(setOperator)
  }, [])
  return operator
}

/** Read the running Sovrium build version from the admin version endpoint. */
async function fetchBuildVersion(): Promise<string | undefined> {
  try {
    const res = await fetch('/api/admin/config/version', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return undefined
    const { version } = (await res.json()) as { readonly version?: string }
    return typeof version === 'string' && version.length > 0 ? version : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve the **app config version** shown in the sidebar brand header. This is
 * the administered app's own version (`app.version`, passed server-side as
 * `appVersion`) — the operator's product version, NOT Sovrium's. When the app
 * declares none it defaults to `1.0.0` (a published app has, at minimum, a
 * first version). The Sovrium build version lives in the foot via
 * {@link useBuildVersionOnly}, so the two are never conflated in one chip.
 */
export function useVersion(appVersion: string | undefined): string {
  return appVersion !== undefined && appVersion.length > 0 ? appVersion : '1.0.0'
}

/**
 * The running Sovrium build version, fetched once from
 * `GET /api/admin/config/version` (the existing admin-only reflection endpoint)
 * — independent of any app-declared version. Surfaced as quiet platform
 * metadata in the sidebar foot so an operator can read "which Sovrium am I on"
 * at a glance, distinct from the app's own version in the brand chip. Returns
 * `undefined` until it resolves so the foot can render nothing rather than a
 * flash.
 */
export function useBuildVersionOnly(): string | undefined {
  const [version, setVersion] = useState<string | undefined>(undefined)
  useEffect(() => {
    void fetchBuildVersion().then(setVersion)
  }, [])
  return version
}
