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
 * It imports **only `effect`**, and it must stay that way, for two reasons. The
 * first is cost: `logger.ts` pulls `@/infrastructure/telemetry/telemetry-sink`,
 * which is precisely what the `lazyImport*` discipline in
 * `src/cli/commands/utils.ts` exists to keep off the cold path of
 * `sovrium --version` and `sovrium schema`. A CLI command must be able to import
 * this vocabulary eagerly without paying for telemetry.
 *
 * The second is correctness, and it is newer and sharper. Since the journal
 * (T39) gave the structured sink and the `--watch` loop one grammar, the
 * observability runtime under `@/infrastructure/telemetry` imports
 * {@link formatClock} from here — so an edge from telemetry back into logging
 * now exists alongside the long-standing one from `logger.ts` out to
 * `@/infrastructure/telemetry/telemetry-sink`. The two do not meet today only
 * because this file terminates at `effect`. Give it any import that reaches
 * telemetry and the graph closes into a real cycle: this file, out to the
 * telemetry sink, on to the observability runtime, and back here. A slow boot
 * is the cost of the first reason; a cycle is a module initialised half-empty.
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
 *
 * ## The two streams are written differently, on purpose
 *
 * stdout goes through `Console.log`; stderr goes through {@link renderStderr},
 * which calls `process.stderr.write` — because Bun's `console.error` wraps its
 * output in ANSI red on a TTY, which T35 #3 bans. Read that function's comment
 * before touching either: it carries the dated measurement and the probe that
 * reproduces it. `process.stderr` is a global rather than an import, so the
 * effect-only rule above is untouched.
 *
 * {@link renderStderr} and its sync form {@link printStderr} are THE sanctioned
 * stderr channel for the whole CLI, not only for the emitters below. They are
 * the one pair here that exists for callers who are NOT yet writing in this
 * vocabulary: a command whose message has no named emitter still routes through
 * them, because the ANSI ban is a property of the STREAM and holds whatever the
 * message turns out to be. That is consistent with "one export at a time" — the
 * sink is the floor every stderr caller stands on, and a message that earns a
 * grammar of its own (a failure, a journal entry) gets a named emitter instead.
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
 * Duration for display (T27): `320ms` under one second, `1.2s` at or above,
 * `3.6m` at or above one minute. No space before the unit — this is mono data,
 * not prose.
 *
 * The minute band was added when the toolchain adopted this vocabulary: a
 * `bun run quality` run is minutes long, and `215.0s` makes the reader do the
 * division. One decimal throughout, so the three bands read as one scale.
 *
 * The boundaries are exact and deliberately so: 999 ms is `999ms`, 1000 ms is
 * `1.0s`, 59_999 ms is `60.0s` and 60_000 ms is `1.0m`. A band that rounded
 * INTO its own boundary — `59_999` rendering as `1.0m` — would make two
 * different durations print the same string on either side of the edge.
 */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

/**
 * A count and its noun, inflected (T29): `1 file`, `7 files`.
 *
 * The repository wrote `file(s)` in 200-odd places before this existed, which
 * T29 bans outright — the parenthetical is the writer declining to do the
 * arithmetic the reader then has to. It lives here rather than in `scripts/`
 * because `src/cli/` carries the same hack in six places; one implementation
 * serves the product CLI and the toolchain both.
 *
 * `plural` is the escape hatch for a noun English does not pluralise with `s`
 * (`entry` → `entries`). It is a parameter rather than a rule because a rule
 * would be wrong often enough to be worse than nothing.
 */
export const inflect = (count: number, singular: string, plural?: string): string =>
  `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`

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
 * THE stderr sink for the CLI. Every stderr emitter below goes through it, and
 * so does every command that writes to stderr without one — none of them may
 * use `Console.error`.
 *
 * **Bun's `console.error` COLOURS its output, and T35 #3 bans ANSI escapes.**
 * Measured on Bun 1.4.1, 2026-09-05:
 *
 * ```
 * script -q /dev/null bun -e 'console.error("x")' | od -c
 * #   033 [ 0 m   033 [ 3 1 m   x   033 [ 0 m   \r \n     ← reset, RED, x, reset
 * script -q /dev/null bun -e 'process.stderr.write("x\n")' | od -c
 * #   x   \r \n                                           ← plain
 * ```
 *
 * Effect's `Console.error` delegates to `console.error` and inherits the wrap —
 * verified with the same probe against `Effect.runSync(Console.error("x"))`.
 *
 * The colouring applies only when stderr is a TTY, which is exactly why it
 * survived: every pipe, CI log and E2E capture already sees clean bytes, and
 * only the developer at a terminal saw red. It also split the journal in two —
 * the structured sink in `telemetry/observability-runtime.ts` writes raw bytes
 * through `process.stderr.write` and was never coloured, so one screen carried
 * two conventions.
 *
 * Do NOT "simplify" this back to `Console.error`. Under a pipe the two are
 * byte-identical (`x\n` from both), so no test that captures output can tell
 * them apart and the regression would be invisible everywhere except a
 * developer's own terminal. Re-run the probe above instead.
 *
 * `process.stderr` is a global, not an import, so the module's effect-only
 * import rule is intact — `telemetry-sink.ts` and `cli/commands/admin.ts` already write
 * this way. stdout stays on `Console.log`, which Bun does NOT colour (same
 * probe, plain `x\r\n`).
 *
 * Exported for the Effect-context callers — a `yield* renderStderr(…)` inside an
 * `Effect.gen`. Everywhere else wants {@link printStderr}.
 */
export const renderStderr = (message: string): Effect.Effect<void> =>
  Effect.sync(() => {
    // eslint-disable-next-line functional/no-expression-statements -- terminal write; the newline `console.error` used to supply
    process.stderr.write(`${message}\n`)
  })

/**
 * Write one line to stderr, outside an Effect program — the sync form of
 * {@link renderStderr}, and the spelling almost every command wants.
 *
 * It replaces `Effect.runSync(Console.error(x))`, which was the CLI's default
 * stderr spelling and is banned: read {@link renderStderr} for the dated Bun
 * measurement and the pty probe that reproduces the ANSI wrap. `Console.error`
 * is not merely discouraged here — under a pipe it is byte-identical to this,
 * so the difference is invisible to every test and visible only on a developer's
 * own terminal.
 *
 * Byte-for-byte a drop-in for the single-argument `Console.error`: that call
 * appends exactly one `\n`, and so does this. The MULTI-argument form is not a
 * drop-in — `console.error` joins arguments with a space and hands a non-string
 * to Bun's pretty printer — so those callers compose the string themselves.
 */
export const printStderr = (message: string): void => Effect.runSync(renderStderr(message))

/**
 * Narrate the START of a long step to stderr (T6, T20): present participle plus
 * `…`, and a qualifier only when it is genuinely knowable.
 *
 * stderr because narration is not the command's answer (T31) — it keeps
 * `sovrium … > log` and every CI log clean. Through {@link renderStderr}, so the
 * narration is not red.
 */
export const printProgress = (participle: string, qualifier?: string): void =>
  printStderr(qualifier ? `${participle}… (${qualifier})` : `${participle}…`)

/**
 * Write a refusal to stderr. Deliberately does NOT exit — the exit code stays the
 * caller's decision, because only the caller knows whether a delegated tool's
 * code should be propagated verbatim (T33).
 *
 * Through {@link renderStderr}: severity is the WORD `Error:` and the stream
 * (T3), never a colour — and a refusal is the message most likely to be read on
 * a terminal rather than out of a log.
 */
export const printFailure = (failure: CliFailure): void => printStderr(formatFailure(failure))

// ============================================================================
// The journal (T39–T43)
// ============================================================================

/**
 * The journal clock (T39): LOCAL time, 24-hour, zero-padded `HH:MM:SS`.
 *
 * Local and not UTC because a journal is read against the wall clock the
 * operator just looked at — "is the reload on screen the one I triggered?" is
 * the only question it answers, and a UTC stamp answers it wrongly for every
 * timezone but one. Hand-rolled rather than `toLocaleTimeString`, whose
 * `hour12: false` renders midnight as `24:00:00` under several ICU builds and
 * would break the `^\d{2}:\d{2}:\d{2}` shape the specs pin.
 */
export const formatClock = (date: Readonly<Date>): string =>
  [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')

/**
 * The severity WORD (T41), rendered between the clock and the tag.
 *
 * The literal capitalisation is the value, not a label for it: `Error: ` is the
 * marker operators and log scrapers grep for (see {@link formatFailure}), so it
 * is written once, here, and every other spelling is a type error.
 */
export type JournalSeverity = 'Warning' | 'Error'

/** One journal entry: when it happened, which stream produced it, what it says. */
export interface JournalEntry {
  /** A lowercase source tag (T34), rendered bracketed. */
  readonly tag: string
  /** A capitalised sentence. Durations through {@link formatDuration} (T27). */
  readonly text: string
  /** The instant of emission — passed in so the caller owns the clock. */
  readonly at: Readonly<Date>
  /** Omitted for the ordinary stdout journal; set on the stderr printers (T41). */
  readonly severity?: JournalSeverity
}

/**
 * Render one journal line (T39, T41): `HH:MM:SS [tag] Sentence`, or
 * `HH:MM:SS Error: [tag] Sentence` when the entry carries a severity.
 *
 * The word sits BEFORE the tag, not after it: T41 fixes that order, and it is
 * the half `--watch` had backwards — a reader scanning the left edge for
 * trouble should not have to read past a variable-width tag to find it.
 *
 * Flush left — T12 makes indentation a property of the BANNER, and a journal is
 * stream mode. No trailing newline: the printer owns it (T40), and a literal
 * that pads itself is exactly how `--watch` grew its double blank lines.
 */
export const formatJournalLine = ({ tag, text, at, severity }: JournalEntry): string =>
  `${formatClock(at)} ${severity === undefined ? '' : `${severity}: `}[${tag}] ${text}`

/**
 * Drop the severity word a composed message already carries, so the printer
 * cannot double it.
 *
 * {@link formatFailure} and `formatConfigRejection` both open with the literal
 * `Error: ` because they were written for the BANNER, where that marker is the
 * only thing carrying severity. Handed to the journal, where T41 puts the word
 * in a fixed position of its own, the same string would render
 * `Error: [watch] Error: …`. Only the word being emitted is stripped: a
 * `Warning:` inside an error entry is the caller saying something, and a
 * continuation line's own `Error: ` (the first row of a JS `.stack`) is the
 * runtime's text, not ours to edit.
 */
const stripSeverityWord = (line: string, severity: JournalSeverity | undefined): string =>
  severity !== undefined && line.startsWith(`${severity}: `)
    ? line.slice(severity.length + 2)
    : line

/**
 * Render one entry to its journal lines — ONE stamp per entry, one line per
 * sentence (T39, T40).
 *
 * `text` may be multi-line, because the things worth reporting are: a config
 * rejection is a headline, a schema tree and a guidance sentence, and a runtime
 * error is a message plus its stack. Before this existed, such a message went to
 * `Console.error` whole, so the FIRST row got a clock and a tag and every row
 * under it got neither — and the blank rows separating the three parts of a
 * rejection landed inside the journal as the blank lines T40 forbids.
 *
 * Three deliberate choices:
 *
 * - **Blank rows are dropped, not rendered.** A blank line is a BANNER's
 *   separator (T13); inside one block it is not the journal's to emit.
 * - **Every row is trimmed.** T39's assertable form is
 *   `^\d{2}:\d{2}:\d{2} \[[a-z-]+\] \S` — a non-space after the tag — so a
 *   schema tree's leading indentation cannot survive into a journal line. The
 *   nesting DEPTH of a decode error is lost; its `└─` glyphs and its rows are
 *   not, and one grammar for every line is worth more than the indent.
 * - **The clock is the caller's single `at`.** All rows of one report share it,
 *   because they are one event. A per-row `new Date()` would let a slow stack
 *   render two timestamps for one failure and read as two failures.
 *
 * An entry with nothing but blank rows renders NOTHING rather than a bare
 * stamp — reachable only from a caller with no text to print, since every
 * caller here composes a literal sentence as its first row.
 */
export const formatJournalEntries = ({
  tag,
  text,
  at,
  severity,
}: JournalEntry): readonly string[] =>
  text
    .split('\n')
    .map((row) => row.trim())
    .filter((row) => row !== '')
    .map((row, index) =>
      index === 0
        ? formatJournalLine({ tag, at, severity, text: stripSeverityWord(row, severity) })
        : formatJournalLine({ tag, at, text: row })
    )

/**
 * Write one entry to a stream as a single call.
 *
 * One write and not one per row, for the same reason {@link renderDocument} is
 * atomic: the rows of a report share a clock and belong together, so a
 * concurrent emitter must not be able to land a line in the middle of them.
 * The empty case writes nothing at all — an empty write would emit exactly the
 * blank line T40 forbids.
 *
 * `write` is the STREAM, and the two are not interchangeable: stdout passes
 * `Console.log`, stderr passes {@link renderStderr}. Both append the trailing
 * newline, so the joined rows never carry one.
 */
const printJournalEntry = (
  write: (message: string) => Effect.Effect<void>,
  entry: JournalEntry
): void => {
  const lines = formatJournalEntries(entry)
  return lines.length === 0 ? undefined : Effect.runSync(write(lines.join('\n')))
}

/**
 * Append an entry to the journal on stdout, stamped at the moment of emission.
 *
 * `Console.log` supplies the newline, so nothing here carries one.
 */
export const printJournal = (tag: string, text: string): void =>
  printJournalEntry(Console.log, { tag, text, at: new Date() })

/**
 * Append a WARNING entry to the journal on stderr (T31, T41): a degradation the
 * command survived — the reload still happened, the server is still serving.
 *
 * {@link renderStderr}, never `Console.error`: a journal line carries its
 * severity as a word, and Bun would paint the whole entry red (T35 #3).
 */
export const printJournalWarning = (tag: string, text: string): void =>
  printJournalEntry(renderStderr, { tag, text, at: new Date(), severity: 'Warning' })

/**
 * Append an ERROR entry to the journal on stderr (T31, T41): the thing the
 * operator asked for did not happen.
 */
export const printJournalError = (tag: string, text: string): void =>
  printJournalEntry(renderStderr, { tag, text, at: new Date(), severity: 'Error' })
