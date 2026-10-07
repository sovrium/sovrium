/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * A length a layout prop takes: a number followed by `px` or `rem`.
 *
 * The same two units the design ladders accept (`design/token-value-schemas`),
 * and deliberately no others: a percentage or a viewport unit would let one
 * column's width depend on a container the author does not see, which is the
 * exact fragility the layout props exist to remove. It lives at the app root
 * so every feature model — pages, design — can name it without a cross-feature
 * import.
 */
export const CssLengthSchema = Schema.String.pipe(
  Schema.annotate({ title: 'Length', examples: ['6rem', '340px'] }),
  Schema.check(
    Schema.isPattern(/^(?:\d+\.?\d*|\.\d+)(?:px|rem)$/, {
      message: 'A length must be a number followed by `px` or `rem` (e.g. `6rem`, `340px`).',
    })
  )
)

/** @public */
export type CssLength = Schema.Schema.Type<typeof CssLengthSchema>
