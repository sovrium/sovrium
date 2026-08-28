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
import type { SchemaIssue } from 'effect'

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

/**
 * A union-typed property whose value matched none of the accepted shapes.
 *
 * WHY THIS EXISTS. Effect 3 rendered a rejected union by enumerating its
 * members' `title` annotations, so an author who wrote an unsupported
 * `onRowClick` was told "Navigate Action, Open Drawer Action" — the two things
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
}

/** Anything this module can say about a decode failure. @public */
export type DecodeFinding =
  | (ExcessPropertyFinding & { readonly kind: 'excess-property' })
  | UnionMismatchFinding
  | UnknownDiscriminantFinding

interface RawExcessFinding {
  readonly kind: 'excess-property'
  readonly key: string
  readonly segments: readonly (string | number)[]
  readonly accepted: readonly string[]
  readonly discriminant: string | undefined
}

interface RawMismatchFinding {
  readonly kind: 'union-mismatch'
  readonly segments: readonly (string | number)[]
  readonly expected: string | undefined
  readonly variants: readonly string[]
  readonly input: unknown
}

interface RawDiscriminantFinding {
  readonly kind: 'unknown-discriminant'
  readonly segments: readonly (string | number)[]
  readonly discriminant: string
  readonly accepted: readonly string[]
  readonly input: unknown
}

type RawFinding = RawExcessFinding | RawMismatchFinding | RawDiscriminantFinding

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

/**
 * Weight of merely RECOGNISING the discriminant property, when no member's
 * literal matches its value.
 *
 * The case is a nested union: `pages[0].components[0]` is
 * `PageComponent | Component Reference`, and `PageComponent` is itself the
 * 89-member discriminated union. An author who writes `type: "badcomp"` matches
 * no member of either, so both siblings fail and branch selection decides which
 * failure the author reads.
 *
 * Without this, the discriminated branch scores 0 — every one of its members was
 * pruned before running, so no `walkTypeLiteral` ever ran to earn key overlap —
 * while `Component Reference` scores its key overlap and wins, reporting
 * `Unknown property 'type'` at `pages[0].components[0]`. That advice is false in
 * the way that matters: `type` is legal on all 89 real components, and deleting
 * it is not the fix.
 *
 * MEASURED, because the obvious claim is too strong. The weight only decides
 * when the sibling scores ABOVE zero, i.e. when the author's value overlaps
 * `Component Reference`'s keys (`$ref`, `vars`, `component`). A bare
 * `{ type: 'badcomp', content: 'hello' }` overlaps none of them, both branches
 * tie at 0, and `pickBestBranch` keeps the first — which is already the right
 * one. So this is what makes the choice DELIBERATE rather than an artefact of
 * declaration order: `{ type: 'badcomp', vars: {...} }` flips to the false
 * `Unknown property 'type'` the moment the weight is removed, and
 * [internal ref] pins exactly that config for exactly that reason.
 *
 * Writing `type` at all is strong evidence the author reached for the family
 * that HAS a `type`. So it outranks any achievable key overlap, and sits an
 * order of magnitude below `DISCRIMINANT_WEIGHT` because an exact literal match
 * is strictly better evidence than the property name alone.
 */
const DISCRIMINANT_NAME_WEIGHT = 100

/**
 * How much of a rejected value to echo back.
 *
 * The value is the operator's own config, so there is no disclosure concern
 * (see `reportInput` in `decode-app-config.ts`) — the cap exists only so a
 * mistyped 400-line page object does not bury its own error message.
 */
const MAX_RENDERED_INPUT = 120

// =============================================================================
// Pure helpers
// =============================================================================

const toArray = <A>(value: A | ReadonlyArray<A>): readonly A[] =>
  Array.isArray(value) ? (value as readonly A[]) : [value as A]

/**
 * Reduce a node to the ENCODED side — the shape the author actually writes in
 * the config file.
 *
 * Load-bearing, and for the same reason it is load-bearing in
 * `[internal ref]`: a union branch may be a struct
 * wrapped in a transformation, so a walk that does not reduce sees no property
 * signatures at all and silently reports nothing for those nodes.
 *
 * EFFECT 4: this is a model change, not a rename. v3 wrapped a struct in
 * `Refinement`/`Transformation` NODES and this walked `.from` to get underneath
 * them. v4 removed both node kinds: checks now live on `Base.checks` and
 * transformations on `Base.encoding` OF the struct node itself, so there is
 * nothing to walk past — `Objects` is already what `isObjects` sees. What
 * remains is reducing the `encoding` chain to its encoded end, which is exactly
 * `SchemaAST.toEncoded`. Using the published helper rather than hand-walking
 * `encoding[last].to` keeps the chain-direction question upstream's problem.
 *
 * Measured on this branch: all 89 branches of the real component union are plain
 * `Objects` with neither `checks` nor `encoding`, so this is presently a no-op
 * there. It is kept because absence across the whole of `AppSchema` was not
 * proven, and because a future transformation-wrapped branch would otherwise
 * regress to reporting nothing — the exact silent failure this module exists to
 * prevent.
 */
const unwrapAst = (ast: SchemaAST.AST): SchemaAST.AST => SchemaAST.toEncoded(ast)

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

/** One string-valued annotation off any AST node, or `undefined`. Pure. */
const annotationString = (ast: SchemaAST.AST, name: 'title' | 'identifier'): string | undefined => {
  const value = (ast.annotations as Record<string, unknown> | undefined)?.[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Every member's human title — but ONLY when the schema names ALL of them.
 *
 * The all-or-nothing gate is the safety property. A partial list reads as an
 * exhaustive one, so an author told "write `navigate` or `openDrawer`" when a
 * third untitled variant exists is sent to a wrong conclusion with confidence.
 * Staying silent hands the failure back to the decoder's own formatter, which
 * is merely terse — the same "invent nothing" discipline `suggestKey` follows.
 *
 * Measured on the real `AppSchema`: the 89-branch component union carries no
 * titles at all and is therefore correctly skipped, while `RowClickAction`'s two
 * members are both titled and are reported. Members are read AS DECLARED, not
 * through `unwrapAst`, because a title is put on the node the author's schema
 * names; a `Suspend` or transformation wrapper without one fails the gate and
 * that is the intended outcome.
 */
const unionMemberTitles = (ast: SchemaAST.Union): readonly string[] | undefined => {
  const titles = ast.types.map((member) => annotationString(member, 'title'))
  return titles.every((title): title is string => title !== undefined) ? titles : undefined
}

/**
 * The discriminant every member agrees on, and the literal each one pins — but
 * ONLY when the union is discriminated ALL the way through.
 *
 * Returns `undefined` unless every member is a struct, every member pins a
 * string literal, and they all pin it under the SAME property name. Three
 * things follow from that, all of them the point:
 *
 *  - **The list is exhaustive or it is not offered.** A partial list of `type`
 *    values reads as the complete set, so an author told "write `text` or
 *    `image`" while a third legal value exists is sent AWAY from a working
 *    config with confidence. That is strictly worse than the terse fallback,
 *    and it is the same reasoning that makes `unionMemberTitles`
 *    all-or-nothing and `suggestKey` refuse to invent.
 *  - **A `Suspend` or otherwise unreducible member fails the gate**, because
 *    `toEncoded` cannot show its properties and a member whose literals cannot
 *    be read cannot be proven absent from the list.
 *  - **Disagreeing names fail the gate.** A union half-discriminated on `type`
 *    and half on `variant` has no single "accepted values" list to print, and
 *    picking one name would silently drop the other half's members.
 *
 * Measured on the real `AppSchema`: the component union's 89 members all pin
 * `type`, carry no titles, and are therefore reported here rather than by
 * `unionMemberTitles`.
 */
const unionDiscriminantValues = (
  ast: SchemaAST.Union
): { readonly name: string; readonly values: readonly string[] } | undefined => {
  const found = ast.types.map((member) => {
    const encoded = unwrapAst(member)
    return SchemaAST.isObjects(encoded) ? findDiscriminant(encoded) : undefined
  })

  const first = found[0]
  if (first === undefined || found.length === 0) return undefined
  if (!found.every((entry) => entry !== undefined && entry.name === first.name)) return undefined

  return {
    name: first.name,
    values: found.map((entry) => (entry as { readonly literal: string }).literal),
  }
}

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
 * The literal a discriminated struct pins, preferring a property literally named
 * `type` before falling back to the first single-literal property.
 */
const findDiscriminant = (
  ast: SchemaAST.Objects
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
  ast: SchemaAST.Objects,
  actual: unknown,
  children: readonly SchemaIssue.Issue[],
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
 * The rejected value, when the decode was configured to report it.
 *
 * EFFECT 4: v3's `Composite.actual` is now `Base.input`, present on EVERY issue
 * node but populated only under `reportInput: true`. Reading it through one
 * accessor keeps that dependency in a single place — see the module header for
 * why it matters and which test guards it.
 */
const inputOf = (issue: SchemaIssue.Issue): unknown => (issue as { readonly input?: unknown }).input

/**
 * EFFECT 4 issue-tree model, derived from what the parser emits (probed in
 * `scripts/migration/effect4/probe-issue-tree.ts`), not from the rename table:
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

// A TOTAL dispatch over v4's issue-tag union. The branch count IS the union's
// arity; splitting it into helpers would buy a lower number and lose the
// exhaustiveness check that makes a NEW v4 issue tag a compile error here rather
// than a silently unreported config problem.
// eslint-disable-next-line complexity -- see above
const walkIssue = (issue: SchemaIssue.Issue, segments: readonly (string | number)[]): Candidate => {
  switch (issue._tag) {
    case 'Pointer':
      return walkIssue(issue.issue, [...segments, ...toArray(issue.path).map(toSegment)])

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
    case 'Filter':
    case 'Encoding':
      return walkIssue(issue.issue, segments)

    case 'Composite':
      return walkComposite(issue, segments)

    // A union. Choosing matters: reporting every branch would blame the author
    // for shapes they never reached for — that is the 67-line blob this module
    // replaced, and it is still what v4's own formatter does. Measured: an
    // unsupported `onRowClick` printed FOUR identical `Unexpected key with value
    // "data-table"` lines, one per `Component Reference` branch, each of them
    // false — `type: "data-table"` is correct, those branches simply do not
    // declare `type`. Picking the branch the discriminant names deletes all four
    // as a consequence of choosing, not as a post-hoc filter on the text.
    case 'AnyOf':
      return walkAnyOf(issue, segments)

    // Leaves. `UnexpectedKey` is consumed by its parent struct (the only place
    // the accepted-key list lives); the rest are failures this module has nothing
    // to add to, so it stays silent and the caller falls back to the decoder's
    // own formatter.
    case 'InvalidType':
    case 'InvalidValue':
    case 'MissingKey':
    case 'UnexpectedKey':
    case 'Forbidden':
    case 'OneOf':
      return EMPTY_CANDIDATE
  }
}

/**
 * A union.
 *
 * When the parser entered at least one branch, that branch's own failure is
 * more specific than "your value fits none of these shapes", so the walk simply
 * descends and this adds nothing. The interesting case is `issues.length === 0`:
 * v4's candidate index pruned EVERY branch before running any of them, which
 * happens exactly when the value's discriminant matches no member — the author
 * wrote a shape that does not exist. There is no branch-level error to report
 * because no branch was tried, and that is the case v3 answered by naming the
 * members and v4's formatter answers with an internal type name.
 *
 * Deliberately narrow. Emitting whenever the chosen branch merely produced
 * nothing would replace the decoder's specific complaint (a missing field, a bad
 * value) with a vaguer shape list across every union in `AppSchema`. This only
 * speaks where the decoder provably has nothing more specific to say.
 */
const walkAnyOf = (
  issue: Extract<SchemaIssue.Issue, { readonly _tag: 'AnyOf' }>,
  segments: readonly (string | number)[]
): Candidate => {
  const best = pickBestBranch(issue.issues.map((child) => walkIssue(child, segments)))
  if (issue.issues.length > 0) return best

  const input = inputOf(issue)

  const variants = unionMemberTitles(issue.ast)
  if (variants !== undefined) {
    return {
      findings: [
        {
          kind: 'union-mismatch',
          segments,
          expected:
            annotationString(issue.ast, 'identifier') ?? annotationString(issue.ast, 'title'),
          variants,
          input,
        },
      ],
      score: best.score,
    }
  }

  // Untitled but discriminated: name the legal VALUES instead of the shapes.
  const discriminant = unionDiscriminantValues(issue.ast)
  if (discriminant === undefined) return best

  // Credit only for what the author demonstrably wrote. A value that carries no
  // `type` at all is not evidence they meant this family, so it earns nothing
  // and a sibling branch may still legitimately win.
  const wroteDiscriminant =
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    discriminant.name in (input as Record<string, unknown>)

  return {
    findings: [
      {
        kind: 'unknown-discriminant',
        segments,
        discriminant: discriminant.name,
        accepted: discriminant.values,
        input,
      },
    ],
    score: best.score + (wroteDiscriminant ? DISCRIMINANT_NAME_WEIGHT : 0),
  }
}

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
  const ast = unwrapAst(issue.ast)
  if (SchemaAST.isObjects(ast)) {
    return walkTypeLiteral(ast, inputOf(issue), children, segments)
  }
  return mergeCandidates(children.map((child) => walkIssue(child, segments)))
}

// =============================================================================
// Public API
// =============================================================================

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
  }
}

/** The illegal discriminant value the author wrote, when it was reported. Pure. */
const writtenDiscriminant = (input: unknown, name: string): string | undefined => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined
  const value = (input as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : undefined
}

const toDecodeFinding = (finding: RawFinding): DecodeFinding => {
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
    }
  }
  if (finding.kind === 'union-mismatch') {
    return {
      kind: 'union-mismatch',
      path: formatPath(finding.segments),
      expected: finding.expected,
      variants: finding.variants,
      got: renderInput(finding.input),
    }
  }
  const kind = nodeKindFromSegments(finding.segments)
  return {
    kind: 'excess-property',
    key: finding.key,
    path: formatPath(finding.segments),
    nodeLabel:
      kind !== undefined && finding.discriminant !== undefined
        ? `${kind} type '${finding.discriminant}'`
        : undefined,
    accepted: finding.accepted,
    suggestion: suggestKey(finding.key, finding.accepted),
  }
}

/**
 * Everything this module can say about a decode failure, located and explained.
 *
 * Returns an empty array when the decode failed for some other reason (a missing
 * required field, a bad value); the caller is expected to fall back to the
 * decoder's own formatter so no failure is ever swallowed. Pure.
 */
export const collectDecodeFindings = (issue: SchemaIssue.Issue): readonly DecodeFinding[] =>
  walkIssue(issue, [])
    .findings.filter(
      (finding, index, all) =>
        all.findIndex((other) => findingIdentity(other) === findingIdentity(finding)) === index
    )
    .map(toDecodeFinding)

/**
 * Every unrecognised property the decoder rejected, located and explained.
 *
 * A narrowing of `collectDecodeFindings` kept for the callers and tests that
 * only care about this one finding kind. Pure.
 */
export const collectExcessPropertyFindings = (
  issue: SchemaIssue.Issue
): readonly ExcessPropertyFinding[] =>
  collectDecodeFindings(issue).filter(
    (finding): finding is ExcessPropertyFinding & { readonly kind: 'excess-property' } =>
      finding.kind === 'excess-property'
  )

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

export const formatDecodeReport = (
  findings: readonly DecodeFinding[],
  refSources: ReadonlyMap<string, string>
): readonly string[] =>
  findings.flatMap((finding) => {
    const sourceFile = attributeSourceFile(finding.path, refSources)
    const at = `    at ${finding.path}${sourceFile ? `  (${sourceFile})` : ''}`

    if (finding.kind === 'union-mismatch') {
      const [headline, trailer] = mismatchLines(finding)
      return [headline, at, trailer]
    }

    if (finding.kind === 'unknown-discriminant') {
      const [headline, trailer] = discriminantLines(finding)
      return [headline, at, ...suggestionLine(finding.suggestion), trailer]
    }

    return [
      `  Unknown property '${finding.key}'${finding.nodeLabel ? ` on ${finding.nodeLabel}` : ''}`,
      at,
      ...suggestionLine(finding.suggestion),
      `    Accepted here: ${finding.accepted.join(', ')}`,
    ]
  })

/**
 * The whole pipeline: issue tree in, report lines out, empty when this module
 * has nothing better to say than the decoder does. Pure.
 */
export const buildDecodeIssueReport = (
  issue: SchemaIssue.Issue,
  refSources: ReadonlyMap<string, string>
): readonly string[] => formatDecodeReport(collectDecodeFindings(issue), refSources)
