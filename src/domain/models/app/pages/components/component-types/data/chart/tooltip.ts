/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Chart tooltip configuration.
 */
export const ChartTooltipSchema = Schema.Struct({
  /** Tooltip text template with `{label}` and `{value}` placeholders */
  format: Schema.optional(
    Schema.String.annotate({
      description: 'Tooltip text template — supports {label} and {value} placeholders',
      examples: ['{label}: {value}', '{value}'],
    })
  ),
  /** The mark beside each value */
  indicator: Schema.optional(
    Schema.Literals(['dot', 'line', 'dashed']).annotate({
      description:
        "The mark beside each value, in the series colour: 'dot' (the default), 'line' or 'dashed'. shadcn/ui's ChartTooltipContent indicator.",
    })
  ),
  /** Drop the callout heading */
  hideLabel: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Leave the heading (the hovered category) off the callout (default: false)',
    })
  ),
  /** Drop the indicator */
  hideIndicator: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Leave the indicator off each value of the callout (default: false)',
    })
  ),
  /** Field naming each entry */
  nameKey: Schema.optional(
    Schema.String.annotate({
      description:
        'Row field naming each entry of the callout, such as a display name beside a code',
    })
  ),
  /** Field heading the callout */
  labelKey: Schema.optional(
    Schema.String.annotate({
      description: 'Row field heading the callout instead of the category value',
    })
  ),
}).annotate({
  title: 'Chart Tooltip',
  description: 'Tooltip display configuration',
})

/** @public */
export type ChartTooltip = Schema.Schema.Type<typeof ChartTooltipSchema>
