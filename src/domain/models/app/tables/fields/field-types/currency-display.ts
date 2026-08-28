/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The properties that decide how a monetary amount RENDERS — shared by every
 * field type whose value can be money.
 *
 * They lived only on `CurrencyFieldSchema`, which made the field TYPE the thing
 * that could carry a currency code. A `formula` computing `unit_price *
 * stock_on_hand` over a `currency: EUR` column is money by any reading, but had
 * nowhere to say so: `sovrium validate` rejects undeclared keys
 * (`onExcessProperty: 'error'`), so the amount rendered `$224,430.90` beside the
 * `€28.63` it was computed from, and no valid config could fix it.
 *
 * Extracted rather than copied. Duplicating five property definitions into a
 * second field type is how two definitions of one concept start drifting — the
 * failure mode this module exists to avoid, not to spread.
 *
 * Every consumer spells its own `currency` key (required on `currency`,
 * optional on computed fields), so only the CONSTRAINTS are shared here.
 */

/**
 * ISO 4217 three-letter code. Re-annotate at the use site when the surrounding
 * field needs to say something more specific — a trailing `.annotate()`
 * after the refinements wins, which is the only form that does not silently
 * rewrite the published description.
 */
export const CurrencyCodeSchema = Schema.String.pipe(
  Schema.check(Schema.isLengthBetween(3, 3), Schema.isPattern(/^[A-Z]{3}$/)),
  Schema.annotate({
    description: 'ISO 4217 three-letter currency code (e.g., USD, EUR, GBP)',
    examples: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
  })
)

/** Number of decimal places rendered. */
export const CurrencyPrecisionSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(10)),
  Schema.annotate({
    description: 'Number of decimal places (0-10, default: 2 for most currencies)',
  })
)

/** Which side of the amount the symbol sits on. */
export const CurrencySymbolPositionSchema = Schema.Literals(['before', 'after']).pipe(
  Schema.annotate({
    description: 'Position of currency symbol relative to the amount',
    examples: ['before', 'after'],
  })
)

/** How a negative amount is spelled. */
export const CurrencyNegativeFormatSchema = Schema.Literals(['minus', 'parentheses']).pipe(
  Schema.annotate({
    description: 'Format for displaying negative amounts',
    examples: ['minus', 'parentheses'],
  })
)

/** The glyph grouping the integer part. */
export const CurrencyThousandsSeparatorSchema = Schema.Literals([
  'comma',
  'period',
  'space',
  'none',
]).pipe(
  Schema.annotate({
    description: 'Character used to separate thousands',
    examples: ['comma', 'period', 'space', 'none'],
  })
)
