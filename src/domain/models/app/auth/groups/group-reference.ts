/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Group-reference parsing — the `group:<name>` prefix contract.
 *
 * Permission arrays (`access`, table/field `permissions`) and effective-role
 * lists may reference a Sovrium group with the `group:` prefix
 * (e.g. `access: ['admin', 'group:marketing']`). This module is the single
 * source of truth for that prefix and the parse/split/build helpers around
 * it, so the literal `'group:'` and its slice/startsWith logic are not
 * re-implemented across the page-access, table-permission, and role
 * cross-validators.
 *
 * Lives in the domain layer (innermost) so every layer — domain validators,
 * the application group-membership resolver, and presentation read gates —
 * can depend on it without crossing a boundary.
 */

/** Prefix marking a group reference inside an access / permission array. */
export const GROUP_PREFIX = 'group:'

/** True when `entry` is a `group:<name>` reference. */
export const isGroupReference = (entry: string): boolean => entry.startsWith(GROUP_PREFIX)

/** Strip the `group:` prefix, yielding the bare group name. */
export const stripGroupPrefix = (entry: string): string => entry.slice(GROUP_PREFIX.length)

/** Prepend the `group:` prefix to a bare group name. */
export const toGroupReference = (groupName: string): string => `${GROUP_PREFIX}${groupName}`

/**
 * Split an access / permission array into plain role names and bare group
 * names. `group:<name>` entries are extracted as group names (prefix removed);
 * every other entry is treated as a role name.
 */
export const splitGroupReferences = (
  entries: readonly string[]
): { readonly roles: readonly string[]; readonly groups: readonly string[] } => ({
  roles: entries.filter((entry) => !isGroupReference(entry)),
  groups: entries.filter(isGroupReference).map(stripGroupPrefix),
})

/**
 * Extract the bare group names referenced in an arbitrary value. Non-array
 * values yield `[]`; non-string array entries are ignored. Used by the schema
 * cross-validators that walk untyped `access` / `permissions` shapes.
 */
export const extractGroupNames = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return []
  return (value as readonly unknown[])
    .filter((entry): entry is string => typeof entry === 'string')
    .filter(isGroupReference)
    .map(stripGroupPrefix)
}
