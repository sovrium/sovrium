/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { validateMinMaxRange } from '../validation-utils'
import { DecimalFieldSchema } from './decimal-field'

/**
 * Number Field — a catalogued alias of {@link DecimalFieldSchema}.
 *
 * `number` is the name most people reach for first, and configs have long used
 * it. Before it was catalogued it decoded only through the unknown-type
 * catch-all, so its options went unchecked and it appeared in no documentation.
 * It now accepts exactly what `decimal` accepts — the same options, the same
 * range rule — and the database stores it the same way (`DECIMAL`).
 *
 * The options are SPREAD from the decimal schema rather than re-declared, so the
 * two cannot drift: an option added to `decimal` reaches `number` on the same
 * commit. Only the `type` discriminator differs.
 *
 * @example
 * ```typescript
 * const field = { id: 1, name: 'weight', type: 'number', precision: 2, min: 0 }
 * ```
 */
export const NumberFieldSchema = Schema.Struct({
  ...DecimalFieldSchema.fields,
  type: Schema.Literal('number').pipe(
    Schema.annotate({
      description:
        "Constant value 'number' — an alias of 'decimal': same options, same storage, same behaviour",
    })
  ),
}).pipe(
  Schema.annotate({
    title: 'Number Field',
    description:
      "An alias of the 'decimal' field type. It takes the same options (precision, min, max, default) and is stored the same way; the records API returns its value as a JSON number, where a 'decimal' value is a string that keeps every digit.",
    examples: [
      {
        id: 1,
        name: 'weight',
        type: 'number',
        precision: 2,
        min: 0,
        max: 999.99,
      },
    ],
  }),
  Schema.check(Schema.makeFilter(validateMinMaxRange))
)

/** @public */
export type NumberField = Schema.Schema.Type<typeof NumberFieldSchema>
