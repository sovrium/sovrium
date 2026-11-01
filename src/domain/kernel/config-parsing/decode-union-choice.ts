/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Choosing one member of a union the decoder rejected, and saying what to write
 * when it pruned every member unrun.
 *
 * The hard part the module header of `decode-issue-walk.ts` describes: at every
 * union only the member the author most plausibly meant is walked into the
 * report, so one mistake yields one problem however many members were tried.
 * The walk is handed in rather than imported, so the recursion runs one way
 * between the two modules.
 */

import { EMPTY_CANDIDATE, inputOf, leafCandidate, type Candidate } from './decode-findings'
import { annotation, unionDiscriminantValues, unionMemberTitles } from './schema-ast'
import type { SchemaIssue } from 'effect'

/** The issue-tree walk, handed in by `decode-issue-walk.ts`. */
export type IssueWalk = (
  issue: SchemaIssue.Issue,
  segments: readonly (string | number)[]
) => Candidate

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
 * a CLI validate spec pins exactly that config for exactly that reason.
 *
 * Writing `type` at all is strong evidence the author reached for the family
 * that HAS a `type`. So it outranks any achievable key overlap, and sits an
 * order of magnitude below `DISCRIMINANT_WEIGHT` because an exact literal match
 * is strictly better evidence than the property name alone.
 */
const DISCRIMINANT_NAME_WEIGHT = 100

/**
 * Choose one member of a union.
 *
 * Ranked purely by score — the branch that recognises the most of what the
 * author wrote — never by "which branch produced an error we can print". A
 * branch is only reported if it is also the branch the author most plausibly
 * meant, so the reporter can be silent (and defer to `TreeFormatter`) rather
 * than confidently attribute a mistake to the wrong shape.
 */
export const pickBestBranch = (candidates: readonly Candidate[]): Candidate =>
  candidates.reduce(
    (best, candidate) => (candidate.score > best.score ? candidate : best),
    candidates[0] ?? EMPTY_CANDIDATE
  )

/**
 * The same candidate with its rule failures confirmed or withdrawn by one union.
 *
 * Only a union the decoder actually contested — more than one member tried —
 * has a say. A decisive choice confirms; a tie withdraws, even a confirmation
 * earned lower down, because the rule lives in a member nobody can show the
 * author meant. And a withdrawal is FINAL: a decisive union higher up says the
 * author meant the outer shape, not which inner member they meant, so it must
 * not revive a rule an inner tie withdrew — that would hide the tied sibling's
 * complaint behind a guess.
 */
const settleChecks = (candidate: Candidate, decisive: boolean): Candidate => ({
  ...candidate,
  findings: candidate.findings.map((finding) =>
    finding.kind === 'check-failure'
      ? { ...finding, confirmed: decisive && finding.confirmed !== false }
      : finding
  ),
})

/**
 * The member a contested union keeps. A tie over a bare value (`neutral-250`: a colour, or a
 * reference?) has no shape to choose by, so the union is the leaf and every member is read.
 */
const settleUnion = (
  issue: Extract<SchemaIssue.Issue, { readonly _tag: 'AnyOf' }>,
  segments: readonly (string | number)[],
  walkIssue: IssueWalk
): Candidate => {
  const branches = issue.issues.map((child) => walkIssue(child, segments))
  const chosen = pickBestBranch(branches)
  const tied = branches.filter((branch) => branch.score >= chosen.score)
  if (tied.length > 1 && ['string', 'number', 'boolean'].includes(typeof inputOf(issue)))
    return leafCandidate(issue, segments)
  return branches.length > 1 ? settleChecks(chosen, tied.length === 1) : chosen
}

/**
 * A union.
 *
 * When the parser entered a branch, that branch's own failure is more specific
 * than "your value fits none of these shapes", so the walk descends (see
 * `settleUnion`). The interesting case is `issues.length === 0`: v4's candidate
 * index pruned EVERY branch unrun, which happens exactly when the value's
 * discriminant matches no member — a shape that does not exist, which v3
 * answered by naming the members and v4's formatter by an internal type name.
 *
 * Deliberately narrow: emitting whenever the chosen branch merely produced
 * nothing would replace the decoder's specific complaint (a missing field, a bad
 * value) with a vaguer shape list across every union in `AppSchema`.
 */
export const walkAnyOf = (
  issue: Extract<SchemaIssue.Issue, { readonly _tag: 'AnyOf' }>,
  segments: readonly (string | number)[],
  walkIssue: IssueWalk
): Candidate => {
  const best = settleUnion(issue, segments, walkIssue)
  if (issue.issues.length > 0) return best
  const input = inputOf(issue)
  const variants = unionMemberTitles(issue.ast)
  if (variants !== undefined) {
    return {
      findings: [
        {
          kind: 'union-mismatch',
          segments,
          expected: annotation(issue.ast, 'identifier') ?? annotation(issue.ast, 'title'),
          variants,
          input,
        },
      ],
      score: best.score,
    }
  }

  // Untitled but discriminated: name the legal VALUES instead of the shapes.
  // Neither: the union itself is the leaf (`Expected "h1" | "h2" ..., got ...`).
  const discriminant = unionDiscriminantValues(issue.ast)
  if (discriminant === undefined) return leafCandidate(issue, segments)

  // Credit only for what the author demonstrably wrote: a value carrying no `type`
  // is no evidence they meant this family, so a sibling branch may still win.
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
