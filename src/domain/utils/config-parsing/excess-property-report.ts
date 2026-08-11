/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Turn an Effect `ParseIssue` into a report an author can act on.
 *
 * `sovrium validate` has always decoded with `onExcessProperty: 'error'`, so an
 * unrecognised property has always been rejected. What it could not do was
 * SAY SO usably. Measured on this binary, a config whose only mistake is `tag`
 * on a `text` component (the property is spelled `element`) produced 67 lines of
 * `TreeFormatter` output, 19 of them `From side refinement failure` — one
 * nesting level per top-level `Schema.filter` on `AppSchema`, each printed
 * twice. The name of the offending property sat on line 52; its path was never
 * printed at all.
 *
 * This module answers the four questions the author actually has:
 *
 *   Unknown property 'tag' on component type 'text'
 *     at pages[0].components[0]  (home.json)
 *     Did you mean 'element'?
 *     Accepted here: type, children, props, content, ...
 *
 * THREE PROPERTIES THAT MAKE IT SAFE
 * ----------------------------------
 * 1. **Diagnostic, never adjudicating.** This runs only AFTER the decoder has
 *    already rejected the config. It cannot invent a failure, and when it finds
 *    nothing to say the caller falls back to `TreeFormatter`. A decode failure
 *    is never swallowed because this module could not explain it.
 *
 * 2. **Accepted keys come from the AST, not a list.** They are read off the
 *    `TypeLiteral` the decoder itself was checking against
 *    (`Composite.ast.propertySignatures`), so they cannot drift from the schema.
 *    That is the whole point: a hand-maintained per-node allow-list is the
 *    failure mode this replaces (see
 *    `src/application/use-cases/automations/validate-trigger-configs.ts`, nine
 *    such lists whose own JSDoc asks to be kept in sync by hand).
 *
 * 3. **Suggestions are edit-distance only.** `elemnt` -> `element` is a real
 *    near-miss and is offered; `tag` -> `element` is not derivable and is NOT
 *    invented. A suggester that always produces something sends the author to
 *    the wrong property, which is worse than staying quiet — and the accepted
 *    key list already contains `element` either way. A curated alias map would
 *    reintroduce exactly the hand-maintained list this module exists to end.
 *
 * Nothing here is component-specific. The walk is driven by the issue tree and
 * the AST, so a trigger, a table field or any future discriminated union in
 * `AppSchema` reports in the same shape for free.
 *
 * ONE PROPERTY PER RUN
 * --------------------
 * Effect decodes with `errors: 'first'`, so a config with three typos yields one
 * issue, not three, and this module can only report what the decoder found. An
 * author with several mistakes fixes them one run at a time. That is a real
 * limitation, not a design choice — reporting all of them would mean decoding
 * with `errors: 'all'`, which changes the traversal for every other failure mode
 * too and is a separate decision.
 */

import { SchemaAST } from 'effect'
import type { ParseIssue } from 'effect/ParseResult'

// =============================================================================
// Types
// =============================================================================

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
}

interface RawFinding {
  readonly key: string
  readonly segments: readonly (string | number)[]
  readonly accepted: readonly string[]
  readonly discriminant: string | undefined
}

/**
 * A branch of the issue tree, scored by how much of what the author wrote it
 * recognises. Used to pick between union members (see `pickBestBranch`).
 */
interface Candidate {
  readonly findings: readonly RawFinding[]
  readonly score: number
}

// =============================================================================
// Constants
// =============================================================================

const EMPTY_CANDIDATE: Candidate = { findings: [], score: 0 }

/**
 * Weight of a matching discriminant literal when choosing a union branch.
 *
 * Deliberately far above any achievable key-overlap count: when a branch's
 * `type: "text"` literal equals the `type` the author wrote, that branch IS the
 * one they meant, and no amount of accidental key overlap on a sibling should
 * outvote it.
 */
const DISCRIMINANT_WEIGHT = 1000

// =============================================================================
// Pure helpers
// =============================================================================

const toArray = <A>(value: A | ReadonlyArray<A>): readonly A[] =>
  Array.isArray(value) ? (value as readonly A[]) : [value as A]

/**
 * Strip refinements and transformations toward the ENCODED side — the shape the
 * author actually writes in the config file.
 *
 * Load-bearing, and for the same reason it is load-bearing in
 * `[internal ref]`: some union branches (the `code`
 * component among them) are a `Transformation` wrapping their `TypeLiteral`, so
 * a walk that does not unwrap sees no property signatures at all and silently
 * reports nothing for those nodes.
 */
const unwrapAst = (ast: SchemaAST.AST): SchemaAST.AST =>
  SchemaAST.isRefinement(ast) || SchemaAST.isTransformation(ast) ? unwrapAst(ast.from) : ast

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
 * Levenshtein edit distance. Pure, and written as a fold rather than a loop to
 * satisfy the functional-programming lint rules that govern `src/`.
 */
export const editDistance = (a: string, b: string): number => {
  const firstRow = Array.from({ length: b.length + 1 }, (_, index) => index)
  const lastRow = [...a].reduce<readonly number[]>(
    (previous, aChar, i) =>
      [...b].reduce<readonly number[]>(
        (row, bChar, j) => [
          ...row,
          Math.min(
            (row[j] ?? 0) + 1,
            (previous[j + 1] ?? 0) + 1,
            (previous[j] ?? 0) + (aChar === bChar ? 0 : 1)
          ),
        ],
        [i + 1]
      ),
    firstRow
  )
  return lastRow[b.length] ?? 0
}

/**
 * How far a candidate may sit from what was written and still be offered.
 *
 * Scales with length so a three-character key cannot be "corrected" to an
 * unrelated four-character one: `tag` tolerates a distance of 1 and its nearest
 * accepted neighbour on a `text` component is 3 away, so it correctly gets no
 * suggestion.
 */
const maxDistanceFor = (key: string): number => (key.length <= 4 ? 1 : key.length <= 8 ? 2 : 3)

/** The nearest accepted key within tolerance, or `undefined`. Pure. */
export const suggestKey = (key: string, accepted: readonly string[]): string | undefined => {
  const tolerance = maxDistanceFor(key)
  const best = accepted.reduce<{ readonly name: string; readonly distance: number } | undefined>(
    (winner, name) => {
      const distance = editDistance(key.toLowerCase(), name.toLowerCase())
      return winner === undefined || distance < winner.distance ? { name, distance } : winner
    },
    undefined
  )
  return best !== undefined && best.distance <= tolerance ? best.name : undefined
}

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

/**
 * The literal a discriminated struct pins, preferring a property literally named
 * `type` before falling back to the first single-literal property.
 */
const findDiscriminant = (
  ast: SchemaAST.TypeLiteral
): { readonly name: string; readonly literal: string } | undefined => {
  const literals = ast.propertySignatures.flatMap((property) => {
    const propertyType = unwrapAst(property.type)
    return SchemaAST.isLiteral(propertyType) && typeof propertyType.literal === 'string'
      ? [{ name: String(property.name), literal: propertyType.literal }]
      : []
  })
  return literals.find((entry) => entry.name === 'type') ?? literals[0]
}

// =============================================================================
// Issue-tree walk
// =============================================================================

const mergeCandidates = (candidates: readonly Candidate[]): Candidate => ({
  findings: candidates.flatMap((candidate) => candidate.findings),
  score: candidates.reduce((total, candidate) => total + candidate.score, 0),
})

/**
 * Choose one member of a union.
 *
 * Ranked purely by score — the branch that recognises the most of what the
 * author wrote — never by "which branch produced an error we can print". A
 * branch is only reported if it is also the branch the author most plausibly
 * meant, so the reporter can be silent (and defer to `TreeFormatter`) rather
 * than confidently attribute a mistake to the wrong shape.
 */
const pickBestBranch = (candidates: readonly Candidate[]): Candidate =>
  candidates.reduce(
    (best, candidate) => (candidate.score > best.score ? candidate : best),
    candidates[0] ?? EMPTY_CANDIDATE
  )

const walkTypeLiteral = (
  ast: SchemaAST.TypeLiteral,
  actual: unknown,
  children: readonly ParseIssue[],
  segments: readonly (string | number)[]
): Candidate => {
  const accepted = ast.propertySignatures.map((property) => String(property.name))
  const acceptedSet = new Set(accepted)
  const discriminant = findDiscriminant(ast)

  const record =
    typeof actual === 'object' && actual !== null && !Array.isArray(actual)
      ? (actual as Record<string, unknown>)
      : undefined
  const writtenKeys = record === undefined ? [] : Object.keys(record)
  const overlap = writtenKeys.filter((key) => acceptedSet.has(key)).length
  const discriminantMatches =
    discriminant !== undefined && record?.[discriminant.name] === discriminant.literal

  const direct = children.flatMap((child): readonly RawFinding[] =>
    child._tag === 'Pointer' && child.issue._tag === 'Unexpected'
      ? toArray(child.path).map((key) => ({
          key: String(key),
          segments,
          accepted,
          discriminant: discriminant?.literal,
        }))
      : []
  )

  const nested = children
    .filter((child) => !(child._tag === 'Pointer' && child.issue._tag === 'Unexpected'))
    .map((child) => walkIssue(child, segments))

  const nestedMerged = mergeCandidates(nested)
  return {
    findings: [...direct, ...nestedMerged.findings],
    score: overlap + (discriminantMatches ? DISCRIMINANT_WEIGHT : 0) + nestedMerged.score,
  }
}

/**
 * A `Pointer` path key as a path segment.
 *
 * Array indices arrive as numbers from tuple traversal but as digit strings from
 * some record traversals; normalising both to numbers is what lets `formatPath`
 * render `components[0]` rather than `components.0`.
 */
const toSegment = (key: PropertyKey): string | number => {
  if (typeof key === 'number') return key
  const name = String(key)
  return /^\d+$/.test(name) ? Number(name) : name
}

/**
 * Credit a branch for pinning the discriminant the author actually wrote.
 *
 * Normally `walkTypeLiteral` awards this, because that is where both the AST and
 * the written object are in hand. A branch whose own failure is a REFINEMENT
 * never gets there: `Schema.filter` wraps the struct, so the issue tree is
 * `Refinement → Type` and the walk bottoms out at a leaf with no findings and a
 * score of zero.
 *
 * That zero is what made the reporter lie. An integer field written
 * `{ type: 'integer', min: 100, max: 10 }` fails only its own `min <= max`
 * filter — a Refinement, score 0 — while a sibling branch that does not even
 * match `type` scores 3 for recognising `id`, `name` and `type`, wins the
 * union, and reports `Unknown property 'min'`. The property is real, the
 * diagnosis is invented, and it sends the author to delete a valid key.
 *
 * So the credit is applied here too, and only when the inner walk did not
 * already award it — a matching discriminant is decisive whether the branch
 * failed on a property or on a rule.
 */
const refinementDiscriminantCredit = (
  ast: SchemaAST.AST,
  actual: unknown,
  innerScore: number
): number => {
  if (innerScore >= DISCRIMINANT_WEIGHT) return 0
  const unwrapped = unwrapAst(ast)
  if (!SchemaAST.isTypeLiteral(unwrapped)) return 0
  const discriminant = findDiscriminant(unwrapped)
  if (discriminant === undefined) return 0
  const record =
    typeof actual === 'object' && actual !== null && !Array.isArray(actual)
      ? (actual as Record<string, unknown>)
      : undefined
  return record?.[discriminant.name] === discriminant.literal ? DISCRIMINANT_WEIGHT : 0
}

const walkIssue = (issue: ParseIssue, segments: readonly (string | number)[]): Candidate => {
  switch (issue._tag) {
    case 'Pointer':
      return walkIssue(issue.issue, [...segments, ...toArray(issue.path).map(toSegment)])
    case 'Refinement':
    case 'Transformation': {
      const inner = walkIssue(issue.issue, segments)
      const credit = refinementDiscriminantCredit(issue.ast, issue.actual, inner.score)
      return credit === 0 ? inner : { findings: inner.findings, score: inner.score + credit }
    }
    case 'Composite':
      return walkComposite(issue, segments)
    // A leaf. `Unexpected` is consumed by its parent `TypeLiteral` (which is the
    // only place the accepted-key list lives); the rest are failures this module
    // has nothing to add to, so it stays silent and the caller falls back to the
    // decoder's own formatter.
    case 'Type':
    case 'Missing':
    case 'Unexpected':
    case 'Forbidden':
      return EMPTY_CANDIDATE
  }
}

/**
 * A struct, a union, or a tuple.
 *
 * The three are handled differently on purpose: a struct is where accepted keys
 * live, a union must CHOOSE one branch (reporting all of them would blame the
 * author for shapes they never reached for — that is the 67-line blob), and
 * anything else simply merges its children.
 */
const walkComposite = (
  issue: Extract<ParseIssue, { readonly _tag: 'Composite' }>,
  segments: readonly (string | number)[]
): Candidate => {
  const children = toArray(issue.issues)
  const ast = unwrapAst(issue.ast)
  if (SchemaAST.isTypeLiteral(ast)) {
    return walkTypeLiteral(ast, issue.actual, children, segments)
  }
  const branches = children.map((child) => walkIssue(child, segments))
  return SchemaAST.isUnion(ast) ? pickBestBranch(branches) : mergeCandidates(branches)
}

// =============================================================================
// Public API
// =============================================================================

/** Dedupe key: one report line per (path, property) pair. */
const findingIdentity = (finding: RawFinding): string =>
  `${formatPath(finding.segments)}::${finding.key}`

/**
 * Every unrecognised property the decoder rejected, located and explained.
 *
 * Returns an empty array when the decode failed for some other reason (a missing
 * required field, a bad value); the caller is expected to fall back to
 * `TreeFormatter` so no failure is ever swallowed. Pure.
 */
export const collectExcessPropertyFindings = (
  issue: ParseIssue
): readonly ExcessPropertyFinding[] => {
  const { findings } = walkIssue(issue, [])

  return findings
    .filter(
      (finding, index, all) =>
        all.findIndex((other) => findingIdentity(other) === findingIdentity(finding)) === index
    )
    .map((finding) => {
      const kind = nodeKindFromSegments(finding.segments)
      return {
        key: finding.key,
        path: formatPath(finding.segments),
        nodeLabel:
          kind !== undefined && finding.discriminant !== undefined
            ? `${kind} type '${finding.discriminant}'`
            : undefined,
        accepted: finding.accepted,
        suggestion: suggestKey(finding.key, finding.accepted),
      }
    })
}

/**
 * The `$ref` partial a node came from, when it came from one.
 *
 * `collectRefSources` keys top-level `$ref`s by property name (`tables`) and
 * array-element `$ref`s as `key[index]` (`pages[0]`), so the deepest key that
 * prefixes the finding's path is the file the author has to open. Pure.
 */
export const attributeSourceFile = (
  path: string,
  refSources: ReadonlyMap<string, string>
): string | undefined =>
  [...refSources.entries()]
    .filter(([key]) => path === key || path.startsWith(`${key}.`) || path.startsWith(`${key}[`))
    .toSorted(([a], [b]) => b.length - a.length)
    .map(([, file]) => file.split('/').at(-1))
    .find((name): name is string => name !== undefined)

/**
 * Render findings as the indented lines that sit under `Validation failed:`.
 *
 * Returns an empty array when there is nothing to report, which is the caller's
 * signal to fall back to the decoder's own formatter. Pure.
 */
export const formatExcessPropertyReport = (
  findings: readonly ExcessPropertyFinding[],
  refSources: ReadonlyMap<string, string>
): readonly string[] =>
  findings.flatMap((finding) => {
    const sourceFile = attributeSourceFile(finding.path, refSources)
    return [
      `  Unknown property '${finding.key}'${finding.nodeLabel ? ` on ${finding.nodeLabel}` : ''}`,
      `    at ${finding.path}${sourceFile ? `  (${sourceFile})` : ''}`,
      ...(finding.suggestion ? [`    Did you mean '${finding.suggestion}'?`] : []),
      `    Accepted here: ${finding.accepted.join(', ')}`,
    ]
  })

/**
 * The whole pipeline: issue tree in, report lines out, empty when this module
 * has nothing better to say than the decoder does. Pure.
 */
export const buildExcessPropertyReport = (
  issue: ParseIssue,
  refSources: ReadonlyMap<string, string>
): readonly string[] => formatExcessPropertyReport(collectExcessPropertyFindings(issue), refSources)
