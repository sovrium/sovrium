/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { realpathSync } from 'node:fs'
import { SOVRIUM_PACKAGE_ROOT } from './package-paths'
import { getSovriumVersionSync } from './version'

/**
 * Build-time define injected by `scripts/build/build-binary.ts`
 * (`--define=__SOVRIUM_BUILD_STAMP__=...`): the version for a tagged release
 * build, `<version>-dev+<short sha>` for any other. Undefined from source.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- build-time define constant
declare const __SOVRIUM_BUILD_STAMP__: string | undefined

/**
 * What decides whether a build is a release: the version it carries, the tags
 * on the commit it was built from, and the CI ref when there is one.
 */
export interface BuildSignals {
  readonly version: string
  readonly tagsAtHead: readonly string[]
  readonly shortSha: string | undefined
  /** `GITHUB_REF_TYPE` — `tag` on the release workflow. */
  readonly refType?: string | undefined
  /** `GITHUB_REF_NAME` — `v<version>` on the release workflow. */
  readonly refName?: string | undefined
}

/**
 * A release build is one made from the commit tagged `v<version>`: the release
 * workflow runs on that tag push (`GITHUB_REF_TYPE=tag`, `GITHUB_REF_NAME`), and
 * a local checkout of the tag carries it at HEAD. Anything else — unreleased
 * main, a branch, the commit before the cut — is not, even with the same
 * `package.json` version, because that version moves only at the cut. Pure.
 */
export const isReleaseBuild = (signals: BuildSignals): boolean => {
  const tag = `v${signals.version}`
  return (signals.refType === 'tag' && signals.refName === tag) || signals.tagsAtHead.includes(tag)
}

/**
 * The version a build stamps on what it writes: the plain version for a release,
 * `<version>-dev+<short sha>` otherwise, and `<version>-dev` when the commit
 * cannot be read. Never the plain version for a non-release. Pure.
 */
export const formatBuildStamp = (signals: BuildSignals): string => {
  if (isReleaseBuild(signals)) return signals.version
  return signals.shortSha === undefined
    ? `${signals.version}-dev`
    : `${signals.version}-dev+${signals.shortSha}`
}

/** Whether a stamp names a non-release build. Pure. */
export const isDevStamp = (stamp: string): boolean => /-dev(?:\+[0-9a-f]+)?$/.test(stamp)

/** The one-line notice a run prints when it writes a non-release stamp. Pure. */
export const devStampNotice = (stamp: string): string =>
  stamp.includes('+')
    ? `Note: this Sovrium is not a release build — what it writes is stamped ${stamp}.`
    : `Note: this Sovrium is not a release build and its commit could not be read — what it writes is stamped ${stamp}.`

const SHORT_SHA = /^[0-9a-f]{7,40}$/

/** One `git` query in `root`, trimmed; `undefined` when git is absent or fails. */
const git = (root: string, args: readonly string[]): string | undefined => {
  try {
    const result = Bun.spawnSync(['git', '-C', root, ...args], {
      stdout: 'pipe',
      stderr: 'ignore',
      timeout: 5000,
    })
    return result.exitCode === 0 ? result.stdout.toString().trim() : undefined
  } catch {
    return undefined
  }
}

/** A path with its symlinks resolved, or itself when it cannot be. */
const real = (path: string): string => {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/**
 * The commit and tags of the checkout at `root`, or `undefined` when `root` is
 * not the top of a git checkout. The top-level comparison matters: a package
 * installed inside someone else's repository would otherwise report THAT
 * repository's commit as Sovrium's.
 */
export const readGitSignals = (
  root: string
):
  { readonly tagsAtHead: readonly string[]; readonly shortSha: string | undefined } | undefined => {
  const top = git(root, ['rev-parse', '--show-toplevel'])
  if (top === undefined || real(top) !== real(root)) return undefined
  const sha = git(root, ['rev-parse', '--short=7', 'HEAD'])
  const tags = git(root, ['tag', '--points-at', 'HEAD'])
  return {
    shortSha: sha !== undefined && SHORT_SHA.test(sha) ? sha : undefined,
    tagsAtHead: (tags ?? '').split('\n').filter((tag) => tag.length > 0),
  }
}

/** The stamp for a build of the checkout at `root`, as the build script computes it. */
export const computeBuildStamp = (
  version: string,
  root: string,
  env: Readonly<Record<string, string | undefined>>
): string => {
  const signals = readGitSignals(root)
  return formatBuildStamp({
    version,
    tagsAtHead: signals?.tagsAtHead ?? [],
    shortSha: signals?.shortSha,
    refType: env['GITHUB_REF_TYPE'],
    refName: env['GITHUB_REF_NAME'],
  })
}

const memo: { stamp?: string } = {}

/**
 * The running Sovrium's build stamp. A compiled binary carries it from its
 * build; a run from source computes it from the checkout it runs in, once.
 */
export const getBuildStamp = (): string => {
  if (typeof __SOVRIUM_BUILD_STAMP__ !== 'undefined') return __SOVRIUM_BUILD_STAMP__
  // A process-lifetime memo: the checkout does not change under a running CLI.
  memo.stamp ??= computeBuildStamp(getSovriumVersionSync(), SOVRIUM_PACKAGE_ROOT, process.env)
  return memo.stamp
}
