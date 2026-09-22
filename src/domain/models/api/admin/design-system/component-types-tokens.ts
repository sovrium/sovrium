/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// The flat projection of the token document
// ---------------------------------------------------------------------------

/**
 * One token of the design system, flattened to a row.
 *
 * ─── A PROJECTION, NEVER A REPLACEMENT ────────────────────────────────────
 *
 * `GET /api/admin/design-system.json` serves a **DTCG document**, whose shape
 * is a nested tree of typed groups because that is what the standard specifies
 * and what a conformant consumer reads. Without `?flat=1` it must stay
 * byte-identical: the flag is why this contract can exist without breaking the
 * document, and a console convenience must never reshape a published standard
 * format.
 *
 * A table cannot render a tree, and the console's "Votre design" page IS a
 * table — N inherited, M overridden, the locked ones marked. So the flag emits
 * the same tokens as rows, addressed by their dotted `path`.
 *
 * `inherited` and `overridden` are two fields rather than one enum because
 * they are two independent questions and the pair `(inherited: false,
 * overridden: false)` is not reachable while `(true, true)` is not either — a
 * single tri-state would encode the same information and lose the ability to
 * filter on one axis, which is what the page's counters do.
 *
 * ─── AND `dark` IS HERE RATHER THAN IN A SECOND ROW SHAPE ─────────────────
 *
 * `theme.darkColors` has no home in the DTCG tree — the document publishes one
 * value per token — so a console swatch printing the value it PAINTS has no way
 * to know what it paints under `?scheme=dark`. Carrying the counterpart on the
 * same row keeps the two halves of one token together; a parallel dark listing
 * would have to be joined back by path, and a join a page cannot perform is a
 * join that gets performed wrong.
 */
export const flatTokenRowSchema = Schema.Struct({
  path: Schema.String.annotate({
    description: 'Dotted path of the token within the document',
    examples: ['color.background', 'spacing.section'],
  }),
  value: Schema.String.annotate({
    description: 'The value as the renderer applies it, stringified for the table',
  }),
  inherited: Schema.Boolean.annotate({
    description: 'Whether the platform supplied this value rather than the operator',
  }),
  overridden: Schema.Boolean.annotate({
    description: 'Whether the operator declared this value over an inherited one',
  }),
  locked: Schema.Boolean.annotate({
    description: 'Whether config can change this value at all',
  }),
  dark: optionalField(
    Schema.String.annotate({
      description:
        'What this token becomes in the dark scheme, when the operator declared a counterpart. ABSENT — never a copy of `value` — when they declared none: "the same in both schemes" and "no dark scheme was ever chosen" are different facts, and a swatch printing the value it paints has to say which one it is showing.',
      examples: ['#0b0b0c'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'FlatTokenRow',
})

/** The flattened token listing — the same rows envelope as the catalogue. */
export const flatTokensResponseSchema = Schema.Struct({
  items: Schema.Array(flatTokenRowSchema).annotate({
    description: 'Every token of the document, flattened to a row',
  }),
  total: Schema.Int.annotate({
    description: 'How many rows this response carries',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'FlatTokensResponse',
})

/** @public */
export type FlatTokenRow = typeof flatTokenRowSchema.Type
/** @public */
export type FlatTokensResponse = typeof flatTokensResponseSchema.Type
