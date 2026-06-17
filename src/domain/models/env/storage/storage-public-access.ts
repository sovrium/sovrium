/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface StoragePublicAccess {
  readonly publicPaths: readonly string[]
  readonly defaultPublic: boolean
}

const isInvalidPublicPath = (entry: string): boolean => entry.includes('*') || entry.includes('?')

export const parseStoragePublicPaths = (raw: string | undefined): readonly string[] => {
  if (raw === undefined || raw.trim() === '') return []
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  const invalid = entries.find(isInvalidPublicPath)
  if (invalid !== undefined) {
    throw new Error(
      `Invalid STORAGE_PUBLIC_PATHS: entry "${invalid}" contains a wildcard; only literal path prefixes are supported`
    )
  }
  return entries
}

export const parseStorageDefaultAccess = (raw: string | undefined): boolean => {
  if (raw === undefined || raw.trim() === '') return false
  const value = raw.trim().toLowerCase()
  if (value === 'public') return true
  if (value === 'private') return false
  throw new Error(`Invalid STORAGE_DEFAULT_ACCESS: expected "public" or "private", got "${raw}"`)
}

export const resolveStoragePublicAccess = (
  env: Record<string, string | undefined> = process.env
): StoragePublicAccess => ({
  publicPaths: parseStoragePublicPaths(env['STORAGE_PUBLIC_PATHS']),
  defaultPublic: parseStorageDefaultAccess(env['STORAGE_DEFAULT_ACCESS']),
})

export const isFilePublic = (access: StoragePublicAccess, storageKey: string): boolean => {
  if (access.defaultPublic) return true
  return access.publicPaths.some((prefix) => storageKey.startsWith(prefix))
}
