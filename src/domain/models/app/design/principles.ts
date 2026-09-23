/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * One design principle — a single sentence an author (human or agent) can hold
 * in mind while composing a page.
 *
 * Deliberately a free string, not an enum. A principle is the app's own
 * conviction ("Restraint over ornament", "The visitor is the hero"), and an
 * enumeration of Sovrium's convictions would be Sovrium authoring the customer's
 * design system rather than carrying it.
 *
 * Non-empty is the one constraint: an empty principle is a row in a document
 * that says nothing, and it reaches the generated design-system export as a
 * blank bullet.
 */
export const DesignPrincipleSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Design Principle',
    description: 'One design conviction, stated as a single sentence',
    examples: ['Restraint over ornament', 'The visitor is the hero, not the product'],
  }),
  Schema.check(Schema.isMinLength(1, { message: 'A design principle must not be empty' }))
)

/**
 * The app's design principles, in the order they should be read.
 *
 * These are the top of a design system — the sentences that explain WHY the
 * tokens are what they are. Today they live only as prose in `BRAND.md` §1
 * ("Thesis"), which is app-local, invisible to the running instance, and
 * unavailable to any customer who is not this repo.
 */
export const DesignPrinciplesSchema = Schema.Array(DesignPrincipleSchema).pipe(
  Schema.annotate({
    identifier: 'DesignPrinciples',
    title: 'Design Principles',
    description:
      "The app's design convictions, ordered. Rendered at the top of the design-system export so an agent is handed the reasoning behind the tokens, not just the tokens.",
    examples: [['Restraint over ornament', 'Colour is spent on error, and nowhere else']],
  })
)

/** @public */
export type DesignPrinciple = Schema.Schema.Type<typeof DesignPrincipleSchema>
/** @public */
export type DesignPrinciples = Schema.Schema.Type<typeof DesignPrinciplesSchema>
