/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { INSTANCE_ENGINE_VERSION_PATTERN } from './engine-install'

const releaseParts = (version: string): readonly number[] => version.split('.').map(Number)

/**
 * Order two engine release numbers, `<major>.<minor>.<patch>`, by their
 * numbers and not their text: `0.36.10` is newer than `0.36.9`. Negative when
 * `a` is older, positive when it is newer, zero when they are the same.
 */
export const compareReleaseNumbers = (a: string, b: string): number => {
  const [left, right] = [releaseParts(a), releaseParts(b)]
  const differing = left.findIndex((part, index) => part !== (right[index] ?? 0))
  return differing === -1 ? 0 : (left[differing] ?? 0) - (right[differing] ?? 0)
}

/** The release numbers among `values`, oldest first. */
export const sortReleaseNumbers = (values: readonly string[]): readonly string[] =>
  values
    .filter((value) => INSTANCE_ENGINE_VERSION_PATTERN.test(value))
    .toSorted(compareReleaseNumbers)

/**
 * Whether a release moving an app from `current` to `next` raises its engine:
 * `next` is newer, or the current release links no engine at all (written
 * before engines were linked, so not provably older).
 */
export const raisesEngine = (current: string | undefined, next: string): boolean =>
  current === undefined || compareReleaseNumbers(next, current) > 0

/**
 * The entry inside a release that links the engine binary it runs on. The
 * host writes it; a bundle never may, so it is reserved by name.
 */
export const ENGINE_LINK_ENTRY = '.engine'

/** The first of `paths` that is `.engine` or under it (`./` prefixes ignored), else `undefined`. */
export const reservedEngineEntry = (paths: Iterable<string>): string | undefined =>
  [...paths].find((path) => {
    const bare = path.replace(/^(?:\.\/)+/, '')
    return bare === ENGINE_LINK_ENTRY || bare.startsWith(`${ENGINE_LINK_ENTRY}/`)
  })

/**
 * Which engine an apply links: `Link` the one named, or — for the revision
 * already current — the one that release links; `Running` the engine running
 * the step when neither applies; `Conflict` when the current revision is
 * asked to run another engine, which only a new revision may.
 */
export type ReleaseEngineChoice =
  | { readonly _tag: 'Link'; readonly engine: string }
  | { readonly _tag: 'Running' }
  | { readonly _tag: 'Conflict' }

export const chooseReleaseEngine = (release: {
  readonly isCurrent: boolean
  readonly named: string | undefined
  readonly current: string | undefined
}): ReleaseEngineChoice => {
  const { isCurrent, named, current } = release
  if (named !== undefined) {
    return isCurrent && named !== current ? { _tag: 'Conflict' } : { _tag: 'Link', engine: named }
  }
  return isCurrent && current !== undefined
    ? { _tag: 'Link', engine: current }
    : { _tag: 'Running' }
}
