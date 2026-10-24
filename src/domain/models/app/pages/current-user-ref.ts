/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { SessionInfo } from '@/domain/models/app/auth/session-info'
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
 * - `$currentUser.assignments.<tableSlug>.<role>` → the same, kept to one grant role
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
    const [tableSlug, role, ...rest] = suffix.slice('assignments.'.length).split('.')
    if (!tableSlug || role === '' || rest.length > 0) return undefined
    return role === undefined
      ? { kind: 'assignment', tableSlug }
      : { kind: 'assignment', tableSlug, role }
  }
  return undefined
}

/** A `$currentUser.<name>` reference that resolves to one value about the reader. */
export type CurrentUserScalarName = 'id' | 'email' | 'role' | 'isUnrestricted'

/** The facts about the reader a scalar reference resolves against. */
export type CurrentUserFacts = Pick<SessionInfo, 'userId' | 'role' | 'email' | 'isUnrestricted'>

/**
 * The reader's value for one scalar reference: their id, email (`''` when the
 * account has none), role, or whether they are unrestricted.
 */
export const resolveCurrentUserScalar = (
  name: CurrentUserScalarName,
  reader: CurrentUserFacts
): string | boolean => {
  if (name === 'id') return reader.userId
  if (name === 'email') return reader.email ?? ''
  if (name === 'role') return reader.role
  return reader.isUnrestricted === true
}

/**
 * What a single value becomes for one reader:
 * - `literal`: the value names no `$currentUser` reference and stands as written;
 * - `resolved`: it is a scalar reference, and `value` is the reader's own;
 * - `unresolvable`: it names the reader but there is none (an anonymous
 *   request), it names something that is not one value (an assignment list),
 *   or the reader has no such value (no email on record). A comparison against
 *   it can match nothing — never the empty text, which a row can hold.
 */
export type CurrentUserScalarResolution =
  | { readonly kind: 'literal' }
  | { readonly kind: 'resolved'; readonly value: string | boolean }
  | { readonly kind: 'unresolvable' }

/** Resolve one value that may be a `$currentUser.<scalar>` reference, for one reader. */
export const resolveCurrentUserScalarValue = (
  value: unknown,
  reader: CurrentUserFacts | undefined
): CurrentUserScalarResolution => {
  const ref = normalizeCurrentUserRef(value)
  if (ref === undefined) return { kind: 'literal' }
  if (reader === undefined || ref.path.kind !== 'scalar') return { kind: 'unresolvable' }
  const resolved = resolveCurrentUserScalar(ref.path.name, reader)
  return resolved === '' ? { kind: 'unresolvable' } : { kind: 'resolved', value: resolved }
}

/** What a comparison operand becomes for one reader — a single value or a list of them. */
export type CurrentUserOperandResolution =
  | { readonly kind: 'literal' }
  | { readonly kind: 'resolved'; readonly value: unknown }
  | { readonly kind: 'unresolvable' }

/**
 * Resolve one comparison operand for one reader: a single value as
 * {@link resolveCurrentUserScalarValue} does, or a list (`in`, `notIn`) entry by
 * entry. A list naming the reader anywhere it cannot be resolved is
 * `unresolvable` as a whole — dropping the entry would widen a `notIn`.
 */
export const resolveCurrentUserOperand = (
  operand: unknown,
  reader: CurrentUserFacts | undefined
): CurrentUserOperandResolution => {
  if (!Array.isArray(operand)) return resolveCurrentUserScalarValue(operand, reader)
  const entries = operand.map((entry: unknown) => resolveCurrentUserScalarValue(entry, reader))
  if (entries.some((entry) => entry.kind === 'unresolvable')) return { kind: 'unresolvable' }
  if (entries.every((entry) => entry.kind === 'literal')) return { kind: 'literal' }
  return {
    kind: 'resolved',
    value: entries.map((entry, index) =>
      entry.kind === 'resolved' ? entry.value : (operand[index] as unknown)
    ),
  }
}

/** Every `$currentUser.<scalar>` written inside a longer text. */
const SCALAR_TOKEN_IN_TEXT = /\$currentUser\.(id|email|role|isUnrestricted)(?![\w.])/g

/** True when the text names the reader anywhere — any `$currentUser.` reference. */
export const mentionsCurrentUser = (text: string): boolean => text.includes('$currentUser.')

/**
 * Whether `offset` in `text` falls inside a JSON string literal: after an odd
 * number of double quotes, a quote escaped by a backslash not counting.
 */
const isInsideJsonString = (text: string, offset: number): boolean =>
  [...text.slice(0, offset)].reduce<{ readonly inString: boolean; readonly escaped: boolean }>(
    (state, char) => {
      if (state.escaped) return { inString: state.inString, escaped: false }
      if (char === '\\' && state.inString) return { inString: true, escaped: true }
      if (char === '"') return { inString: !state.inString, escaped: false }
      return state
    },
    { inString: false, escaped: false }
  ).inString

/** A value as written where it lands: escaped as JSON inside a JSON string, as it is elsewhere. */
const valueAt = (value: string, text: string, offset: number): string =>
  isInsideJsonString(text, offset) ? JSON.stringify(value).slice(1, -1) : value

/**
 * The text with every `$currentUser.<scalar>` occurrence replaced by the
 * reader's value, wherever it sits in the text (a `field:value` shorthand, a
 * JSON filter). Inside a JSON string the value is escaped as JSON, so a quote
 * or a backslash in it cannot end the string early. `undefined` when the text names the reader and cannot be
 * resolved: there is no reader, it names a reference that is not one value, or
 * the reader has no such value.
 * A text naming no reference comes back as written.
 */
export const substituteCurrentUserScalars = (
  text: string,
  reader: CurrentUserFacts | undefined
): string | undefined => {
  if (!mentionsCurrentUser(text)) return text
  if (reader === undefined) return undefined
  const values = [...text.matchAll(SCALAR_TOKEN_IN_TEXT)].map((match) =>
    String(resolveCurrentUserScalar(match[1] as CurrentUserScalarName, reader))
  )
  if (values.includes('')) return undefined
  const substituted = text.replace(
    SCALAR_TOKEN_IN_TEXT,
    (_match, name: string, offset: number, whole: string) =>
      valueAt(
        String(resolveCurrentUserScalar(name as CurrentUserScalarName, reader)),
        whole,
        offset
      )
  )
  return mentionsCurrentUser(substituted) ? undefined : substituted
}
