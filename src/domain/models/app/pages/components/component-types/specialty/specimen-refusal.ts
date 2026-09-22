/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a `specimen` may not draw, and why.
 *
 * ─── A LEAF MODULE ON PURPOSE ─────────────────────────────────────────────
 *
 * This file imports nothing but `effect`. It is read by BOTH `specimen.ts`
 * (which declares the field) and the component-type barrel (which builds the
 * union that field points at), and the two are already in an import cycle with
 * each other. A leaf has no initialization order to get wrong, so the safety
 * rule cannot go quiet because a module happened to be entered from a different
 * direction — which is exactly the failure mode a decode-time refusal must not
 * have.
 *
 * @see ./specimen.ts
 */

import { Schema } from 'effect'

/**
 * Types a specimen may not draw, at ANY depth of the component it is given.
 *
 * `form` — renders a live submit control unconditionally, on the create branch
 * and the update branch alike, and in both of its modes: the fields declared on
 * it, or a record written back to the table it binds. A specimen is a preview
 * frame, and **[internal ref] A3 clause 2** says a preview frame may carry no write
 * path. The refusal is depth-independent because the hazard is: a form nested
 * three levels inside a card is the same live write control as one at the top.
 *
 * It was TWO entries until C3 merged `data-form` into `form`. Nothing about the
 * rule changed — a table-bound form was never the safe one — so the merge took
 * a name out of this list rather than a case out of the refusal.
 *
 * `specimen` — not unsafe, unbounded. Each level projects its snippet from the
 * literal below it, so a two-level specimen's snippet contains a specimen and
 * nothing in the shape stops the nesting.
 *
 * The catalogue owns the canonical refusal list and its per-type sentences for
 * the types it declines to DRAW; this list decides what may be DECLARED. Where
 * the two disagree, the stricter wins.
 */
export const SPECIMEN_REFUSED_TYPES: readonly string[] = ['form', 'specimen']

/** The type literal of a declared component, when it declares one readably. */
const declaredTypeOf = (component: unknown): string | undefined => {
  if (typeof component !== 'object' || component === null) return undefined
  const { type } = component as { type?: unknown }
  return typeof type === 'string' ? type : undefined
}

/**
 * The decode-time refusal.
 *
 * Each refused type gets its OWN sentence rather than a shared one: a sentence
 * written once and pasted across N refusals goes false on all N together, and
 * no reader can tell which one it stopped describing. An author told only
 * "invalid" tries a different spelling; one told why moves the form to a page
 * of its own.
 */
export const refusesUndrawableType = Schema.makeFilter((component: unknown) => {
  const type = declaredTypeOf(component)
  if (type === undefined || !SPECIMEN_REFUSED_TYPES.includes(type)) return true
  return type === 'specimen'
    ? 'A `specimen` cannot draw another `specimen`: each level projects its snippet from the literal below it, so the nesting has no bound. Draw the inner component directly.'
    : `A \`specimen\` cannot draw \`${type}\`: it renders a live submit control, and a preview frame may carry no write path (ADR-022 A3 clause 2). Show the form on a page of its own, or draw its individual controls.`
})
