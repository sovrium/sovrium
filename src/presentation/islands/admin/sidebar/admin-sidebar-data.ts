/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useEffect, useState } from 'react'
import { brandLabel } from '@/domain/utils/admin-data-nav'

export { brandLabel }

export interface Operator {
  readonly name: string
  readonly email: string
  readonly role: string
}

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

export function useOperator(): Operator | undefined {
  const [operator, setOperator] = useState<Operator | undefined>(undefined)
  useEffect(() => {
    void fetchOperator().then(setOperator)
  }, [])
  return operator
}

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

export function useVersion(appVersion: string | undefined): string {
  return appVersion !== undefined && appVersion.length > 0 ? appVersion : '1.0.0'
}

export function useBuildVersionOnly(): string | undefined {
  const [version, setVersion] = useState<string | undefined>(undefined)
  useEffect(() => {
    void fetchBuildVersion().then(setVersion)
  }, [])
  return version
}
