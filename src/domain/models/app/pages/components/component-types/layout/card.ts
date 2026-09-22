/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const CardTypeLiteral = Schema.Literal('card')

/**
 * The three surfaces a card can be, beyond the default raised chip.
 *
 * ─── WHY THESE ARE VARIANTS AND NOT TYPES ──────────────────────────────────
 *
 * Each was its own component type, and each was a card with one extra job:
 *
 * - **`bubble`** — was `speech-bubble`. A card with a tail, for a message in a
 *   conversation. Nothing else about it differed.
 * - **`specimen`** — a card that presents a drawn component, with a stage
 *   around it so the drawing and its caption are one unit.
 * - **`scoped`** — a card that is also a boundary: it emits the design-scope
 *   marker attribute so the documented design paints inside it and nowhere
 *   else.
 *
 * A reader looking for "the box with a border" met four entries in the kit
 * index and had to know which extra job they wanted before they could pick the
 * box. One type with a named variant is the same capability, found once.
 *
 * ─── THE MODE AXIS IS NOT THE STYLE AXIS ───────────────────────────────────
 *
 * This mirrors `badge`, which carries `badgeVariant` (visual style) beside
 * `variant` (rendering MODE, and the field that absorbed `status-indicator`).
 * A card's mode changes what it draws, not merely how it is painted, which is
 * why omitting it leaves the ordinary card rather than an unstyled one.
 */
export const CardModeSchema = Schema.Literals(['bubble', 'specimen', 'scoped']).annotate({
  title: 'Card Mode',
  description:
    "Specialized rendering mode: 'bubble' (a speech bubble with a tail), 'specimen' (a stage presenting a drawn component), 'scoped' (a design boundary)",
})

/** Which side a `variant: bubble` card's tail sits on. */
export const CardBubbleSideSchema = Schema.Literals(['left', 'right']).annotate({
  title: 'Bubble Side',
  description:
    "Which side the bubble's tail sits on: 'left' (the sender, default) or 'right' (the receiver)",
})

export const cardFields = {
  ...coreFields,
  ...contentFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * Specialized rendering mode. Omit for the ordinary raised card.
   *
   * `contentFields` and `i18nFields` joined `card` with this: a `bubble` holds
   * a message, and the type it replaced could carry that message as `content`
   * and localize it. Both are optional and inert on a card that does not use
   * them, so an existing card decodes and renders exactly as it did.
   */
  variant: Schema.optional(CardModeSchema),
  /**
   * Which side the tail sits on. Read under `variant: bubble`.
   *
   * Inert under the other modes rather than refused, matching every other
   * mode-specific key in the catalogue: the union of all four shapes is one
   * open struct, and refusing per-variant would need a per-branch refinement
   * hook `buildComponentUnion` does not have.
   */
  side: Schema.optional(CardBubbleSideSchema),
} as const
