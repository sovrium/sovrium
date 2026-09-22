/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The decisions BOTH record pickers must agree on: what they say, and what a
 * link cap means.
 *
 * `record-candidates.ts` beside this file put the two surfaces' READS in one
 * place. This module does the same for the two things a read cannot carry —
 * the words on screen, and the arithmetic of a link set — because those had
 * drifted into a second copy each while the query was being shared.
 *
 * Why it is worth a module rather than living twice: the strings here are
 * LOCATORS. `record-picker.spec.ts` drives the form by `getByText('2 of 2
 * linked')` and both surfaces by `getByText('No matching records')`, and the
 * grid's copies of those strings are not separately asserted. So a reworded
 * grid picker stays green while the two surfaces say different things about
 * the same column — which is the exact failure mode [internal ref] was written to
 * close, one level down from where it closed it.
 *
 * What deliberately does NOT live here: the two surfaces' genuinely different
 * behaviours. The grid keeps its listbox OPEN at the cap because that listbox
 * is the only place a cell can unlink something; the form CLOSES its popup
 * because its chips can. Their shells differ too — a bordered strip continuing
 * the popover's border stack on the grid, plain muted text under the field on
 * the form. Those are answers to different questions, not drift, and unifying
 * them would be the mirror of the mistake this file prevents.
 */

/**
 * What a picker over RECORDS calls things.
 *
 * Not the generic picker vocabulary: `FetchingPicker` is shared with the user
 * picker, which legitimately says "No matching people" and "Could not load the
 * directory". These are the record picker's own words, taken by the grid
 * editor as props and by the form's popup directly.
 */
export const RECORD_PICKER_COPY = {
  /** The search settled and matched nothing. */
  empty: 'No matching records',
  /** The search never landed. Distinct from `empty` on purpose — collapsing the
   *  two tells a reader "nothing matched" about a request that failed. */
  failed: 'Could not load records',
  /** The field declares no `relatedTable`, so no search is possible at all. */
  unconfigured: 'This field declares no related table',
} as const

/** Shown while a candidate search is still in flight, on every fetching picker. */
export const SEARCHING_LABEL = 'Searching…'

/** The control that appends the next page of candidates, on both surfaces. */
export const LOAD_MORE_LABEL = 'Load more'

/** "N of N linked" — the wording [internal ref] fixed, asserted verbatim by the spec. */
export function linkCountLabel(linked: number, maxLinked: number): string {
  return `${linked} of ${maxLinked} linked`
}

/**
 * What an empty listbox says, in precedence order: a misconfigured field first
 * (there was never a search to have results), then a failed one, then one still
 * running, then a genuine empty result.
 *
 * `unconfiguredLabel` is tested for TRUTHINESS rather than for `undefined`,
 * preserving the grid's original reading: an empty string is not an explanation
 * and must fall through rather than blank the listbox.
 */
export function resolvePickerEmptyLabel(args: {
  readonly failed: boolean
  readonly loading: boolean
  readonly emptyLabel: string
  readonly failedLabel: string
  readonly unconfiguredLabel?: string
}): string {
  if (args.unconfiguredLabel) return args.unconfiguredLabel
  if (args.failed) return args.failedLabel
  return args.loading ? SEARCHING_LABEL : args.emptyLabel
}

/**
 * Whether a link set has reached its declared ceiling.
 *
 * The boundary is INCLUSIVE — exactly `maxLinked` links is at the cap and no
 * more may be added, which is what `maxLinked` means and what the server-side
 * {@link findRelationshipLinkOverflows} enforces with the same boundary. An
 * absent `maxLinked` is uncapped.
 */
export function isAtLinkCap(maxLinked: number | undefined, linked: number): boolean {
  return maxLinked !== undefined && linked >= maxLinked
}

/** The link set with `id` added when it is absent, removed when it is present. */
export function togglingIn(ids: readonly string[], id: string): readonly string[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]
}

/**
 * "Search by id" — what a picker SAYS when no display column was declared.
 *
 * The honest degradation rather than a guess. A picker that guessed `name`
 * would work on the table in front of the author and fail silently on the next
 * one; announcing the id lets the reader either fix the config or use the id.
 */
export const SEARCH_BY_ID_LABEL = 'Search by id'

/**
 * "Load N more" — the counted variant of {@link LOAD_MORE_LABEL}.
 *
 * A DELIBERATE difference from the two surfaces above rather than drift: the
 * standalone picker reads the endpoint's total, so it knows how many are left
 * and saying so costs nothing. The grid's and the form's pickers do not ask for
 * a total, and a count they cannot support would be worse than no count.
 */
export function loadMoreCountLabel(remaining: number): string {
  return `Load ${String(remaining)} more`
}

/**
 * "N of N" — how many candidates are shown out of how many match.
 *
 * Rendered ONLY once the list is complete. While a page is outstanding the
 * total is a claim about the table that the response cannot support, and a
 * reader who sees a total assumes they are looking at all of it.
 */
export function candidateCountLabel(shown: number, total: number): string {
  return `${String(shown)} of ${String(total)}`
}
