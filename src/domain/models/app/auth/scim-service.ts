/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pure decisions behind SCIM 2.0 provisioning: reading a User body, and
 * turning PATCH operations into the changes Sovrium applies.
 *
 * What SCIM may change is deliberately narrow. A user's name, display name and
 * active flag; a declared group's members. Never a role — a `roles` or
 * entitlement attribute is ignored, so an identity provider cannot grant
 * admin — and never an email, so SCIM cannot repoint an account it did not
 * create at an address someone else controls.
 */

/** The parts of a SCIM User body Sovrium reads. */
export interface ScimUserInput {
  readonly userName: string
  readonly displayName?: string
  readonly name?: {
    readonly formatted?: string
    readonly givenName?: string
    readonly familyName?: string
  }
  readonly emails?: readonly { readonly value: string; readonly primary?: boolean }[]
  readonly active?: boolean
}

/** One PATCH operation, as decoded. */
export interface ScimPatchOperation {
  readonly op: string
  readonly path?: string
  readonly value?: unknown
}

/** A SCIM error type for a body Sovrium cannot apply. */
export type ScimRefusal = {
  readonly scimType: 'invalidValue' | 'invalidPath' | 'invalidFilter'
  readonly detail: string
}

/** The email of a provisioned user: the primary email, else the first, else the userName. */
export const scimEmailOf = (user: ScimUserInput): string => {
  const emails = user.emails ?? []
  const chosen = emails.find((email) => email.primary === true) ?? emails[0]
  return (chosen?.value ?? user.userName).trim().toLowerCase()
}

const joinName = (name: ScimUserInput['name']): string =>
  [name?.givenName, name?.familyName]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join(' ')

/** The account name: formatted, else given + family, else displayName, else userName. */
export const scimDisplayNameOf = (user: ScimUserInput): string =>
  user.name?.formatted?.trim() || joinName(user.name) || user.displayName?.trim() || user.userName

/** An account name split back into SCIM name parts, at its first space. */
export const splitScimName = (
  name: string
): { readonly givenName: string; readonly familyName?: string } => {
  const trimmed = name.trim()
  const space = trimmed.indexOf(' ')
  if (space < 0) return { givenName: trimmed }
  return { givenName: trimmed.slice(0, space), familyName: trimmed.slice(space + 1) }
}

/** The changes a PATCH asks of a user. */
export interface ScimUserChanges {
  readonly active?: boolean
  readonly name?: string
}

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 'True') return true
  if (value === 'false' || value === 'False') return false
  return undefined
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/** The change one attribute asks for; ignored attributes (roles, emails…) ask for none. */
const attributeChange = (
  attribute: string,
  value: unknown,
  current: ScimUserChanges
): ScimUserChanges | ScimRefusal => {
  if (attribute === 'active') {
    const active = asBoolean(value)
    return active === undefined
      ? { scimType: 'invalidValue', detail: 'active must be true or false' }
      : { ...current, active }
  }
  if (attribute === 'displayname' && typeof value === 'string' && value.trim() !== '') {
    return { ...current, name: value.trim() }
  }
  if (attribute === 'name') {
    const name = asRecord(value)
    const joined =
      (typeof name['formatted'] === 'string' ? name['formatted'].trim() : '') ||
      joinName(name as ScimUserInput['name'])
    return joined === '' ? current : { ...current, name: joined }
  }
  return current
}

const isRefusal = (value: unknown): value is ScimRefusal =>
  typeof value === 'object' && value !== null && 'scimType' in value

/**
 * The user changes a list of PATCH operations asks for, in order. `add` and
 * `replace` set an attribute; `remove` of `active` is refused. An operation
 * without a `path` carries its attributes in `value`, as Entra ID sends them.
 */
export const scimUserChanges = (
  operations: readonly ScimPatchOperation[]
): ScimUserChanges | ScimRefusal =>
  operations.reduce<ScimUserChanges | ScimRefusal>((changes, operation) => {
    if (isRefusal(changes)) return changes
    const op = operation.op.toLowerCase()
    if (op !== 'add' && op !== 'replace' && op !== 'remove') {
      return { scimType: 'invalidValue', detail: `unsupported operation ${operation.op}` }
    }
    if (op === 'remove') return changes
    const entries =
      operation.path === undefined
        ? Object.entries(asRecord(operation.value))
        : [[operation.path, operation.value] as const]
    return entries.reduce<ScimUserChanges | ScimRefusal>(
      (acc, [attribute, value]) =>
        isRefusal(acc) ? acc : attributeChange(attribute.toLowerCase(), value, acc),
      changes
    )
  }, {})

/** The member changes a group PATCH asks for. `replace` holds the full new list when given. */
export interface ScimMemberChanges {
  readonly add: readonly string[]
  readonly remove: readonly string[]
  readonly replace?: readonly string[]
}

const memberIds = (value: unknown): readonly string[] =>
  (Array.isArray(value) ? value : [value])
    .map((entry) => asRecord(entry)['value'])
    .filter((id): id is string => typeof id === 'string' && id !== '')

const MEMBER_FILTER = /^members\[\s*value\s+eq\s+"([^"]+)"\s*\]$/i

/** The member a `members[value eq "…"]` path names, or `undefined`. */
const filteredMember = (path: string): string | undefined => MEMBER_FILTER.exec(path)?.[1]

/** The change an operation on the `members` attribute itself asks for. */
const membersAttributeChange = (
  changes: ScimMemberChanges,
  op: string,
  value: unknown
): ScimMemberChanges | ScimRefusal => {
  if (op === 'add') return { ...changes, add: [...changes.add, ...memberIds(value)] }
  if (op === 'replace') return { add: [], remove: [], replace: memberIds(value) }
  if (op !== 'remove') return { scimType: 'invalidValue', detail: `unsupported operation ${op}` }
  return value === undefined
    ? { ...changes, replace: [] }
    : { ...changes, remove: [...changes.remove, ...memberIds(value)] }
}

const memberChange = (
  changes: ScimMemberChanges,
  operation: ScimPatchOperation
): ScimMemberChanges | ScimRefusal => {
  const op = operation.op.toLowerCase()
  const path = operation.path ?? ''
  const named = filteredMember(path)
  if (op === 'remove' && named !== undefined) {
    return { ...changes, remove: [...changes.remove, named] }
  }
  if (path.toLowerCase() === 'members') return membersAttributeChange(changes, op, operation.value)
  if (path === '' && op === 'replace') {
    const { members } = asRecord(operation.value)
    return members === undefined ? changes : membersAttributeChange(changes, op, members)
  }
  return path === '' || path.toLowerCase() === 'displayname'
    ? changes
    : { scimType: 'invalidPath', detail: `unsupported path ${path}` }
}

/** The member changes a list of group PATCH operations asks for, in order. */
export const scimMemberChanges = (
  operations: readonly ScimPatchOperation[]
): ScimMemberChanges | ScimRefusal =>
  operations.reduce<ScimMemberChanges | ScimRefusal>(
    (changes, operation) => (isRefusal(changes) ? changes : memberChange(changes, operation)),
    { add: [], remove: [] }
  )

/** Apply member changes to a current member list, preserving order and uniqueness. */
export const applyMemberChanges = (
  current: readonly string[],
  changes: ScimMemberChanges
): readonly string[] => {
  const base = changes.replace ?? current
  const removed = new Set(changes.remove)
  return [...new Set([...base, ...changes.add])].filter((id) => !removed.has(id))
}

/**
 * The userName a list filter selects: `userName eq "…"`, matched
 * case-insensitively. `undefined` for no filter; a refusal for any other.
 */
export const scimUserNameFilter = (
  filter: string | undefined
): string | undefined | ScimRefusal => {
  if (filter === undefined || filter.trim() === '') return undefined
  const match = /^\s*userName\s+eq\s+"([^"]*)"\s*$/i.exec(filter)
  return match?.[1] === undefined
    ? { scimType: 'invalidFilter', detail: 'only userName eq "…" filters are supported' }
    : match[1].toLowerCase()
}

/** Whether a decision is a refusal. */
export const isScimRefusal = isRefusal
