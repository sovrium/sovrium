/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Recovery for a page whose island entry names chunks the server no longer has.
 *
 * Every release replaces the content-hashed island chunks. A document loaded
 * before a deploy (a tab left open, a page restored from history) still runs
 * the previous release's entry, and the first island it mounts afterwards
 * imports a chunk that now 404s. The browser caches that failed module fetch
 * for the life of the document, so retrying the `import()` can never succeed:
 * only a fresh document — fresh HTML naming the new entry — recovers.
 *
 * So the loader reloads the page, ONCE per tab. The guard lives in
 * `sessionStorage` (per tab, survives the reload): a chunk that keeps failing
 * on the reloaded document — a broken deploy, a blocking proxy — leaves the
 * page as it is instead of reloading in a loop, and the islands whose chunks
 * do load still mount.
 */

/** `sessionStorage` key marking that this tab already spent its recovery reload. */
const RELOAD_GUARD_KEY = 'sovrium:stale-chunk-reload'

/**
 * The messages browsers give a dynamic `import()` whose module could not be
 * fetched: Chromium, Firefox, Safari, in that order. Anything else — a chunk
 * that loaded but threw while evaluating — is a bug a reload cannot cure.
 */
const CHUNK_LOAD_FAILURE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i

/** Whether `error` is a failed fetch of a dynamically imported module. */
export const isChunkLoadFailure = (error: unknown): boolean =>
  error instanceof Error && CHUNK_LOAD_FAILURE.test(error.message)

/**
 * Reload the page when `error` is a failed chunk import and this tab has not
 * reloaded for that reason yet. Returns whether it reloaded.
 *
 * Storage that cannot be read or written (disabled, quota, sandboxed frame)
 * counts as "already reloaded": without a guard there is no way to promise a
 * single reload, and a loop is worse than a page missing one island.
 */
export function reloadOnceForStaleChunk(error: unknown): boolean {
  if (!isChunkLoadFailure(error)) return false
  try {
    if (window.sessionStorage.getItem(RELOAD_GUARD_KEY) !== null) return false
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
