/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type {
  CurrentUserPath,
  CurrentUserRef,
} from '@/domain/models/app/pages/components/data-source'

export const parseCurrentUserRef = (raw: unknown): CurrentUserRef | undefined => {
  if (typeof raw !== 'string') return undefined
  if (!raw.startsWith('$currentUser.')) return undefined

  const path = parseCurrentUserPath(raw.slice('$currentUser.'.length))
  if (!path) return undefined
  return { kind: 'currentUser', path }
}

export const isCurrentUserRef = (value: unknown): value is CurrentUserRef | string => {
  if (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value as { kind: string }).kind === 'currentUser'
  ) {
    return true
  }
  return parseCurrentUserRef(value) !== undefined
}

export const normalizeCurrentUserRef = (value: unknown): CurrentUserRef | undefined => {
  if (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value as { kind: string }).kind === 'currentUser' &&
    'path' in value
  ) {
    return value as CurrentUserRef
  }
  return parseCurrentUserRef(value)
}

const SCALAR_NAMES: ReadonlySet<string> = new Set(['id', 'email', 'role', 'isUnrestricted'])

const parseCurrentUserPath = (suffix: string): CurrentUserPath | undefined => {
  if (suffix.length === 0) return undefined
  if (suffix === 'activeAssignment') return { kind: 'activeAssignment' }
  if (SCALAR_NAMES.has(suffix)) {
    return {
      kind: 'scalar',
      name: suffix as 'id' | 'email' | 'role' | 'isUnrestricted',
    }
  }
  if (suffix.startsWith('assignments.')) {
    const tableSlug = suffix.slice('assignments.'.length)
    if (tableSlug.length === 0) return undefined
    return { kind: 'assignment', tableSlug }
  }
  return undefined
}
