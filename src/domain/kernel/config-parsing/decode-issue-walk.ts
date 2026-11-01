/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Turn an Effect `SchemaIssue.Issue` into a report an author can act on.
 *
 * TWO KINDS OF FINDING, ONE WALK
 * ------------------------------
 * The module reports an unrecognised PROPERTY (`Unknown property 'tag'`) and a
 * rejected UNION VALUE (`Expected RowClickAction ... Accepted variants: ...`).
 * They are collected by the same traversal on purpose: both depend on the same
 * hard part, which is choosing WHICH branch of a union to blame. Splitting them
 * into two modules would mean two copies of that choice, free to disagree.
 *
 * (The file is still named for the first kind alone. Renaming it is a pure
 * refactor with one importer and belongs to a separate pass — this branch has
 * already lost a day to a rename that blinded a walker.)
 *
 * `sovrium validate` has always decoded with `onExcessProperty: 'error'`, so an
 * unrecognised property has always been rejected. What it could not do was
 * SAY SO usably. Measured on this binary, a config whose only mistake is `tag`
 * on a `text` component (the property is spelled `element`) produced 67 lines of
 * `TreeFormatter` output, 19 of them `From side refinement failure`, the name of
 * the offending property on line 52 and its path nowhere.
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
 * EVERY MISTAKE IN ONE RUN
 * ------------------------
 * The pipeline decodes with `errors: 'all'`, so a config with three independent
 * mistakes hands this module three failures, not one. Most of the issue tree is
 * then RESIDUE: every union member the decoder tried and abandoned reports its
 * own complaints (`Unexpected key` for each property of every component branch,
 * "Type must be an unknown field type" from the catch-all field branch). The
 * branch choice below is what keeps that residue out of the report: at every
 * union, only the member the author most plausibly meant is walked into the
 * report, so one mistake yields one problem however many members were tried.
 * `collectDecodeProblems` is the all-errors entry point; `collectDecodeFindings`
 * keeps its narrower, explained-only contract for the callers that use it.
 *
 * IT READS `reportInput`, BUT THAT IS NOT CURRENTLY LOAD-BEARING
 * -------------------------------------------------------------
 * Effect 4 moved the rejected value from `Composite.actual` (always present in
 * v3) onto `Base.input`, which the parser attaches ONLY when the decode passed
 * `reportInput: true`. `decodeAppConfigObject` passes it, and the branch scoring
 * below reads it.
 *
 * The tempting conclusion — "turn the option off and this blames the wrong union
 * branch" — was measured and is FALSE today: across five fixtures the reported
 * attribution is identical either way, because v4's union parser prunes branches
 * whose discriminant literal does not match before this module is ever handed
 * the tree, usually leaving one branch to choose between. The scoring is
 * therefore a safety net rather than the deciding mechanism it was under v3.
 * `excess-property-report.test.ts` pins that as an equality, so if upstream ever
 * stops pruning, the dependency resurfaces as a test failure rather than as a
 * wrong diagnosis in a user's terminal.
 */

import { SchemaAST } from 'effect'
import {
  inputOf,
  leafCandidate,
  mergeCandidates,
  toArray,
  type Candidate,
  type RawFinding,
} from './decode-findings'
import { walkAnyOf } from './decode-union-choice'
import { isPropertyNamesCheck } from './decoder-notation'
import { discriminantOf, encodedSide } from './schema-ast'
import type { SchemaIssue } from 'effect'

/**
 * Weight of a matching discriminant literal when choosing a union branch.
 *
 * Deliberately far above any achievable key-overlap count: when a branch's
 * `type: "text"` literal equals the `type` the author wrote, that branch IS the
 * one they meant, and no amount of accidental key overlap on a sibling should
 * outvote it.
 */
const DISCRIMINANT_WEIGHT = 1000

const walkTypeLiteral = (
  ast: SchemaAST.Objects,
  actual: unknown,
  children: readonly SchemaIssue.Issue[],
  segments: readonly (string | number)[]
): Candidate => {
  const accepted = ast.propertySignatures.map((property) => String(property.name))
  const acceptedSet = new Set(accepted)
  const discriminant = discriminantOf(ast)

  const record =
    typeof actual === 'object' && actual !== null && !Array.isArray(actual)
      ? (actual as Record<string, unknown>)
      : undefined
  const writtenKeys = record === undefined ? [] : Object.keys(record)
  const overlap = writtenKeys.filter((key) => acceptedSet.has(key)).length
  const discriminantMatches =
    discriminant !== undefined && record?.[discriminant.name] === discriminant.literal

  // EFFECT 4: `Unexpected` is `UnexpectedKey`. The wrapping is unchanged — the
  // parser still emits `Composite(ast, [Pointer([key], UnexpectedKey(...))])`,
  // so the key still arrives on the Pointer, not on the leaf.
  const isUnexpected = (child: SchemaIssue.Issue): boolean =>
    child._tag === 'Pointer' && child.issue._tag === 'UnexpectedKey'

  const direct = children.flatMap((child): readonly RawFinding[] =>
    isUnexpected(child) && child._tag === 'Pointer'
      ? toArray(child.path).map((key) => ({
          kind: 'excess-property' as const,
          key: String(key),
          segments,
          accepted,
          discriminant: discriminant?.literal,
        }))
      : []
  )

  const nested = children
    .filter((child) => !isUnexpected(child))
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
 * EFFECT 4 issue-tree model, derived from what the parser emits (probed in
 * `[internal ref]`), not from the rename table:
 *
 * | v3            | v4              | note                                      |
 * | ------------- | --------------- | ----------------------------------------- |
 * | `Refinement`  | `Filter`        | carries `filter`, and NO `ast`            |
 * | `Transformation` | `Encoding`   | carries `ast`                             |
 * | `Unexpected`  | `UnexpectedKey` | still wrapped in a `Pointer`              |
 * | `Missing`     | `MissingKey`    | leaf                                      |
 * | `Type`        | `InvalidType`   | leaf; `InvalidValue` is new alongside it  |
 * | `Composite` (union) | `AnyOf`   | unions got their OWN node                 |
 *
 * `AnyOf` is the consequential one: in v3 a union failure arrived as a
 * `Composite` whose `ast` happened to be a `Union`, so branch selection hung off
 * an AST test. v4 gives it a dedicated tag, so selection is now driven by the
 * ISSUE shape and cannot be silently lost if the AST reduction changes.
 */

/** The walk of one issue kind, typed to that kind. */
type IssueHandlers = {
  readonly [Tag in SchemaIssue.Issue['_tag']]: (
    issue: Extract<SchemaIssue.Issue, { readonly _tag: Tag }>,
    segments: readonly (string | number)[]
  ) => Candidate
}

/** A leaf: carried in the decoder's own words, see {@link ISSUE_HANDLERS}. */
const leaf = (issue: SchemaIssue.Issue, segments: readonly (string | number)[]): Candidate =>
  leafCandidate(issue, segments)

/**
 * A TOTAL dispatch over v4's issue-tag union, as a table typed by that union: a
 * NEW v4 issue tag is a missing key here — a compile error — rather than a
 * silently unreported config problem.
 */
const ISSUE_HANDLERS: IssueHandlers = {
  Pointer: (issue, segments) =>
    walkIssue(issue.issue, [...segments, ...toArray(issue.path).map(toSegment)]),

  // A failed check (`Schema.check`) or a failed transformation. Both wrap a
  // single inner issue and add nothing this module can report on.
  //
  // v3 needed an extra "discriminant credit" hack here: `Schema.filter` wrapped
  // the struct NODE, so a branch failing only its own rule produced
  // `Refinement -> Type` and never reached `walkTypeLiteral`, scoring zero —
  // which let a non-matching sibling win the union and invent an `Unknown
  // property 'min'` for a perfectly valid key. v4 reports a check failure as a
  // CHILD of the struct's own `Composite` (verified: probe case C), so the
  // struct is walked either way and the credit is awarded naturally. The hack
  // is deleted rather than ported; the test that caught the original lie
  // ('stays silent when the matching branch failed a rule') still guards it.
  Filter: (issue, segments) => walkFilter(issue, segments),

  Encoding: (issue, segments) => walkIssue(issue.issue, segments),

  Composite: (issue, segments) => walkComposite(issue, segments),

  // A union. Choosing matters: reporting every branch would blame the author
  // for shapes they never reached for — that is the 67-line blob this module
  // replaced, and it is still what v4's own formatter does. Measured: an
  // unsupported `onRowClick` printed FOUR identical `Unexpected key with value
  // "data-table"` lines, one per `Component Reference` branch, each of them
  // false — `type: "data-table"` is correct, those branches simply do not
  // declare `type`. Picking the branch the discriminant names deletes all four
  // as a consequence of choosing, not as a post-hoc filter on the text.
  AnyOf: (issue, segments) => walkAnyOf(issue, segments, walkIssue),

  // Leaves. `UnexpectedKey` is normally consumed by its parent struct (the
  // only place the accepted-key list lives); the rest are failures this module
  // has nothing to add to. Each is carried as a decoder leaf, rendered in the
  // decoder's own words — and only if the member it lives in is the one the
  // branch choice keeps, which is what drops the residue.
  InvalidType: leaf,
  InvalidValue: leaf,
  MissingKey: leaf,
  UnexpectedKey: leaf,
  Forbidden: leaf,
  OneOf: leaf,
}

function walkIssue(issue: SchemaIssue.Issue, segments: readonly (string | number)[]): Candidate {
  const handler = ISSUE_HANDLERS[issue._tag] as (
    issue: SchemaIssue.Issue,
    segments: readonly (string | number)[]
  ) => Candidate
  return handler(issue, segments)
}

/**
 * A failed check.
 *
 * A rule that failed with its own message becomes a candidate finding, held
 * UNCONFIRMED: only a decisive union choice above it may publish it (see
 * `CheckFailureFinding`). It earns no score — it says nothing about which shape
 * the author meant — so branch selection is exactly what it was before. Any
 * other inner issue is walked as before.
 */
const walkFilter = (
  issue: Extract<SchemaIssue.Issue, { readonly _tag: 'Filter' }>,
  segments: readonly (string | number)[]
): Candidate => {
  const inner = issue.issue
  if (isPropertyNamesCheck(issue.filter.annotations))
    return markPropertyKeys(walkIssue(inner, segments))
  const message = inner._tag === 'InvalidValue' ? inner.annotations?.message : undefined
  if (typeof message === 'string' && message.length > 0) {
    return {
      findings: [{ kind: 'check-failure', segments, message, issue, confirmed: undefined }],
      score: 0,
    }
  }
  // A message-less rule is rendered by the decoder from the CHECK (its
  // `expected` annotation), not from the inner leaf, so the check is the leaf.
  return inner._tag === 'InvalidValue' ? leafCandidate(issue, segments) : walkIssue(inner, segments)
}

/** Every rule failure below a property-names check marked as a refused KEY, quoted by the report. */
const markPropertyKeys = (candidate: Candidate): Candidate => ({
  ...candidate,
  findings: candidate.findings.map((finding) =>
    finding.kind === 'check-failure' || finding.kind === 'decoder-leaf'
      ? { ...finding, propertyKey: true as const }
      : finding
  ),
})

/**
 * A struct, or anything else composite (arrays, tuples).
 *
 * A struct is where accepted keys live; anything else merges its children.
 * Unions no longer arrive here — they have their own `AnyOf` node in v4.
 */
const walkComposite = (
  issue: Extract<SchemaIssue.Issue, { readonly _tag: 'Composite' }>,
  segments: readonly (string | number)[]
): Candidate => {
  const children = toArray(issue.issues)
  const ast = encodedSide(issue.ast)
  if (SchemaAST.isObjects(ast)) {
    return walkTypeLiteral(ast, inputOf(issue), children, segments)
  }
  return mergeCandidates(children.map((child) => walkIssue(child, segments)))
}

/**
 * Every raw finding in a decode failure, after the branch choice at each union.
 * Unsettled: deduplication, publication and wording belong to `decode-problems.ts`. Pure.
 */
export const walkDecodeIssue = (issue: SchemaIssue.Issue): readonly RawFinding[] =>
  walkIssue(issue, []).findings
