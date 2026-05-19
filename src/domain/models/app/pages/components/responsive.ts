/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const VariantOverridesSchema = Schema.Struct({
  props: Schema.optional(
    Schema.Record({
      key: Schema.String.pipe(
        Schema.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
          message: () => 'Property key must be camelCase starting with a letter',
        })
      ),
      value: Schema.Union(
        Schema.String,
        Schema.Number,
        Schema.Boolean,
        Schema.Record({ key: Schema.String, value: Schema.Unknown }),
        Schema.Array(Schema.Unknown)
      ),
    }).annotations({
      description: 'Props to override',
    })
  ),
  content: Schema.optional(
    Schema.String.annotations({
      description: 'Content to display at this breakpoint',
    })
  ),
  visible: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Show/hide component at this breakpoint',
    })
  ),
  children: Schema.optional(
    Schema.Array(Schema.Unknown).annotations({
      description: 'Different children at this breakpoint',
    })
  ),
}).annotations({
  title: 'Variant Overrides',
  description: 'Component properties to override at this breakpoint',
})

export const ResponsiveSchema = Schema.Struct({
  mobile: Schema.optional(VariantOverridesSchema),
  sm: Schema.optional(VariantOverridesSchema),
  md: Schema.optional(VariantOverridesSchema),
  lg: Schema.optional(VariantOverridesSchema),
  xl: Schema.optional(VariantOverridesSchema),
  '2xl': Schema.optional(VariantOverridesSchema),
}).annotations({
  title: 'Responsive Variants',
  description: 'Breakpoint-specific component overrides for responsive design',
})

export type VariantOverrides = Schema.Schema.Type<typeof VariantOverridesSchema>
export type Responsive = Schema.Schema.Type<typeof ResponsiveSchema>
