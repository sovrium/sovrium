/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The colours a threshold can actually be drawn in.
 *
 * It was `Schema.String`, described as *"Color name or hex"*, and the hex half
 * was never true: the card maps the resolved name through a five-entry table
 * and falls back to the default foreground for anything else. So a config
 * declaring `#ff0000` validated, shipped, and drew the same grey as a config
 * declaring nothing — the worst failure available, because the operator has
 * written the thing down and can see it in their config.
 *
 * Narrowing converts that silent no-op into a decode-time refusal naming the
 * five that work. It is technically a breaking change to a published option;
 * what it breaks is a declaration that never had an effect.
 *
 * Deliberately NOT `KPITrendColorSchema`, which is the same idea one field
 * over and carries four of these five. A trend says better-or-worse and has no
 * use for `blue`; a threshold says which band a number is in, and a neutral
 * informational band is a real one. Sharing the union would force one of the
 * two surfaces to carry a member it cannot mean.
 */
export const KPIThresholdColorSchema = Schema.Literals([
  'red',
  'green',
  'yellow',
  'blue',
  'gray',
]).annotate({
  title: 'KPI Threshold Color',
  description: 'Colour applied when the metric value meets this boundary',
})

export const KPIThresholdSchema = Schema.Struct({
  value: Schema.Finite.annotate({ description: 'Threshold boundary value' }),
  color: KPIThresholdColorSchema,
}).annotate({
  title: 'KPI Threshold',
  description:
    'Conditional color threshold — applied when the metric value meets or exceeds the boundary',
})

/** @public */
export type KPIThreshold = Schema.Schema.Type<typeof KPIThresholdSchema>

/** @public */
export type KPIThresholdColor = Schema.Schema.Type<typeof KPIThresholdColorSchema>
