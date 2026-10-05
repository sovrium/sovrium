/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The runtime-manifest guard's one opt-out, and the scrubber every other
 * caller uses to keep it out of its builds.
 *
 * Dependency-free on purpose: `scripts/build/ensure-binary.ts` imports it, and
 * that file is loaded by Playwright's global setup, which should not pull the
 * bundler helpers of `./runtime-assets` in to read one constant.
 */

/**
 * The one opt-out from `describeNonCanonicalNodeModules` (`./runtime-assets`),
 * for a build whose manifest is THROWN AWAY.
 *
 * `buildBinaryIsolated` compiles a binary inside a
 * temporary `git worktree` with the repository's `node_modules` symlinked in,
 * runs it, and deletes the whole tree. Its manifest is internally consistent
 * with the `dist/` built beside it, nothing commits it, and nothing compares
 * its chunk names to anything, so canonical names buy it nothing, while a real
 * install would put a cold registry fetch on CI's E2E critical path.
 *
 * The value is not a boolean: it must be the path of the checkout being built
 * (compared by `realpath`). A stray `export` in a shell, or an opt-out that
 * leaks into a child building a DIFFERENT checkout, therefore bypasses nothing.
 */
export const THROWAWAY_RUNTIME_MANIFEST_ENV = 'SOVRIUM_THROWAWAY_RUNTIME_MANIFEST_ROOT'

/**
 * `env` with the throwaway opt-out REMOVED, for every caller whose build is not
 * throwaway.
 *
 * The realpath binding (`nonCanonicalNodeModulesRefusal`) stops an opt-out that names a different checkout,
 * but not one that names the RIGHT one: `export
 * SOVRIUM_THROWAWAY_RUNTIME_MANIFEST_ROOT=$PWD` in the primary checkout would
 * let `Generated Assets Drift`, `build:binary` or a release lane regenerate the
 * committed manifest from a symlinked install. So the opt-out is a property of
 * ONE caller, `buildBinaryIsolated`, which sets it on its own child only, and
 * every other entry point that can reach the generator passes its children this
 * scrubbed env instead of inheriting the shell's. Exported variables reach a
 * build only through a caller that put them there on purpose.
 *
 * Entry points that scrub (keep this list in step with
 * `[internal ref]`): the `Generated Assets Drift` gate,
 * `scripts/build/ensure-binary.ts` (the E2E global setup, hence quality's Smart
 * E2E and CI), `[internal ref]`, `[internal ref]`
 * (`unset`), and the three workflows that build (`.[internal ref]/workflows/test.yml`,
 * `.github/workflows/release.yml`, `.github/workflows/desktop-build.yml`, which
 * blank it at workflow level).
 */
export function withoutThrowawayOptOut(
  env: Readonly<Record<string, string | undefined>>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(
      (entry): entry is [string, string] =>
        entry[0] !== THROWAWAY_RUNTIME_MANIFEST_ENV && entry[1] !== undefined
    )
  )
}
