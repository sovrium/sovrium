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

/**
 * Pure parser that converts the string-template sugar used in YAML / JSON
 * configs into a typed `CurrentUserRef` discriminated-union value.
 *
 * Supported templates:
 * - `$currentUser.id`               → scalar 'id'
 * - `$currentUser.email`            → scalar 'email'
 * - `$currentUser.role`             → scalar 'role'
 * - `$currentUser.isUnrestricted`   → scalar 'isUnrestricted'
 * - `$currentUser.activeAssignment` → activeAssignment
 * - `$currentUser.assignments.<tableSlug>` → assignment with tableSlug
 *
 * Returns `undefined` for any string that is not a recognized
 * `$currentUser` template.
 */
export const parseCurrentUserRef = (raw: unknown): CurrentUserRef | undefined => {
  if (typeof raw !== 'string') return undefined
  if (!raw.startsWith('$currentUser.')) return undefined

  const path = parseCurrentUserPath(raw.slice('$currentUser.'.length))
  if (!path) return undefined
  return { kind: 'currentUser', path }
}

/**
 * True when the provided value is already a typed `$currentUser`
 * reference (object form), or a string template that resolves to one.
 */
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

/**
 * Normalizes either a typed ref object or its string-template sugar into
 * a single `CurrentUserRef`. Returns `undefined` when the input is neither.
 */
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

/**
 * Parse the segment AFTER `$currentUser.` into a typed `CurrentUserPath`.
 */
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
