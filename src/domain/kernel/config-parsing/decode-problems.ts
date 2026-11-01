/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The settled report of a decode failure: the raw findings the walk collected,
 * deduplicated, published as `DecodeFinding`s and, for the all-errors entry
 * point, ordered as the author's file reads.
 *
 * The migration hints for a REMOVED key, a RETIRED type, action or value are
 * the app's knowledge, not the reporter's, so they arrive as {@link DecodeHints};
 * `models/app/app-excess-property-report.ts` binds the app's own.
 */

import { SchemaIssue } from 'effect'
import { formatPath, nodeKindFromSegments } from './decode-findings'
import { walkDecodeIssue } from './decode-issue-walk'
import { comparePositions, documentPosition, refusedKeyMessage } from './decode-source-attribution'
import { suggestKey } from './key-suggestion'
import type {
  CheckFailureFinding,
  DecodeFinding,
  ExcessPropertyFinding,
  RawCheckFinding,
  RawFinding,
  RawLeafFinding,
} from './decode-findings'

/**
 * Where a value written under a name that no longer exists now lives — the
 * app's own migration knowledge, handed to the reporter. Each answers
 * `undefined` (or the lines unchanged) when it knows nothing.
 */
export interface DecodeHints {
  /** The destination of a REMOVED key, as opposed to a mistyped one. */
  readonly excessKey: (
    path: string,
    discriminant: string | undefined,
    key: string
  ) => string | undefined
  /** What a retired component `type` is now called. */
  readonly retiredComponentType: (value: string) => string | undefined
  /** What a rejected union value written under a retired action name is now. */
  readonly retiredAction: (input: unknown) => string | undefined
  /** The decoder's lines for a refused value, with a retired-value hint appended. */
  readonly retiredValueLines: (
    lines: readonly string[],
    document: unknown,
    segments: readonly (string | number)[]
  ) => readonly string[]
}

/** The decoder's own formatter — the one `SchemaError.message` renders with. */
const DECODER_FORMATTER = SchemaIssue.makeFormatterDefault()

/**
 * How much of a rejected value to echo back.
 *
 * The value is the operator's own config, so there is no disclosure concern
 * (see `reportInput` in `decode-app-config.ts`) — the cap exists only so a
 * mistyped 400-line page object does not bury its own error message.
 */
const MAX_RENDERED_INPUT = 120

/** The rejected value, rendered short enough to sit on one line. Pure. */
const renderInput = (input: unknown): string | undefined => {
  if (input === undefined) return undefined
  const rendered = JSON.stringify(input)
  if (rendered === undefined) return undefined
  return rendered.length > MAX_RENDERED_INPUT
    ? `${rendered.slice(0, MAX_RENDERED_INPUT)}...`
    : rendered
}

/**
 * Dedupe key: one report line per (path, complaint) pair.
 *
 * Branch selection already discards the duplicates that come from reporting
 * several union members at once, so this is the second line of defence rather
 * than the mechanism — but it is cheap, and a union whose members genuinely
 * repeat a complaint would otherwise print it twice.
 */
const findingIdentity = (finding: RawFinding): string => {
  switch (finding.kind) {
    case 'excess-property':
      return `excess::${formatPath(finding.segments)}::${finding.key}`
    case 'union-mismatch':
      return `union::${formatPath(finding.segments)}::${finding.variants.join('|')}`
    case 'unknown-discriminant':
      return `discriminant::${formatPath(finding.segments)}::${finding.discriminant}`
    case 'check-failure':
      return `check::${formatPath(finding.segments)}::${finding.message}`
    case 'decoder-leaf':
      return `leaf::${decoderLines(finding).join('\n')}`
  }
}

/** The decoder's own rendering of one issue at its path, as lines. Pure. */
const decoderLines = (finding: RawLeafFinding | RawCheckFinding): readonly string[] =>
  DECODER_FORMATTER(
    finding.segments.length === 0
      ? finding.issue
      : new SchemaIssue.Pointer(finding.segments, finding.issue)
  ).split('\n')

/** The illegal discriminant value the author wrote, when it was reported. Pure. */
const writtenDiscriminant = (input: unknown, name: string): string | undefined => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined
  const value = (input as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : undefined
}

const toDecodeFinding = (
  finding: Exclude<RawFinding, RawLeafFinding>,
  hints: DecodeHints
): DecodeFinding => {
  if (finding.kind === 'check-failure') {
    return { kind: 'check-failure', path: formatPath(finding.segments), message: finding.message }
  }
  if (finding.kind === 'unknown-discriminant') {
    const value = writtenDiscriminant(finding.input, finding.discriminant)
    return {
      kind: 'unknown-discriminant',
      path: formatPath(finding.segments),
      discriminant: finding.discriminant,
      value,
      nodeKind: nodeKindFromSegments(finding.segments),
      accepted: finding.accepted,
      suggestion: value === undefined ? undefined : suggestKey(value, finding.accepted),
      migration: value === undefined ? undefined : hints.retiredComponentType(value),
    }
  }
  if (finding.kind === 'union-mismatch') {
    return {
      kind: 'union-mismatch',
      path: formatPath(finding.segments),
      expected: finding.expected,
      variants: finding.variants,
      got: renderInput(finding.input),
      migration: hints.retiredAction(finding.input),
    }
  }
  const kind = nodeKindFromSegments(finding.segments)
  const path = formatPath(finding.segments)
  return {
    kind: 'excess-property',
    key: finding.key,
    path,
    nodeLabel:
      kind !== undefined && finding.discriminant !== undefined
        ? `${kind} type '${finding.discriminant}'`
        : undefined,
    accepted: finding.accepted,
    suggestion: suggestKey(finding.key, finding.accepted),
    migration: hints.excessKey(path, finding.discriminant, finding.key),
  }
}

/**
 * Everything this module can say about a decode failure, located and explained.
 *
 * Returns an empty array when the decode failed for some other reason (a missing
 * required field, a bad value); the caller is expected to fall back to the
 * decoder's own formatter so no failure is ever swallowed. Pure.
 */
export const collectDecodeFindings = (
  issue: SchemaIssue.Issue,
  hints: DecodeHints
): readonly DecodeFinding[] =>
  dedupeFindings(walkDecodeIssue(issue))
    .filter(
      (finding): finding is Exclude<RawFinding, RawLeafFinding> =>
        finding.kind !== 'decoder-leaf' &&
        (finding.kind !== 'check-failure' || finding.confirmed === true)
    )
    .map((finding) => toDecodeFinding(finding, hints))

/** One entry per (path, complaint). Pure. */
const dedupeFindings = (findings: readonly RawFinding[]): readonly RawFinding[] =>
  findings.filter(
    (finding, index, all) =>
      all.findIndex((other) => findingIdentity(other) === findingIdentity(finding)) === index
  )

/**
 * EVERY problem in a decode failure, one per mistake, in document order. Pure.
 *
 * The all-errors counterpart of `collectDecodeFindings`: what that function
 * explains is explained the same way, and what it would have left to the
 * decoder — a missing key, a wrong type, a rule outside any contested union —
 * is kept too, in the decoder's own words, as a `decoder-message`. Only failures
 * inside the union members the branch choice keeps are reported, so a mistake
 * the decoder saw through five members is still ONE problem.
 *
 * `document` is the config as parsed. When given, problems are ordered by where
 * their keys appear in it rather than by the schema's declaration order, which
 * is the order an author reads their file in.
 */
export const collectDecodeProblems = (
  issue: SchemaIssue.Issue,
  hints: DecodeHints,
  document?: unknown
): readonly DecodeFinding[] => {
  const problems = dedupeFindings(walkDecodeIssue(issue)).map(
    (
      finding
    ): { readonly finding: DecodeFinding; readonly segments: readonly (string | number)[] } => ({
      segments: finding.segments,
      finding: isRefusedKey(finding)
        ? refusedKeyFinding(finding, document)
        : finding.kind === 'decoder-leaf' ||
            (finding.kind === 'check-failure' && finding.confirmed !== true)
          ? {
              kind: 'decoder-message',
              path: formatPath(finding.segments),
              lines: hints.retiredValueLines(decoderLines(finding), document, finding.segments),
            }
          : toDecodeFinding(finding, hints),
    })
  )
  if (document === undefined) return problems.map(({ finding }) => finding)
  return problems
    .map((problem) => ({ ...problem, position: documentPosition(document, problem.segments) }))
    .toSorted((left, right) => comparePositions(left.position, right.position))
    .map(({ finding }) => finding)
}

/** A rule failure that refused a record key rather than a value. */
type RawRefusedKeyFinding = (RawCheckFinding | RawLeafFinding) & { readonly propertyKey: true }

const isRefusedKey = (finding: RawFinding): finding is RawRefusedKeyFinding =>
  (finding.kind === 'check-failure' || finding.kind === 'decoder-leaf') &&
  finding.propertyKey === true

/** A refused record key, reported by name (see `refusedKeyMessage`). Pure. */
const refusedKeyFinding = (
  finding: RawRefusedKeyFinding,
  document: unknown
): CheckFailureFinding => ({
  kind: 'check-failure',
  path: formatPath(finding.segments),
  message: refusedKeyMessage(
    finding.segments,
    finding.kind === 'check-failure'
      ? finding.message
      : (DECODER_FORMATTER(finding.issue).split('\n')[0] ?? ''),
    document
  ),
})

/**
 * Every unrecognised property the decoder rejected, located and explained.
 *
 * A narrowing of `collectDecodeFindings` kept for the callers and tests that
 * only care about this one finding kind. Pure.
 */
export const collectExcessPropertyFindings = (
  issue: SchemaIssue.Issue,
  hints: DecodeHints
): readonly ExcessPropertyFinding[] =>
  collectDecodeFindings(issue, hints).filter(
    (finding): finding is ExcessPropertyFinding & { readonly kind: 'excess-property' } =>
      finding.kind === 'excess-property'
  )
