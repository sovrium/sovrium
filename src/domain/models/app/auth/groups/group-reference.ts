/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const GROUP_PREFIX = 'group:'

export const isGroupReference = (entry: string): boolean => entry.startsWith(GROUP_PREFIX)

export const stripGroupPrefix = (entry: string): string => entry.slice(GROUP_PREFIX.length)

export const toGroupReference = (groupName: string): string => `${GROUP_PREFIX}${groupName}`

export const splitGroupReferences = (
  entries: readonly string[]
): { readonly roles: readonly string[]; readonly groups: readonly string[] } => ({
  roles: entries.filter((entry) => !isGroupReference(entry)),
  groups: entries.filter(isGroupReference).map(stripGroupPrefix),
})

export const extractGroupNames = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return []
  return (value as readonly unknown[])
    .filter((entry): entry is string => typeof entry === 'string')
    .filter(isGroupReference)
    .map(stripGroupPrefix)
}
