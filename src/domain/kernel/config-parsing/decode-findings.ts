/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The vocabulary of the decode reporter: what it can say about a rejected
 * config (`DecodeFinding` and its members), the raw findings the issue-tree walk
 * collects before a branch choice settles them, and the scored candidate that
 * choice ranks.
 *
 * Types and a handful of pure helpers only, so the walk, the union choice, the
 * problem collector and the report formatter can all read one definition
 * without importing each other. The design of the reporter as a whole is
 * written at the head of `decode-issue-walk.ts`.
 */

import type { SchemaIssue } from 'effect'

/** One unrecognised property, located and explained. @public */
export interface ExcessPropertyFinding {
  /** The property name the author wrote, verbatim. */
  readonly key: string
  /** Dotted/indexed path from the config root, e.g. `pages[0].components[0]`. */
  readonly path: string
  /**
   * The node's discriminant literal, when it has one (`text`, `manual`, ...),
   * paired with the singularised collection name the path arrived through
   * (`component`, `trigger`). Absent when the node is not discriminated.
   */
  readonly nodeLabel: string | undefined
  /** Every property key the schema accepts at this node, in declaration order. */
  readonly accepted: readonly string[]
  /** An accepted key within edit distance of `key`, when one exists. */
  readonly suggestion: string | undefined
  /**
   * Where this key's value now lives, when the key is a REMOVED one rather than
   * a mistyped one.
   *
   * A rename is not a typo, and the two need different help. `Did you mean` and
   * a list of accepted keys are the right answer to a slip of the fingers; they
   * are the wrong answer to a config written correctly against last month's
   * schema, where the author needs the destination and nothing else. See
   * `removed-keys.ts`.
   */
  readonly migration: string | undefined
}

/**
 * A union-typed property whose value matched none of the accepted shapes.
 *
 * WHY THIS EXISTS. Effect 3 rendered a rejected union by enumerating its
 * members' `title` annotations, so an author who wrote an unsupported
 * `onRowClick` was told "Navigate Action, Open Sheet Action" — the two things
 * they MAY write. Effect 4's default formatter names the union's own identifier
 * instead (`Expected RowClickAction`), which appears nowhere in the config
 * format or the published docs. The annotations are still on the AST; only the
 * formatter stopped reading them, so this reads them back.
 * @public
 */
export interface UnionMismatchFinding {
  readonly kind: 'union-mismatch'
  /** Dotted/indexed path from the config root. */
  readonly path: string
  /** The union's own name, when it has one — `RowClickAction`. */
  readonly expected: string | undefined
  /** Every member's human title, in declaration order. */
  readonly variants: readonly string[]
  /** The rejected value, rendered for the author. */
  readonly got: string | undefined
  /** What a value written under a retired name is now called. */
  readonly migration?: string | undefined
}

/**
 * A discriminated union whose members are UNNAMED, rejected because the value's
 * discriminant names no member.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT `UnionMismatchFinding`. That finding reports
 * a union whose members carry `title` annotations, which is the minority case:
 * measured on the real `AppSchema`, `RowClickAction` names both its members but
 * the 89-branch component union names none, so the title gate correctly stays
 * silent and v4's default formatter takes over. What it prints is every member
 * structurally expanded onto ONE 3.5 kB line — a wall that neither says which
 * `type` values are legal nor that `type` is even the thing at fault.
 *
 * The members do still agree on a discriminant, though, and those literals are
 * exactly the strings the author has to type. So this reports the VALUES rather
 * than the shapes: `Unknown component type 'badcomp' ... Accepted 'type' values:
 * container, split-pane, ...`.
 *
 * Same all-or-nothing discipline as the titles gate, for the same reason — see
 * `unionDiscriminantValues`.
 * @public
 */
export interface UnknownDiscriminantFinding {
  readonly kind: 'unknown-discriminant'
  /** Dotted/indexed path from the config root. */
  readonly path: string
  /** The property the union discriminates on — `type`. */
  readonly discriminant: string
  /** The illegal value the author wrote, when it was reported. */
  readonly value: string | undefined
  /** The singularised collection name the path arrived through — `component`. */
  readonly nodeKind: string | undefined
  /** EVERY legal value, in declaration order. Never a partial list. */
  readonly accepted: readonly string[]
  /** A legal value within edit distance of what was written, when one exists. */
  readonly suggestion: string | undefined
  /**
   * Where a RETIRED type went, when the value names one.
   *
   * Mutually exclusive with the accepted-values list at render time, for the
   * reason the removed-key migration is: an author who wrote a retired name did
   * not mistype, and ninety legal values do not tell them which one replaced it.
   */
  readonly migration: string | undefined
}

/**
 * A rule (`Schema.check`) that the chosen member of a union failed.
 *
 * WHY THIS EXISTS. When a union has several members the decoder tried, its own
 * formatter prints every member's failure: the rule the author actually broke,
 * then a line per sibling blaming them for a shape they never reached for.
 * Measured: a digest release with a refused sort key printed the right sentence
 * and then `Unexpected key with value "release"` at the step's `operator`, from
 * the action-reference member, which declares no `operator` at all.
 *
 * Reported ONLY when branch selection is decisive — the member the rule lives in
 * strictly outscores every sibling the decoder tried, at every multi-member
 * union on the way up. A tie hands the failure back to the decoder's own
 * formatter, which names every member, rather than guessing which one the author
 * meant. A rule failed outside any contested union is left to the decoder too:
 * its message already stands alone there.
 * @public
 */
export interface CheckFailureFinding {
  readonly kind: 'check-failure'
  /** Dotted/indexed path from the config root. */
  readonly path: string
  /** The rule's own message, verbatim. */
  readonly message: string
}

/**
 * A failure inside the chosen union member that this module has nothing to add
 * to — a missing key, a value of the wrong type, a rule failed outside any
 * contested union — rendered EXACTLY as the decoder's own formatter renders it.
 *
 * Exact on purpose: the decoder's wording is what docs and log scrapers know.
 * What this module decides is WHICH of these lines are printed — the ones in the
 * member the author meant, not the residue of every member the decoder tried.
 * @public
 */
export interface DecoderMessageFinding {
  readonly kind: 'decoder-message'
  /** Dotted/indexed path from the config root. */
  readonly path: string
  /** The decoder's lines: the message, then its `  at [...]` line when located. */
  readonly lines: readonly string[]
}

/** Anything this module can say about a decode failure. @public */
export type DecodeFinding =
  | (ExcessPropertyFinding & { readonly kind: 'excess-property' })
  | UnionMismatchFinding
  | UnknownDiscriminantFinding
  | CheckFailureFinding
  | DecoderMessageFinding

export interface RawExcessFinding {
  readonly kind: 'excess-property'
  readonly key: string
  readonly segments: readonly (string | number)[]
  readonly accepted: readonly string[]
  readonly discriminant: string | undefined
}

export interface RawMismatchFinding {
  readonly kind: 'union-mismatch'
  readonly segments: readonly (string | number)[]
  readonly expected: string | undefined
  readonly variants: readonly string[]
  readonly input: unknown
}

export interface RawDiscriminantFinding {
  readonly kind: 'unknown-discriminant'
  readonly segments: readonly (string | number)[]
  readonly discriminant: string
  readonly accepted: readonly string[]
  readonly input: unknown
}

export interface RawCheckFinding {
  readonly kind: 'check-failure'
  readonly segments: readonly (string | number)[]
  readonly message: string
  /** The failed check itself, so an unconfirmed rule can be rendered as the decoder would. */
  readonly issue: SchemaIssue.Issue
  /**
   * `undefined` until a contested union rules on it; then `true` only while
   * EVERY contested union above it chose decisively. One tie anywhere on the
   * way up pins it to `false` for good.
   */
  readonly confirmed: boolean | undefined
  /** Set when the rule refused a record KEY (a `Schema.isPropertyNames` check), not a value. */
  readonly propertyKey?: true
}

/** A leaf (or message-less check) the decoder reported inside the chosen member. */
export interface RawLeafFinding {
  readonly kind: 'decoder-leaf'
  readonly segments: readonly (string | number)[]
  readonly issue: SchemaIssue.Issue
  /** Set when the rule refused a record KEY (a `Schema.isPropertyNames` check), not a value. */
  readonly propertyKey?: true
}

export type RawFinding =
  RawExcessFinding | RawMismatchFinding | RawDiscriminantFinding | RawCheckFinding | RawLeafFinding

/**
 * A branch of the issue tree, scored by how much of what the author wrote it
 * recognises. Used to pick between union members (see `pickBestBranch`).
 */
export interface Candidate {
  readonly findings: readonly RawFinding[]
  readonly score: number
}

export const EMPTY_CANDIDATE: Candidate = { findings: [], score: 0 }

/** A leaf as a candidate: reported, but earning no score. Pure. */
export const leafCandidate = (
  issue: SchemaIssue.Issue,
  segments: readonly (string | number)[]
): Candidate => ({ findings: [{ kind: 'decoder-leaf', segments, issue }], score: 0 })

export const mergeCandidates = (candidates: readonly Candidate[]): Candidate => ({
  findings: candidates.flatMap((candidate) => candidate.findings),
  score: candidates.reduce((total, candidate) => total + candidate.score, 0),
})

export const toArray = <A>(value: A | ReadonlyArray<A>): readonly A[] =>
  Array.isArray(value) ? (value as readonly A[]) : [value as A]

/**
 * The rejected value, when the decode was configured to report it.
 *
 * EFFECT 4: v3's `Composite.actual` is now `Base.input`, present on EVERY issue
 * node but populated only under `reportInput: true`. Reading it through one
 * accessor keeps that dependency in a single place — see the module header for
 * why it matters and which test guards it.
 */
export const inputOf = (issue: SchemaIssue.Issue): unknown =>
  (issue as { readonly input?: unknown }).input

/** Render accumulated segments as `pages[0].components[0]`. */
export const formatPath = (segments: readonly (string | number)[]): string =>
  segments.reduce<string>(
    (acc, segment) =>
      typeof segment === 'number'
        ? `${acc}[${segment}]`
        : acc === ''
          ? segment
          : `${acc}.${segment}`,
    ''
  )

/**
 * The node's kind, derived from the path rather than hard-coded.
 *
 * `pages[0].components[0]` -> `component`; `automations[0].trigger` -> `trigger`.
 * Taking the last string segment and dropping a trailing `s` keeps this generic
 * across every collection in `AppSchema` — the alternative, a name-per-node map,
 * is the hand-maintained list this module exists to avoid.
 */
export const nodeKindFromSegments = (
  segments: readonly (string | number)[]
): string | undefined => {
  const lastName = segments.findLast((segment) => typeof segment === 'string')
  if (typeof lastName !== 'string' || lastName.length === 0) return undefined
  return lastName.endsWith('s') ? lastName.slice(0, -1) : lastName
}
