/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  cookieNameForScope,
  pickCandidateSlugs,
  resolveActiveAssignmentForScope,
} from '@/domain/services/active-assignment-cookie'
import { normalizeCurrentUserRef } from '@/domain/utils/current-user-ref'
import type { CurrentUserRef, DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { SessionInfo } from '@/domain/types/session-info'


export type CurrentUserResolutionContext = {
  readonly session: SessionInfo | undefined
  readonly cookies: Readonly<Record<string, string>> | undefined
  readonly fetchAssignments?: (userId: string, tableSlug: string) => Promise<readonly string[]>
  readonly scopeTables?: readonly string[]
}

export type FilterResolution =
  | { readonly kind: 'ok'; readonly filter: DataFilter }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'bypass' }

export const resolveFilter = async (
  filter: DataFilter,
  ctx: CurrentUserResolutionContext
): Promise<FilterResolution> => {
  const ref = normalizeCurrentUserRef(filter.value)
  if (!ref) return { kind: 'ok', filter }

  if (!ctx.session) return { kind: 'unauthorized' }

  if (ctx.session.isUnrestricted && isAssignmentRef(ref)) return { kind: 'bypass' }

  const resolved = await resolveRef(ref, ctx)
  return { kind: 'ok', filter: { ...filter, value: resolved } }
}

export type FiltersResolution =
  | { readonly kind: 'ok'; readonly filter: readonly DataFilter[] }
  | { readonly kind: 'unauthorized' }

export const resolveFilters = async (
  filters: readonly DataFilter[] | undefined,
  ctx: CurrentUserResolutionContext
): Promise<FiltersResolution> => {
  if (!filters || filters.length === 0) return { kind: 'ok', filter: filters ?? [] }

  const resolutions = await Promise.all(filters.map((f) => resolveFilter(f, ctx)))
  if (resolutions.some((r) => r.kind === 'unauthorized')) return { kind: 'unauthorized' }

  const ok = resolutions
    .filter((r): r is { kind: 'ok'; filter: DataFilter } => r.kind === 'ok')
    .map((r) => r.filter)
  return { kind: 'ok', filter: ok }
}

export const hasCurrentUserRef = (filters: readonly DataFilter[] | undefined): boolean => {
  if (!filters || filters.length === 0) return false
  return filters.some((f) => normalizeCurrentUserRef(f.value) !== undefined)
}


const isAssignmentRef = (ref: CurrentUserRef): boolean =>
  ref.path.kind === 'assignment' || ref.path.kind === 'activeAssignment'

const resolveRef = async (
  ref: CurrentUserRef,
  ctx: CurrentUserResolutionContext
): Promise<string | number | boolean | readonly string[]> => {
  const session = ctx.session!

  if (ref.path.kind === 'scalar') {
    return resolveScalar(ref.path.name, session)
  }

  if (ref.path.kind === 'assignment') {
    if (!ctx.fetchAssignments) return [] as readonly string[]
    return ctx.fetchAssignments(session.userId, ref.path.tableSlug)
  }

  return resolveActiveAssignment(session.userId, ctx)
}

const resolveScalar = (
  name: 'id' | 'email' | 'role' | 'isUnrestricted',
  session: SessionInfo
): string | boolean => {
  if (name === 'id') return session.userId
  if (name === 'email') return session.email ?? ''
  if (name === 'role') return session.role
  return session.isUnrestricted === true
}

const resolveActiveAssignment = async (
  userId: string,
  ctx: CurrentUserResolutionContext
): Promise<string> => {
  const cookies = ctx.cookies ?? {}
  const { fetchAssignments } = ctx

  const candidateSlugs = pickCandidateSlugs(ctx.scopeTables, Object.keys(cookies))

  return candidateSlugs.reduce<Promise<string>>(async (accPromise, slug) => {
    const acc = await accPromise
    if (acc !== '') return acc

    const cookieValue = cookies[cookieNameForScope(slug)]
    if (!fetchAssignments) {
      return cookieValue ?? ''
    }

    const accessible = await fetchAssignments(userId, slug)
    return resolveActiveAssignmentForScope(cookieValue, accessible)
  }, Promise.resolve(''))
}
