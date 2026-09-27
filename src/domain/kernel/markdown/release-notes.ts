/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The grammar of the PUBLIC changelog, as data.
 *
 * `CHANGELOG.public.md` is written by `[internal ref]` at
 * every release and is the only source the binary's release notes are built
 * from (`sovrium changelog`). This module is the ONE reading of that grammar:
 * the build generator (`scripts/build/generate-embedded-changelog.ts`) parses
 * with it, the payload it writes is typed by it, and the binary only ever loads
 * the generated JSON — so the parser never runs on a user's machine and the
 * grammar is never re-implemented beside it.
 *
 * ## The grammar, line by line
 *
 * ```
 * ## [0.27.0](https://github.com/…/compare/v0.26.0...v0.27.0) (2026-09-23)
 *
 * ### BREAKING CHANGES | Features | Bug Fixes | Performance Improvements | <other>
 *
 * - **scope**: text
 * - text
 *
 * _No user-facing changes in this release._
 * ```
 *
 * A release holds either one or more sections, each with one or more bullets,
 * or the "no user-facing changes" note — never both, never neither.
 *
 * ## Why it refuses instead of skipping
 *
 * Whatever this parser accepts is printed by every binary that ships it, for
 * as long as that binary runs. A line it does not understand — a wrapped
 * bullet, a paragraph a manual release wrote, a stray heading — is therefore a
 * question for a human, not something to drop: dropping it would ship release
 * notes that silently omit a change. Every unrecognised line is reported with
 * its line number and the whole parse fails.
 *
 * An UNKNOWN `###` heading is the one deliberate leniency: it is kept, verbatim,
 * as kind `other`. A heading is structure the renderer can still show honestly;
 * a line of unknown shape is not.
 *
 * ## Determinism
 *
 * Releases and sections keep file order (newest first, as the file is written);
 * nothing is sorted, deduplicated or normalised. {@link renderReleaseNotes}
 * reproduces a canonical file byte for byte, which is what the unit test holds
 * against the real `CHANGELOG.public.md` and what lets the mirror prove the
 * payload came from the file it publishes.
 */

/** What a `###` heading means to a reader. `other` keeps an unknown heading's text. */
export type ReleaseSectionKind = 'breaking' | 'features' | 'fixes' | 'performance' | 'other'

/** One bullet. `scope` is the `**scope**` token, or `null` for an unscoped bullet. */
export interface ReleaseNoteEntry {
  readonly scope: string | null
  /** The bullet's text after the scope, verbatim (inline markdown is kept). */
  readonly text: string
}

/** One `###` section of a release. */
export interface ReleaseNoteSection {
  readonly kind: ReleaseSectionKind
  /** The heading exactly as written — `Bug Fixes`, not `fixes`. */
  readonly heading: string
  readonly entries: readonly ReleaseNoteEntry[]
}

/**
 * One release. An EMPTY `sections` array means the release carried the
 * "no user-facing changes" note — the parser admits no other way to be empty.
 */
export interface ReleaseNotes {
  /** Bare semver, no `v` prefix: `0.27.0`. */
  readonly version: string
  /** `YYYY-MM-DD`, as written. */
  readonly date: string
  /** The compare link the heading carries. */
  readonly compareUrl: string
  readonly sections: readonly ReleaseNoteSection[]
}

/** Why one line stopped the parse. `line` is 1-based. */
export interface ReleaseNotesParseError {
  readonly line: number
  readonly text: string
  readonly reason: string
}

/** The outcome of {@link parseReleaseNotes}: every release, or every refusal. */
export type ReleaseNotesParse =
  | { readonly _tag: 'Parsed'; readonly releases: readonly ReleaseNotes[] }
  | { readonly _tag: 'Unparseable'; readonly errors: readonly ReleaseNotesParseError[] }

/** The note `analyze-commits.ts` writes for a release with no public commit. */
export const NO_USER_FACING_CHANGES = '_No user-facing changes in this release._'

/**
 * The headings `analyze-commits.ts` writes, and what each means. Anything else
 * is kept as `other`.
 */
const KNOWN_HEADINGS: Readonly<Record<string, ReleaseSectionKind>> = {
  'BREAKING CHANGES': 'breaking',
  Features: 'features',
  'Bug Fixes': 'fixes',
  'Performance Improvements': 'performance',
}

/** The kind a `###` heading maps to. */
export const releaseSectionKind = (heading: string): ReleaseSectionKind =>
  KNOWN_HEADINGS[heading] ?? 'other'

const RELEASE_HEADING =
  /^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]\((https:\/\/[^\s()]+)\) \((\d{4}-\d{2}-\d{2})\)$/
const SECTION_HEADING = /^### (\S.*)$/

/**
 * A scoped bullet. The scope class is deliberately the SAME as the mirror's
 * scope canary (`filtered-mirror.sh`, `changelogScopes` in `analyze-commits.ts`):
 * a bullet the canary would read as scoped is scoped here, and nothing else is.
 */
const SCOPED_BULLET = /^- \*\*([a-z0-9-]+)\*\*: (\S.*)$/
const BULLET = /^- (\S.*)$/

interface Draft {
  readonly version: string
  readonly date: string
  readonly compareUrl: string
  readonly headingLine: number
  readonly sections: readonly (ReleaseNoteSection & { readonly line: number })[]
  readonly noChangesNote: boolean
}

interface State {
  readonly releases: readonly Draft[]
  readonly errors: readonly ReleaseNotesParseError[]
}

const refuse = (state: State, line: number, text: string, reason: string): State => ({
  ...state,
  errors: [...state.errors, { line, text, reason }],
})

/** Replace the last element of a non-empty list. */
const withLast = <T>(list: readonly T[], update: (last: T) => T): readonly T[] => {
  const last = list.at(-1)
  return last === undefined ? list : [...list.slice(0, -1), update(last)]
}

const onBullet = (state: State, line: number, text: string, entry: ReleaseNoteEntry): State => {
  const release = state.releases.at(-1)
  if (release === undefined || release.sections.length === 0) {
    return refuse(state, line, text, 'a bullet outside any `###` section')
  }
  return {
    ...state,
    releases: withLast(state.releases, (draft) => ({
      ...draft,
      sections: withLast(draft.sections, (section) => ({
        ...section,
        entries: [...section.entries, entry],
      })),
    })),
  }
}

const onSection = (state: State, line: number, text: string, heading: string): State => {
  const release = state.releases.at(-1)
  if (release === undefined) return refuse(state, line, text, 'a `###` heading before any release')
  if (release.noChangesNote) {
    return refuse(state, line, text, 'a section in a release already marked as having no changes')
  }
  if (release.sections.some((section) => section.heading === heading)) {
    return refuse(state, line, text, `a second \`### ${heading}\` in release ${release.version}`)
  }
  const section = { kind: releaseSectionKind(heading), heading, entries: [], line }
  return {
    ...state,
    releases: withLast(state.releases, (draft) => ({
      ...draft,
      sections: [...draft.sections, section],
    })),
  }
}

const onNoChangesNote = (state: State, line: number, text: string): State => {
  const release = state.releases.at(-1)
  if (release === undefined) return refuse(state, line, text, 'a note before any release')
  if (release.noChangesNote || release.sections.length > 0) {
    return refuse(state, line, text, 'the no-changes note in a release that already has content')
  }
  return {
    ...state,
    releases: withLast(state.releases, (draft) => ({ ...draft, noChangesNote: true })),
  }
}

interface ReleaseHeading {
  readonly version: string
  readonly compareUrl: string
  readonly date: string
}

const onRelease = (state: State, line: number, text: string, heading: ReleaseHeading): State => {
  if (state.releases.some((release) => release.version === heading.version)) {
    return refuse(state, line, text, `release ${heading.version} appears twice`)
  }
  const draft: Draft = { ...heading, headingLine: line, sections: [], noChangesNote: false }
  return { ...state, releases: [...state.releases, draft] }
}

/**
 * One kind of line: the next state when `text` is that kind, `undefined` when
 * it is not. Tried in order; the first that recognises the line wins.
 */
type LineRule = (state: State, line: number, text: string) => State | undefined

const LINE_RULES: readonly LineRule[] = [
  (state, line, text) => {
    if (text.trim() !== '') return undefined
    return text === '' ? state : refuse(state, line, text, 'whitespace-only line')
  },
  (state, line, text) => {
    const match = RELEASE_HEADING.exec(text)
    if (match === null) return undefined
    const [, version = '', compareUrl = '', date = ''] = match
    return onRelease(state, line, text, { version, compareUrl, date })
  },
  (state, line, text) => {
    const match = SECTION_HEADING.exec(text)
    return match === null ? undefined : onSection(state, line, text, match[1] ?? '')
  },
  (state, line, text) =>
    text === NO_USER_FACING_CHANGES ? onNoChangesNote(state, line, text) : undefined,
  (state, line, text) => {
    const match = SCOPED_BULLET.exec(text)
    if (match === null) return undefined
    return onBullet(state, line, text, { scope: match[1] ?? '', text: match[2] ?? '' })
  },
  (state, line, text) => {
    const match = BULLET.exec(text)
    if (match === null) return undefined
    // eslint-disable-next-line unicorn/no-null -- `scope` is a JSON wire field; `null` survives JSON.stringify where `undefined` would drop the key
    return onBullet(state, line, text, { scope: null, text: match[1] ?? '' })
  },
]

const step = (state: State, text: string, index: number): State => {
  const line = index + 1
  return (
    LINE_RULES.reduce<State | undefined>(
      (next, rule) => next ?? rule(state, line, text),
      undefined
    ) ??
    refuse(
      state,
      line,
      text,
      'not a release heading, a `###` heading, a `- ` bullet, or the no-changes note'
    )
  )
}

/** Structural refusals only visible once a release or section is complete. */
const completenessErrors = (drafts: readonly Draft[]): readonly ReleaseNotesParseError[] =>
  drafts.flatMap((draft) => [
    ...(draft.sections.length === 0 && !draft.noChangesNote
      ? [
          {
            line: draft.headingLine,
            text: `## [${draft.version}]`,
            reason: `release ${draft.version} has neither a section nor the no-changes note`,
          },
        ]
      : []),
    ...draft.sections
      .filter((section) => section.entries.length === 0)
      .map((section) => ({
        line: section.line,
        text: `### ${section.heading}`,
        reason: `section \`${section.heading}\` of release ${draft.version} has no bullet`,
      })),
  ])

/**
 * Parse the public changelog into releases, newest first as the file orders
 * them. Fails closed: ANY unrecognised line, and any structurally incomplete
 * release or section, makes the whole result `Unparseable` with every refusal
 * listed. An empty document parses to zero releases; whether zero is acceptable
 * is the caller's floor to set.
 */
export const parseReleaseNotes = (markdown: string): ReleaseNotesParse => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const state = lines.reduce<State>(step, { releases: [], errors: [] })
  const errors = [...state.errors, ...completenessErrors(state.releases)].toSorted(
    (a, b) => a.line - b.line
  )
  if (errors.length > 0) return { _tag: 'Unparseable', errors }
  return {
    _tag: 'Parsed',
    releases: state.releases.map(({ version, date, compareUrl, sections }) => ({
      version,
      date,
      compareUrl,
      sections: sections.map(({ kind, heading, entries }) => ({ kind, heading, entries })),
    })),
  }
}

/** One bullet as the changelog writes it. */
const renderEntry = (entry: ReleaseNoteEntry): string =>
  entry.scope === null ? `- ${entry.text}` : `- **${entry.scope}**: ${entry.text}`

/**
 * One release in the changelog's own markdown, ending in one newline — the same
 * block `analyze-commits.ts` writes, so it reads as the GitHub release body does.
 */
export const renderRelease = (release: ReleaseNotes): string => {
  const heading = `## [${release.version}](${release.compareUrl}) (${release.date})`
  if (release.sections.length === 0) return `${heading}\n\n${NO_USER_FACING_CHANGES}\n`
  const body = release.sections.flatMap((section) => [
    `### ${section.heading}`,
    '',
    ...section.entries.map(renderEntry),
    '',
  ])
  return `${[heading, '', ...body].join('\n').trimEnd()}\n`
}

/**
 * A whole changelog file, releases separated by one blank line — the layout the
 * release job produces by prepending each section. For a canonical file,
 * `renderReleaseNotes(parse(file)) === file`.
 */
export const renderReleaseNotes = (releases: readonly ReleaseNotes[]): string =>
  releases.map(renderRelease).join('\n')

// =============================================================================
// The embedded payload
// =============================================================================

/** The `format` tag of the payload the binary embeds. */
export const EMBEDDED_CHANGELOG_FORMAT = 'sovrium-embedded-changelog'

/**
 * The JSON the binary embeds. No timestamp and no host detail, so the same
 * changelog always produces the same bytes.
 */
export interface EmbeddedChangelogPayload {
  readonly format: typeof EMBEDDED_CHANGELOG_FORMAT
  readonly schemaVersion: 1
  readonly releases: readonly ReleaseNotes[]
}

const SECTION_KINDS: ReadonlySet<string> = new Set([
  'breaking',
  'features',
  'fixes',
  'performance',
  'other',
])

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isEntry = (value: unknown): value is ReleaseNoteEntry =>
  isRecord(value) &&
  typeof value['text'] === 'string' &&
  (value['scope'] === null || typeof value['scope'] === 'string')

const isSection = (value: unknown): value is ReleaseNoteSection =>
  isRecord(value) &&
  typeof value['kind'] === 'string' &&
  SECTION_KINDS.has(value['kind']) &&
  typeof value['heading'] === 'string' &&
  Array.isArray(value['entries']) &&
  value['entries'].length > 0 &&
  value['entries'].every(isEntry)

const isRelease = (value: unknown): value is ReleaseNotes =>
  isRecord(value) &&
  typeof value['version'] === 'string' &&
  typeof value['date'] === 'string' &&
  typeof value['compareUrl'] === 'string' &&
  Array.isArray(value['sections']) &&
  value['sections'].every(isSection)

/**
 * Whether `value` is a payload this binary can read. A structural check, not a
 * re-parse: the payload is generated and gated, so this only has to catch a
 * truncated file or a `schemaVersion` this code predates.
 */
export const isEmbeddedChangelogPayload = (value: unknown): value is EmbeddedChangelogPayload =>
  isRecord(value) &&
  value['format'] === EMBEDDED_CHANGELOG_FORMAT &&
  value['schemaVersion'] === 1 &&
  Array.isArray(value['releases']) &&
  value['releases'].every(isRelease)

/** The payload for a list of parsed releases. */
export const toEmbeddedChangelogPayload = (
  releases: readonly ReleaseNotes[]
): EmbeddedChangelogPayload => ({
  format: EMBEDDED_CHANGELOG_FORMAT,
  schemaVersion: 1,
  releases,
})
