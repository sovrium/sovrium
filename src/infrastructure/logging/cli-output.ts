/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The terminal output vocabulary — one implementation of
 * `[internal ref]`.
 *
 * ## Why this module is separate from `logger.ts`
 *
 * It imports **only `effect`**, and it must stay that way. `logger.ts` pulls
 * `@/infrastructure/telemetry/telemetry-sink`, which is precisely what the
 * `lazyImport*` discipline in `src/cli/commands/utils.ts` exists to keep off the
 * cold path of `sovrium --version` and `sovrium schema`. A CLI command must be
 * able to import this vocabulary eagerly without paying for telemetry.
 *
 * ## What lives here and what does not
 *
 * Pure formatters that turn structured lines into a string, plus the thin Effect
 * sink that writes one. Deliberately NOT here: the `⚠`-before-`✓` grouping. That
 * ordering is a *startup* semantic asserted by
 * `[internal ref]`; pushing
 * it down into {@link formatDocument} would silently reorder documents that must
 * not be reordered — `seed`'s per-table report is emitted in table order and a
 * `⚠` row belongs where the table put it.
 *
 * The module grows one export at a time as commands migrate onto it. An emitter
 * with no caller is unused code, and `bun run clean` is right to say so.
 */

import { Console, Effect } from 'effect'

/**
 * The closed glyph set (T8). Three marks, each a PREFIX, each followed by
 * exactly one space.
 *
 * `✗` is deliberately absent and stays absent: severity is carried by the word
 * `Error:` and by stderr (T3), never by a glyph.
 */
export const CLI_GLYPHS = {
  /** A phase completed, or a resolved fact. */
  ok: '✓',
  /** A degradation nobody asked for, which the command survived. */
  warn: '⚠',
  /** A LOCATOR — a URL, path, token or address. Never a verb (T9). */
  at: '→',
} as const

export type CliGlyph = keyof typeof CLI_GLYPHS

/** Banner indent (T12): the glyph sits at column 3, its text at column 5. */
export const CLI_INDENT = '  '

/** Continuation / payload indent — under the TEXT, not under the glyph (T12). */
export const CLI_CONTINUATION = '    '

/**
 * One rendered row, plus any rows that belong underneath it.
 *
 * `detail` exists for payloads that must clear 80 columns on their own — the
 * 64-hex bootstrap token is the shipping example.
 */
export interface CliLine {
  readonly glyph?: CliGlyph
  readonly text: string
  readonly detail?: readonly string[]
}

/** A group of lines rendered with no blank line between them. */
export type CliBlock = readonly CliLine[]

/**
 * Render one line to its rows: the line itself at {@link CLI_INDENT}, then any
 * `detail` rows at {@link CLI_CONTINUATION}.
 */
export const formatLine = (line: CliLine): readonly string[] => [
  line.glyph ? `${CLI_INDENT}${CLI_GLYPHS[line.glyph]} ${line.text}` : `${CLI_INDENT}${line.text}`,
  ...(line.detail ?? []).map((row) => `${CLI_CONTINUATION}${row}`),
]

/**
 * Render blocks into a banner document (T13): one blank line between blocks, one
 * leading blank line, one trailing blank line. Never two, never zero.
 *
 * Empty blocks are dropped rather than rendered as a gap — the blank line
 * belongs to the block, so a summary with no warnings must not leave a double
 * blank where the warning block would have been.
 */
export const formatDocument = (blocks: readonly CliBlock[]): string => {
  const rendered = blocks
    .filter((block) => block.length > 0)
    .map((block) => block.flatMap(formatLine).join('\n'))

  return `\n${rendered.join('\n\n')}\n`
}

/**
 * Write a banner document to stdout.
 *
 * A single `Console.log` rather than one per row: the document is atomic, so a
 * concurrent writer cannot interleave a line into the middle of the banner. The
 * emitted bytes are identical either way — `console.log` appends the newline
 * that the final blank row used to contribute.
 */
export const renderDocument = (blocks: readonly CliBlock[]): Effect.Effect<void> =>
  Console.log(formatDocument(blocks))

/**
 * Duration for display (T27): `320ms` under one second, `1.2s` at or above.
 * No space before the unit — this is mono data, not prose.
 */
export const formatDuration = (ms: number): string =>
  ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`

/**
 * Size for display (T28): integer KB, one-decimal MB, space before the unit.
 * Never raw bytes — an operator cannot read 25264128 at a glance.
 */
export const formatBytes = (bytes: number): string =>
  bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`

/**
 * A refusal. `guidance` is REQUIRED by the type on purpose: [internal ref] D4 says the
 * sentence telling someone what happens next is the one that must not be cut, and
 * a required parameter is the only version of that rule the compiler can enforce.
 */
export interface CliFailure {
  /** One sentence naming the constraint AND what did not happen. Ends in a period. */
  readonly headline: string
  /** Optional diagnosis rows, rendered at {@link CLI_INDENT}. */
  readonly detail?: readonly string[]
  /** The next action, verb at the head. Not optional. */
  readonly guidance: string
}

/**
 * Render a failure (T21): `Error: <constraint>`, the detail block, the guidance.
 *
 * The literal `Error: ` prefix is load-bearing — `config-rejected.ts` records it
 * as "the conventional CLI marker operators and log scrapers grep for", and it is
 * how severity survives a monochrome terminal (T3).
 */
export const formatFailure = (failure: CliFailure): string =>
  [
    `Error: ${failure.headline}`,
    ...(failure.detail && failure.detail.length > 0
      ? ['', ...failure.detail.map((row) => `${CLI_INDENT}${row}`)]
      : []),
    '',
    failure.guidance,
  ].join('\n')

/** Write a banner document to stdout, outside an Effect program. */
export const printDocument = (blocks: readonly CliBlock[]): void =>
  Effect.runSync(renderDocument(blocks))

/**
 * Narrate the START of a long step to stderr (T6, T20): present participle plus
 * `…`, and a qualifier only when it is genuinely knowable.
 *
 * stderr because narration is not the command's answer (T31) — it keeps
 * `sovrium … > log` and every CI log clean.
 */
export const printProgress = (participle: string, qualifier?: string): void =>
  Effect.runSync(Console.error(qualifier ? `${participle}… (${qualifier})` : `${participle}…`))

/**
 * Write a refusal to stderr. Deliberately does NOT exit — the exit code stays the
 * caller's decision, because only the caller knows whether a delegated tool's
 * code should be propagated verbatim (T33).
 */
export const printFailure = (failure: CliFailure): void =>
  Effect.runSync(Console.error(formatFailure(failure)))
