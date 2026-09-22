/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Public / private file-access toggle environment variables.
 *
 * Two operator-controlled env vars govern whether stored files can be served
 * without an authenticated session:
 *
 * - `STORAGE_PUBLIC_PATHS` — a comma-separated list of path prefixes. A file
 *   whose storage key starts with any listed prefix is served without auth.
 *   Each prefix must be a plain path segment string; shell-glob wildcards
 *   (`*`, `?`) are rejected at startup so an operator typo surfaces loudly.
 * - `STORAGE_DEFAULT_ACCESS` — `public` or `private`. When `public`, every
 *   file is served without auth. When unset or `private`, files are private
 *   (the frugal, secure default).
 *
 * Both are infrastructure concerns, so they live in env vars (NOT app schema).
 */

/** Parsed public-access configuration derived from the storage env vars. */
export interface StoragePublicAccess {
  /** Path prefixes whose files are served without auth (may be empty). */
  readonly publicPaths: readonly string[]
  /** When true, every stored file is public regardless of `publicPaths`. */
  readonly defaultPublic: boolean
}

/**
 * Reject a `STORAGE_PUBLIC_PATHS` entry that contains shell-glob wildcards.
 *
 * The feature matches literal path prefixes — a wildcard is almost always an
 * operator mistake (expecting glob semantics) and must fail loudly at startup
 * rather than silently never matching.
 */
const isInvalidPublicPath = (entry: string): boolean => entry.includes('*') || entry.includes('?')

/**
 * Parse `STORAGE_PUBLIC_PATHS` into a normalized list of prefixes.
 *
 * @throws Error when any entry contains a glob wildcard (`*` or `?`).
 */
export const parseStoragePublicPaths = (raw: string | undefined): readonly string[] => {
  if (raw === undefined || raw.trim() === '') return []
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  const invalid = entries.find(isInvalidPublicPath)
  if (invalid !== undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- mirrors validateStorageSizeLimitVar: throw so the env-var name surfaces at startup
    throw new Error(
      `Invalid STORAGE_PUBLIC_PATHS: entry "${invalid}" contains a wildcard; only literal path prefixes are supported`
    )
  }
  return entries
}

/**
 * Parse `STORAGE_DEFAULT_ACCESS` into a boolean. `public` → true; unset or
 * `private` → false (the secure default).
 *
 * @throws Error when set to anything other than `public` or `private`.
 */
export const parseStorageDefaultAccess = (raw: string | undefined): boolean => {
  if (raw === undefined || raw.trim() === '') return false
  const value = raw.trim().toLowerCase()
  if (value === 'public') return true
  if (value === 'private') return false
  // eslint-disable-next-line functional/no-throw-statements -- mirrors validateStorageSizeLimitVar: throw so the env-var name surfaces at startup
  throw new Error(`Invalid STORAGE_DEFAULT_ACCESS: expected "public" or "private", got "${raw}"`)
}

/**
 * Resolve the public-access configuration from `process.env`.
 *
 * Called both at startup (to fail-fast on a malformed value) and per-request
 * (to decide whether a download may skip authentication).
 *
 * @throws Error when either env var is set to an invalid value.
 */
export const resolveStoragePublicAccess = (
  env: Record<string, string | undefined> = process.env
): StoragePublicAccess => ({
  publicPaths: parseStoragePublicPaths(env['STORAGE_PUBLIC_PATHS']),
  defaultPublic: parseStorageDefaultAccess(env['STORAGE_DEFAULT_ACCESS']),
})

/**
 * Decide whether a stored file is publicly accessible (no auth required).
 *
 * A file is public when default access is `public`, or when its storage key
 * starts with any configured public-path prefix.
 */
export const isFilePublic = (access: StoragePublicAccess, storageKey: string): boolean => {
  if (access.defaultPublic) return true
  return access.publicPaths.some((prefix) => storageKey.startsWith(prefix))
}
