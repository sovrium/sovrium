/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Choosing which published releases a reader asked for.
 *
 * `release-notes.ts` owns the grammar of the notes; this module owns the
 * questions asked of a parsed list — "which entry is this version?", "what came
 * after the one I upgraded from?", "what does each entry hold?". All of it is
 * pure and total: the caller hands in the releases (newest first, as the
 * payload stores them) and the running version, and gets data back. Wording is
 * the caller's.
 *
 * Versions are compared numerically on `major.minor.patch`, so `0.10.0` sorts
 * after `0.9.0`. A pre-release (`1.0.0-rc.1`) sorts before its release, and two
 * pre-releases of one version compare by their suffix as text — enough for the
 * notes, which have never carried one.
 */

import type { ReleaseNotes, ReleaseSectionKind } from './release-notes'

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/**
 * A reader's spelling of a version, as the notes spell it — or `undefined` when
 * the text is not a version at all. The tag spelling `v0.27.0` is accepted.
 */
export const normalizeVersion = (raw: string): string | undefined => {
  const trimmed = raw.trim()
  const bare = /^[vV]/.test(trimmed) ? trimmed.slice(1) : trimmed
  return VERSION.test(bare) ? bare : undefined
}

const numericParts = (version: string): readonly number[] => {
  const match = VERSION.exec(version)
  return match === null ? [0, 0, 0] : [Number(match[1]), Number(match[2]), Number(match[3])]
}

const preRelease = (version: string): string | undefined => VERSION.exec(version)?.[4]

const comparePreRelease = (a: string | undefined, b: string | undefined): number => {
  if (a === b) return 0
  if (a === undefined) return 1
  if (b === undefined) return -1
  return a < b ? -1 : 1
}

/** Negative when `a` is older than `b`, positive when newer, `0` when equal. */
export const compareVersions = (a: string, b: string): number => {
  const left = numericParts(a)
  const right = numericParts(b)
  const difference = left
    .map((part, index) => part - (right[index] ?? 0))
    .find((delta) => delta !== 0)
  return difference ?? comparePreRelease(preRelease(a), preRelease(b))
}

/** The carried release with exactly this version, if any. */
export const findRelease = (
  releases: readonly ReleaseNotes[],
  version: string
): ReleaseNotes | undefined => releases.find((release) => release.version === version)

/** The carried versions either side of one the notes do not carry. */
export interface NearestReleases {
  /** The newest carried version older than the one asked for. */
  readonly older?: string
  /** The oldest carried version newer than the one asked for. */
  readonly newer?: string
}

/** Where a version the notes do not carry would sit among the ones they do. */
export const nearestReleases = (
  releases: readonly ReleaseNotes[],
  version: string
): NearestReleases => {
  const older = releases
    .filter((release) => compareVersions(release.version, version) < 0)
    .reduce<string | undefined>(
      (best, release) =>
        best === undefined || compareVersions(release.version, best) > 0 ? release.version : best,
      undefined
    )
  const newer = releases
    .filter((release) => compareVersions(release.version, version) > 0)
    .reduce<string | undefined>(
      (best, release) =>
        best === undefined || compareVersions(release.version, best) < 0 ? release.version : best,
      undefined
    )
  return {
    ...(older === undefined ? {} : { older }),
    ...(newer === undefined ? {} : { newer }),
  }
}

/**
 * Every carried release after `since`, up to and including `running`, in the
 * order the notes keep them (newest first).
 */
export const releasesBetween = (
  releases: readonly ReleaseNotes[],
  since: string,
  running: string
): readonly ReleaseNotes[] =>
  releases.filter(
    (release) =>
      compareVersions(release.version, since) > 0 && compareVersions(release.version, running) <= 0
  )

/** One breaking change, with the release that introduced it. */
export interface BreakingChange {
  readonly version: string
  readonly scope: string | null
  readonly text: string
}

/** Every breaking change of the given releases, in the order they are given. */
export const breakingChanges = (releases: readonly ReleaseNotes[]): readonly BreakingChange[] =>
  releases.flatMap((release) =>
    release.sections
      .filter((section) => section.kind === 'breaking')
      .flatMap((section) =>
        section.entries.map((entry) => ({
          version: release.version,
          scope: entry.scope,
          text: entry.text,
        }))
      )
  )

/** How many entries one section of a release holds, by kind. */
export interface SectionCount {
  readonly kind: ReleaseSectionKind
  readonly count: number
}

/**
 * What a release holds, one count per section in the order the notes print
 * them. Two sections of one kind (only possible for `other`) count together.
 * An empty list means the release has no user-facing changes.
 */
export const sectionCounts = (release: ReleaseNotes): readonly SectionCount[] =>
  release.sections.reduce<readonly SectionCount[]>((counts, section) => {
    const existing = counts.find((count) => count.kind === section.kind)
    return existing === undefined
      ? [...counts, { kind: section.kind, count: section.entries.length }]
      : counts.map((count) =>
          count.kind === section.kind
            ? { kind: count.kind, count: count.count + section.entries.length }
            : count
        )
  }, [])
