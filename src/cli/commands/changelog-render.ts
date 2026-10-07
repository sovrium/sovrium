/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What `sovrium changelog` prints, as a pure function of the embedded releases.
 *
 * `changelog.ts` reads argv, loads the payload and writes the result; every
 * decision in between — which view was asked for, which releases it covers,
 * how each renders, and why a request is refused — is made here, so the one
 * path an end-to-end run cannot reach (a build whose own version has no
 * published entry yet) is covered by `changelog-render.test.ts` instead.
 *
 * ## The markdown heading drops the link
 *
 * The published heading is `## [0.27.0](<compare url>)`. A
 * terminal cannot follow the link and a reader skimming for a version has to
 * read past it, so the terminal heading is `## 0.27.0`. The link
 * is not lost: `--format json` carries it as `compareUrl`.
 *
 * ## Breaking changes first
 *
 * Someone who skipped several versions reads `--since` for one reason above the
 * others — what will stop working — so that view gathers every breaking change
 * of its range into one block, each naming its version, before any entry.
 */

import {
  NO_USER_FACING_CHANGES,
  type ReleaseNoteEntry,
  type ReleaseNotes,
  type ReleaseSectionKind,
} from '@/domain/kernel/markdown/release-notes'
import {
  breakingChanges,
  compareVersions,
  findRelease,
  nearestReleases,
  normalizeVersion,
  releasesBetween,
  sectionCounts,
  type SectionCount,
} from '@/domain/kernel/markdown/release-notes-selection'

/** The formats `sovrium changelog` emits. */
export type ChangelogFormat = 'md' | 'json'

/** One `sovrium changelog` invocation, its flags already read from argv. */
export interface ChangelogRequest {
  /** Every positional after `changelog` — at most one version is accepted. */
  readonly args: readonly string[]
  readonly list: boolean
  /** Whether `--since` appeared at all, with or without a value. */
  readonly sinceRequested: boolean
  readonly since?: string
  readonly format: ChangelogFormat
  /** The version this binary reports. */
  readonly running: string
}

/** Either the document to emit, or the refusal to print on stderr. */
export type ChangelogOutcome =
  | { readonly kind: 'content'; readonly content: string }
  | { readonly kind: 'refused'; readonly reason: string }

const LIST_HINT = 'Run `sovrium changelog --list` to see every release this binary carries.'

const refused = (reason: string): ChangelogOutcome => ({ kind: 'refused', reason })
const content = (text: string): ChangelogOutcome => ({ kind: 'content', content: text })

// =============================================================================
// Markdown
// =============================================================================

const renderEntryLine = (entry: ReleaseNoteEntry): string =>
  entry.scope === null ? `- ${entry.text}` : `- **${entry.scope}**: ${entry.text}`

/** One release as the terminal prints it: the published entry, heading without its link. */
export const renderReleaseForTerminal = (release: ReleaseNotes): string => {
  const heading = `## ${release.version} (${release.date})`
  if (release.sections.length === 0) return `${heading}\n\n${NO_USER_FACING_CHANGES}\n`
  const body = release.sections.flatMap((section) => [
    `### ${section.heading}`,
    '',
    ...section.entries.map(renderEntryLine),
    '',
  ])
  return `${[heading, '', ...body].join('\n').trimEnd()}\n`
}

const renderReleasesForTerminal = (releases: readonly ReleaseNotes[]): string =>
  releases.map(renderReleaseForTerminal).join('\n')

const plural = (count: number, singular: string, pluralForm: string): string =>
  `${count} ${count === 1 ? singular : pluralForm}`

const COUNT_WORDS: Readonly<Record<ReleaseSectionKind, readonly [string, string]>> = {
  breaking: ['breaking', 'breaking'],
  features: ['feature', 'features'],
  fixes: ['fix', 'fixes'],
  performance: ['performance improvement', 'performance improvements'],
  other: ['other', 'other'],
}

const describeCount = ({ kind, count }: SectionCount): string =>
  plural(count, COUNT_WORDS[kind][0], COUNT_WORDS[kind][1])

/** What one release holds, as a `--list` line says it: `1 feature, 3 fixes`. */
export const summarizeRelease = (release: ReleaseNotes): string => {
  const counts = sectionCounts(release)
  return counts.length === 0 ? 'no user-facing changes' : counts.map(describeCount).join(', ')
}

const renderList = (releases: readonly ReleaseNotes[], running: string): string => {
  const width = Math.max(0, ...releases.map((release) => release.version.length))
  const lines = releases.map((release) => {
    const marker = release.version === running ? '  (current)' : ''
    return `${release.version.padEnd(width)}  ${release.date}  ${summarizeRelease(release)}${marker}`
  })
  const header = `${plural(releases.length, 'release', 'releases')} in this binary, newest first:`
  return `${[header, '', ...lines].join('\n')}\n`
}

const renderBreakingBlock = (releases: readonly ReleaseNotes[], since: string): string => {
  const changes = breakingChanges(releases)
  if (changes.length === 0) return `No breaking changes since ${since}.\n`
  const lines = changes.map((change) =>
    change.scope === null
      ? `- ${change.version} — ${change.text}`
      : `- ${change.version} — **${change.scope}**: ${change.text}`
  )
  return `${[`## Breaking changes since ${since}`, '', ...lines].join('\n')}\n`
}

const footer = (earlier: number): string =>
  `${plural(earlier, 'earlier release', 'earlier releases')} — run \`sovrium changelog --list\` to see them.`

// =============================================================================
// JSON
// =============================================================================

const toJsonRelease = (release: ReleaseNotes, running: string) => ({
  version: release.version,
  date: release.date,
  compareUrl: release.compareUrl,
  current: release.version === running,
  sections: release.sections.map((section) => ({
    kind: section.kind,
    title: section.heading,
    entries: section.entries.map((entry) => ({ scope: entry.scope, text: entry.text })),
  })),
})

const renderJson = (releases: readonly ReleaseNotes[], running: string): string =>
  `${JSON.stringify(
    {
      format: 'sovrium-changelog',
      schemaVersion: 1,
      engine: running,
      releases: releases.map((release) => toJsonRelease(release, running)),
    },
    undefined,
    2
  )}\n`

// =============================================================================
// Views
// =============================================================================

const notCarried = (releases: readonly ReleaseNotes[], version: string, running: string) => {
  const { older, newer } = nearestReleases(releases, version)
  const nearest = [
    ...(older === undefined ? [] : [`${older} (older)`]),
    ...(newer === undefined ? [] : [`${newer} (newer)`]),
  ]
  const nearestLine =
    nearest.length === 0 ? '' : `  Nearest releases it carries: ${nearest.join(', ')}.\n`
  const newerLine =
    compareVersions(version, running) > 0
      ? `  This binary is ${running}; it cannot carry the notes of a later release.\n`
      : ''
  return refused(
    `Error: This binary carries no release ${version}.\n\n${nearestLine}${newerLine}  ${LIST_HINT}`
  )
}

const notAVersion = (raw: string, flag: string): ChangelogOutcome =>
  refused(
    `Error: ${flag}"${raw}" is not a version.\n\n` +
      `  Name a release by its number, such as 0.27.0 or v0.27.0.\n  ${LIST_HINT}`
  )

const emit = (
  format: ChangelogFormat,
  releases: readonly ReleaseNotes[],
  running: string,
  markdown: () => string
): ChangelogOutcome => content(format === 'json' ? renderJson(releases, running) : markdown())

/** The default view: the running version's entry, or the latest one for an unpublished build. */
const defaultView = (releases: readonly ReleaseNotes[], request: ChangelogRequest) => {
  const own = findRelease(releases, request.running)
  const shown = own ?? releases[0]
  if (shown === undefined) return refused('Error: This binary carries no release notes.')
  const note =
    own === undefined
      ? `This build (${request.running}) is not a published release, so it has no entry of its own yet. ` +
        `The latest published entry, ${shown.version}, follows.\n\n`
      : ''
  return emit(
    request.format,
    [shown],
    request.running,
    () => `${note}${renderReleaseForTerminal(shown)}\n${footer(releases.length - 1)}\n`
  )
}

const singleView = (releases: readonly ReleaseNotes[], raw: string, request: ChangelogRequest) => {
  const version = normalizeVersion(raw)
  if (version === undefined) return notAVersion(raw, '')
  const release = findRelease(releases, version)
  if (release === undefined) return notCarried(releases, version, request.running)
  return emit(request.format, [release], request.running, () => renderReleaseForTerminal(release))
}

const sinceView = (releases: readonly ReleaseNotes[], raw: string, request: ChangelogRequest) => {
  const since = normalizeVersion(raw)
  if (since === undefined) return notAVersion(raw, '--since ')
  if (compareVersions(since, request.running) >= 0) {
    return emit(request.format, [], request.running, () =>
      since === request.running
        ? `Already up to date: ${request.running} is the version you run.\n`
        : `Already up to date: you run ${request.running}, which is not older than ${since}.\n`
    )
  }
  if (findRelease(releases, since) === undefined) {
    return notCarried(releases, since, request.running)
  }
  const range = releasesBetween(releases, since, request.running)
  return emit(
    request.format,
    range,
    request.running,
    () => `${renderBreakingBlock(range, since)}\n${renderReleasesForTerminal(range)}`
  )
}

/** Why the combination of arguments is ambiguous, or `undefined` when it is not. */
const conflict = (request: ChangelogRequest): string | undefined => {
  const [version] = request.args
  if (request.args.length > 1) {
    return `Error: sovrium changelog takes one version at most, got "${request.args.join(' ')}".`
  }
  const sinceLabel = `--since ${request.since ?? ''}`.trimEnd()
  const views = [
    ...(version === undefined ? [] : [`the version ${version}`]),
    ...(request.list ? ['--list'] : []),
    ...(request.sinceRequested ? [sinceLabel] : []),
  ]
  if (views.length > 1) {
    return (
      `Error: ${views.join(' and ')} ask for different views; ask for one at a time.\n\n` +
      `  sovrium changelog <version>      one release\n` +
      `  sovrium changelog --list         every release\n` +
      `  sovrium changelog --since <v>    every release after <v>`
    )
  }
  if (request.sinceRequested && request.since === undefined) {
    return 'Error: --since needs a version, such as --since 0.26.0.'
  }
  return undefined
}

/** Resolve one `sovrium changelog` request against the embedded releases (newest first). */
export const renderChangelogRequest = (
  releases: readonly ReleaseNotes[],
  request: ChangelogRequest
): ChangelogOutcome => {
  const ambiguous = conflict(request)
  if (ambiguous !== undefined) return refused(ambiguous)
  const [version] = request.args
  if (version !== undefined) return singleView(releases, version, request)
  if (request.list) {
    return emit(request.format, releases, request.running, () =>
      renderList(releases, request.running)
    )
  }
  if (request.since !== undefined) return sinceView(releases, request.since, request)
  return defaultView(releases, request)
}
