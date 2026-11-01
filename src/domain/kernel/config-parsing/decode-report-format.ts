/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two renderings of a decode report: the prose lines a person reads under
 * `Validation failed:`, and the flattened `ConfigFinding` every machine-readable
 * channel publishes — with THE ECHO RULE, which decides what a finding may say
 * about a rejected value, applied at the one producer.
 */

import { attributeSourceFile } from './decode-source-attribution'
import { decoderAtNotation, decoderPathToFindingPath } from './decoder-notation'
import type {
  DecodeFinding,
  DecoderMessageFinding,
  UnionMismatchFinding,
  UnknownDiscriminantFinding,
} from './decode-findings'

/** `Did you mean 'x'?`, or nothing when no near-miss was found. Pure. */
const suggestionLine = (suggestion: string | undefined): readonly string[] =>
  suggestion === undefined ? [] : [`    Did you mean '${suggestion}'?`]

/** The headline and trailer for a rejected union whose members are named. */
const mismatchLines = (finding: UnionMismatchFinding): readonly [string, string] => [
  `  Expected ${finding.expected ?? 'one of the accepted variants'}${
    finding.got ? `, got ${finding.got}` : ''
  }`,
  `    Accepted variants: ${finding.variants.join(', ')}`,
]

/**
 * The headline and trailer for an unknown discriminant value.
 *
 * The `accepted` list is exhaustive by construction (see
 * `unionDiscriminantValues`) and is printed in full, never elided. A `...` here
 * would read as "and some others", which is precisely the impression that sends
 * an author away from a legal value.
 */
const discriminantLines = (finding: UnknownDiscriminantFinding): readonly [string, string] => [
  `  Unknown ${finding.nodeKind ?? 'value'} ${finding.discriminant}${
    finding.value === undefined ? '' : ` '${finding.value}'`
  }`,
  `    Accepted ${finding.discriminant} values: ${finding.accepted.join(', ')}`,
]

/**
 * One finding in the vocabulary every MACHINE-readable channel speaks.
 *
 * `DecodeFinding` is a union of three shapes, each carrying the fields its own
 * report line needs. That is right for rendering prose and wrong for a program:
 * a caller would have to switch on `kind` and learn three field names for the
 * one question it is asking, which is "where, what, and what may I write
 * instead". So this is the flattened projection — the same three answers in the
 * same three fields whatever the decoder actually complained about.
 *
 * The same shape is published by `sovrium validate --json`, by the status file
 * a running instance writes, and by the message a refused `--watch` save pushes
 * to an open page. One vocabulary, because a caller that ASKED and a caller that
 * was TOLD are reading about the same mistake and should not need two parsers.
 * @public
 */
export interface ConfigFinding {
  /**
   * Dotted/indexed path from the config root, e.g. `pages[0].components[0]`.
   *
   * `''` for a finding about the config as a whole — a rule that relates two
   * distant declarations has no single position to underline, and inventing one
   * would send an editor to the wrong line.
   */
  readonly path: string
  /** What is wrong, in one line, naming the offending value where there is one. */
  readonly message: string
  /**
   * What may be written here instead, IN FULL and never elided.
   *
   * The only field that tells a caller what to do rather than what went wrong.
   * A truncated list reads as the complete set — see `unionDiscriminantValues`
   * for why the producers are all-or-nothing about it.
   */
  readonly accepted?: readonly string[]
  /** The `$ref` partial the mistake lives in, when the config is split. */
  readonly sourceFile?: string
  /**
   * Always `'error'` today: every decode finding is fatal (see the SEVERITY note
   * in `decode-app-config.ts`). The field exists so a reader can branch on it
   * without re-deriving the rule from the channel it arrived on — notices travel
   * separately and deliberately.
   */
  readonly severity: 'error'
}

// =============================================================================
// THE ECHO RULE
// =============================================================================
//
// A finding may name a rejected VALUE only where that value was checked against
// a closed set of writable literals which the same finding publishes in full
// under `accepted`. Everywhere else the value is dropped and the finding keeps
// the path, the complaint and the expected shape.
//
// WHY IT LIVES HERE AND NOWHERE ELSE. Four channels carry these findings, and
// none of their readers is the operator holding the keyboard: the `status.json`
// a running instance leaves on disk, the unauthenticated `/__sovrium_dev/reload`
// stream, `sovrium validate --json`, and the `_config_validate` MCP tool. They
// share this vocabulary precisely so a caller that ASKED and a caller that was
// TOLD need one parser — so a strip applied to one channel and not another would
// end the property that makes `ConfigFinding` worth having. Applied at the two
// producers, every present and future channel inherits it.
//
// The PROSE report is deliberately unchanged: `formatDecodeReport` still echoes
// everything, because its reader wrote the file and the value is the part they
// act on. `reportInput` in `decode-app-config.ts` says the same thing from the
// other end.
//
// WHY THE LINE IS `accepted` AND NOT A JUDGEMENT ABOUT THE STRING. Deciding
// whether a value "looks like a secret" needs a classifier, and the only one in
// the codebase is path-based over a DECODED config — which by definition does
// not exist when the decode failed. So the discriminant is the finding's own
// provenance, and the finding's `kind` names it:
//
//  - `unknown-discriminant` — `accepted` comes from `unionDiscriminantValues`,
//    which is all-or-nothing over literals read off the AST. So a value here was
//    provably compared against an enumerated list of names the finding also
//    carries, and it is a failed member NAME. KEPT.
//  - `union-mismatch` — `variants` are the members' human `title` annotations,
//    which no author can write into a config. The input was compared against
//    SHAPES, and what fits none of them is arbitrary data whose leaves are
//    whatever happened to be in the file. DROPPED.
//  - `excess-property` — the message names a KEY, never a value. Structural, and
//    the thing the author has to delete. Unchanged.
//
// Over-stripping is the cheaper mistake to make and costs a real thing: the
// browser error overlay is built around painting the rejected component type,
// and a reader told only "unknown component type" has to reopen the file to find
// out which one. A CLI validate spec is the control that keeps the line where it is.
//
// RESIDUAL RISK, ACCEPTED. A credential pasted over a component `type` is still
// echoed. It is bounded to one string at a position expecting one of about
// ninety enum names, and the same paste has already written the credential into
// the config file the finding is about.

/**
 * The same finding with any rejected value that the rule does not permit
 * removed. Pure.
 *
 * A projection rather than a flag, so `findingMessage` stays the one place the
 * wording of a headline is decided and the two channels cannot come to disagree
 * about anything but the value.
 */
const withoutEchoedValue = (
  finding: Exclude<DecodeFinding, DecoderMessageFinding>
): Exclude<DecodeFinding, DecoderMessageFinding> =>
  finding.kind === 'union-mismatch' ? { ...finding, got: undefined } : finding

/**
 * Where the decoder appends a rejected value to its OWN message.
 *
 * Upstream builds it in exactly one place — `SchemaIssue.ts`, whose whole
 * construction is `input === undefined ? \`Expected ${expected}\` : \`Expected
 * ${expected}, got ${input}\`` — so this matches a documented format rather than
 * guessing at prose. Read, do not re-derive: `vendor/effect`, `SchemaIssue.ts`.
 *
 * `clauseStart` below takes the FIRST occurrence and drops everything after it,
 * because a rendered value may itself contain `, got ` and this has to fail
 * toward stripping. What survives is `Expected <type>`, which is the half a
 * reader needs.
 */
const REPORTED_INPUT_CLAUSE = ', got '

/**
 * The four characters a JavaScript `.` refuses to match.
 *
 * NOT the same set as the `split('\n')` below, and that gap is the whole reason
 * this constant exists: a config authored on Windows reaches the splitter as
 * CRLF and leaves a `\r` on the end of every line, and `\u2028`/`\u2029` can sit
 * inside a rejected value verbatim.
 */
const LINE_TERMINATORS = ['\n', '\r', '\u2028', '\u2029'] as const

/**
 * Where a line's reported-input clause starts, or `-1`. Pure, and LINEAR.
 *
 * This was the regex `/, got .*$/` until a ReDoS audit, and that regex was
 * quadratic rather than wrong. `.` never matched a line terminator while `$`
 * (no `m` flag) only ever matched end-of-input, so a line carrying one could
 * never satisfy the tail — and the engine answered by re-walking the entire
 * remainder from each of the N occurrences of `, got `. Measured before the
 * fix: 96 KB of `", got "` followed by one `\r` took 606 ms, quadrupling on
 * every doubling. The input is a config file, so its length is the author's.
 *
 * The semantics are preserved exactly rather than approximated. Because `$` is
 * end-of-input, a match could only ever have landed AFTER the last line
 * terminator, so the first occurrence in that tail is precisely the one the
 * regex would have found — which is why the search starts there and not at
 * zero. `lastIndexOf` and `indexOf` are both linear; nothing here backtracks.
 */
const clauseStart = (line: string): number =>
  line.indexOf(
    REPORTED_INPUT_CLAUSE,
    Math.max(...LINE_TERMINATORS.map((terminator) => line.lastIndexOf(terminator))) + 1
  )

/** Every line of a message with its reported-input clause removed. Pure. */
const withoutReportedInput = (message: string): string =>
  message
    .split('\n')
    .map((line) => {
      const clause = clauseStart(line)
      return clause === -1 ? line : line.slice(0, clause)
    })
    .join('\n')

/** The headline of a finding, reusing the exact wording its report line uses. */
const findingMessage = (finding: Exclude<DecodeFinding, DecoderMessageFinding>): string => {
  if (finding.kind === 'check-failure') return withoutReportedInput(finding.message)
  if (finding.kind === 'unknown-discriminant') return discriminantLines(finding)[0].trim()
  if (finding.kind === 'union-mismatch') return mismatchLines(finding)[0].trim()
  return `Unknown property '${finding.key}'${finding.nodeLabel ? ` on ${finding.nodeLabel}` : ''}`
}

/** What may be written at this node — the values, the keys, or the variants. */
const findingAccepted = (
  finding: Exclude<DecodeFinding, DecoderMessageFinding>
): readonly string[] | undefined => {
  if (finding.kind === 'check-failure') return undefined
  return finding.kind === 'union-mismatch' ? finding.variants : finding.accepted
}

/**
 * Project decode findings into the machine-readable vocabulary, attributing each
 * one to the `$ref` partial it came from. Pure.
 *
 * Subject to THE ECHO RULE above: the projection is taken from a finding whose
 * unpermitted value has already been dropped, so no channel reading `findings`
 * has to know the rule exists.
 */
export const toConfigFindings = (
  findings: readonly DecodeFinding[],
  refSources: ReadonlyMap<string, string>
): readonly ConfigFinding[] =>
  findings.flatMap((finding): readonly ConfigFinding[] => {
    const sourceFile = attributeSourceFile(finding.path, refSources)
    // Structured exactly as the decoder-message fallback always structured
    // these lines, so a program sees the same finding it saw before.
    if (finding.kind === 'decoder-message') {
      return messageLinesAsConfigFindings(finding.lines).map((config) => ({
        ...config,
        ...(sourceFile !== undefined && { sourceFile }),
      }))
    }
    const accepted = findingAccepted(finding)
    return [
      {
        path: finding.path,
        message: findingMessage(withoutEchoedValue(finding)),
        ...(accepted !== undefined && { accepted }),
        ...(sourceFile !== undefined && { sourceFile }),
        severity: 'error' as const,
      },
    ]
  })

/**
 * A message with no position, as a finding.
 *
 * The fallback for every refusal this module cannot locate — a cross-field rule,
 * a parse failure, a boot that threw. A caller reading `findings` must not have
 * to ALSO read a prose list to be sure it has seen everything, so an unlocatable
 * complaint is published with an empty path rather than dropped. Pure.
 *
 * Publishes no `accepted`, and so by THE ECHO RULE above carries no value: this
 * is the path an `env:` block written as a mapping takes, where the decoder's own
 * `Expected array | undefined, got {"STRIPE_SECRET_KEY":"…"}` is the message and
 * the rejected value is a credential by definition.
 */
export const messageAsConfigFinding = (message: string): ConfigFinding => ({
  path: '',
  message: withoutReportedInput(message),
  severity: 'error',
})

/**
 * Structure the decoder's own message lines — the fallback for a refusal the
 * walker above cannot explain, such as a length or pattern check.
 *
 * The decoder prints each complaint on one line and, indented beneath it, the
 * `at ["key"][0]` line locating it. Publishing both as pathless findings left a
 * program parsing prose to find the position; pairing them keeps each finding
 * locatable by its `path` alone, and the message ends `(at <path>)` for a reader. A line with no `at` line under it stays a
 * finding about the config as a whole (`path: ''`). Pure.
 */
export const messageLinesAsConfigFindings = (lines: readonly string[]): readonly ConfigFinding[] =>
  lines.reduce<readonly ConfigFinding[]>((findings, line) => {
    const notation = decoderAtNotation(line)
    const previous = findings.at(-1)
    if (notation !== undefined && previous !== undefined && previous.path === '') {
      const path = decoderPathToFindingPath(notation)
      // The position rides in `path` for a program, and stays named in the
      // one-line message for a reader shown the message alone (an overlay, an
      // MCP transcript) — trailing, so the message still opens with the fault.
      return [
        ...findings.slice(0, -1),
        { ...previous, path, message: `${previous.message} (at ${path})` },
      ]
    }
    return notation === undefined ? [...findings, messageAsConfigFinding(line)] : findings
  }, [])

/** Findings as the lines under `Validation failed:`; empty means "use the decoder's". Pure. */
export const formatDecodeReport = (
  findings: readonly DecodeFinding[],
  refSources: ReadonlyMap<string, string>
): readonly string[] =>
  findings.flatMap((finding) =>
    // The decoder's own lines, verbatim, under the report's indentation.
    finding.kind === 'decoder-message'
      ? finding.lines.map((line) => `  ${line}`)
      : formatExplainedFinding(finding, refSources)
  )

/** A retired name's replacement, as a detail line under its problem. Pure. */
const migrationLine = (m: string | undefined): readonly string[] => (m ? [`    ${m}`] : [])

/** The report lines of one finding this module explains. Pure. */
const formatExplainedFinding = (
  finding: Exclude<DecodeFinding, DecoderMessageFinding>,
  refSources: ReadonlyMap<string, string>
): readonly string[] => {
  const sourceFile = attributeSourceFile(finding.path, refSources)
  const at = `    at ${finding.path}${sourceFile ? `  (${sourceFile})` : ''}`
  // A finding at the config ROOT has no path, and `at ` with nothing after it
  // reads as a truncated line rather than as "the top level".
  const atLine = finding.path === '' && sourceFile === undefined ? [] : [at]

  if (finding.kind === 'union-mismatch') {
    const [headline, trailer] = mismatchLines(finding)
    return [headline, ...atLine, trailer, ...migrationLine(finding.migration)]
  }

  if (finding.kind === 'check-failure') return [`  ${finding.message}`, ...atLine]

  if (finding.kind === 'unknown-discriminant') {
    const [headline, trailer] = discriminantLines(finding)
    // A RETIRED type gets its destination and nothing else, for the reason
    // spelled out on the removed-key branch below: the author did not
    // mistype, so a near-miss suggestion is noise and the accepted-values
    // list is ninety names that do not answer the question they are holding.
    if (finding.migration !== undefined) {
      return [
        headline,
        ...atLine,
        ...finding.migration.split('\n').map((line) => (line === '' ? '' : `    ${line}`)),
      ]
    }
    return [headline, ...atLine, ...suggestionLine(finding.suggestion), trailer]
  }

  const headline = `  Unknown property '${finding.key}'${
    finding.nodeLabel ? ` on ${finding.nodeLabel}` : ''
  }`

  // A REMOVED key gets its destination and nothing else. The near-miss
  // suggestion and the accepted-key list are the right help for a typo and
  // actively unhelpful here: the author did not mistype, and reading a list of
  // twenty accepted keys to work out that `borderRadius` is now `radius` is
  // the work the migration line exists to do for them.
  if (finding.migration !== undefined) {
    return [
      headline,
      ...atLine,
      ...finding.migration.split('\n').map((line) => (line === '' ? '' : `    ${line}`)),
    ]
  }

  return [
    headline,
    ...atLine,
    ...suggestionLine(finding.suggestion),
    `    Accepted here: ${finding.accepted.join(', ')}`,
  ]
}
