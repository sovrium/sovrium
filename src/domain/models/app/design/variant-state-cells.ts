/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The variant × state cross product — ONE computation, for the two callers that
 * need the same product in two shapes.
 *
 * ─── WHY THE PRODUCT IS A DOMAIN FACT AND NOT A BUILDER DETAIL ─────────────
 *
 * The console's per-type page BUILDER walked members × states to DRAW a matrix,
 * and the per-type endpoint publishes the same product so a config page can draw
 * it from one rows binding. A second traversal beside the first is the drift the
 * `snippet` / `drawnProps` pairing one module over already exists to prevent:
 * two projections of one fact must come from one computation, or the day an axis
 * gains a member the drawn matrix and the published one disagree and nothing
 * says so. The builder has since gone and the page draws from these rows, so the
 * two projections became one — which is the state this module was written for.
 *
 * It lives here rather than in the builder for the reason
 * `state-vocabulary.ts` moved here beside it: a page BUILDER is not a place
 * another caller can import from, and the endpoint is a second caller.
 *
 * ─── IT TAKES THE PUBLISHED ARRAYS, NOT THE TYPE NAME ──────────────────────
 *
 * The signature could have been `(type, category)` and re-read `introspectType`
 * and `statesOfCategory` itself. It takes the two arrays instead, because that
 * is what makes the guarantee mechanical rather than merely intended: the cells
 * are the product of the EXACT arrays the response publishes as `variants` and
 * `states`, so `cells.length === variantCount * stateCount` holds by
 * construction and cannot be falsified by a caller that read one axis from a
 * different source than the other.
 *
 * ─── EMPTY WHEN EITHER AXIS IS EMPTY, WHICH IS NOT A SPECIAL CASE ──────────
 *
 * A product with an empty factor is empty, so no branch says so. That matters
 * because the drawing side is deliberately NOT the same shape: `variantMatrix`
 * substitutes a synthetic `default` column for a type whose category draws no
 * states, so that a variants-only type still draws something. That substitution
 * is a RENDERING choice — a column has to be drawn somewhere — and publishing it
 * would put a state on the wire that the type's category does not have. The
 * published product stays the honest one: seventy-one of the ninety-one
 * catalogued types answer `[]` here, and that is the output rather than a gap.
 */

import type { StateScope, StateSource } from './state-vocabulary'

/**
 * One addressable cell of a variant × state matrix.
 *
 * FLAT, and carrying both axes on one row, because that is the only shape a
 * config page can render the matrix from. A nested binding cannot do it: inside
 * an inner row template the inner record REPLACES the outer rather than merging
 * with it, so a cell beneath a nested
 * binding can name the inner axis or the outer one and never both — while the
 * identifier it must carry, `design-system-specimen-<type>-<variant>-<state>`,
 * is composed from both.
 */
export interface VariantStateCell {
  /** The variant axis value this cell draws, as an author writes it in config. */
  readonly variant: string
  /** The state this cell draws, in a reader's words. */
  readonly state: string
  /**
   * Carried onto the cell rather than left on the `states` array, because the
   * cell is what a page renders and a page cannot join two arrays. Without it
   * a matrix would present a depicted `hover` exactly as it presents a rendered
   * `disabled` — the claim `state-vocabulary.ts` exists to refuse.
   */
  readonly source: StateSource
  /**
   * Carried onto the cell for the SAME reason `source` is, and it is the same
   * sentence: the cell is what a page renders and a page cannot join two
   * arrays. A cell without its scope cannot tell a row state from a component
   * one, so a matrix would present `row selected` exactly as it presents
   * `disabled` — and a row-scoped paint drawn at component scope fills the
   * whole specimen.
   */
  readonly scope: StateScope
  /**
   * Whether this cell belongs to the row that EXHIBITS the state vocabulary —
   * true exactly where the cell's variant is `variants[0]`.
   *
   * ─── WHY THE PRODUCER HAS TO SAY IT ────────────────────────────────────────
   *
   * `data-design-state` answers "which states does this type have", and
   * `[internal ref]` pins each state at `toHaveCount(1)`. Stamping it
   * on every cell makes that question have one answer per variant — twenty-eight
   * of them for `button`. The drawing side avoids that with an outer-row INDEX
   * (`exhibit: index === 0` in `variantMatrix`), and a config page has no
   * positional operator at all: `visibility.record` compares ONE named field
   * against a literal, and the row-expansion runtime injects no implicit index.
   * So a row cannot know it is the first row unless the row says so.
   *
   * ─── AND WHY IT IS NOT `variant eq 'default'` AT THE READING END ───────────
   *
   * That predicate passes today and decays silently: the three catalogued types
   * carrying both axes happen to spell their first variant `default`, so a page
   * gating on the word goes green now and stops marking anything the first time
   * an interactive type spells its first variant otherwise — with no failure
   * anywhere, because the page would simply mark zero cells under a heading. The
   * hand-maintained-list-versus-growing-schema failure, one row down.
   *
   * A MECHANICAL projection of the array published beside it, carrying no word
   * and no reading order, which is what admits it under [internal ref] on the same
   * terms as `cells` itself.
   */
  readonly exhibit: boolean
}

/**
 * Every variant drawn in every state — variants OUTER, states INNER.
 *
 * The order is part of the contract and not an implementation accident: it is
 * the reading order of the drawn matrix, one row per variant with the states as
 * its columns, so a page rendering these rows in receipt order reproduces the
 * builder's own layout without declaring a sort it has no operator for.
 *
 * The outer index is read for exactly one thing — `exhibit` — and it is read
 * HERE, where the product is formed, because this is the only place that holds
 * both the ordering and the cell at once.
 */
export const variantStateCells = (
  variants: readonly { readonly value: string }[],
  states: readonly {
    readonly state: string
    readonly source: StateSource
    readonly scope: StateScope
  }[]
): readonly VariantStateCell[] =>
  variants.flatMap(({ value }, index) =>
    states.map(({ state, source, scope }) => ({
      variant: value,
      state,
      source,
      scope,
      exhibit: index === 0,
    }))
  )
