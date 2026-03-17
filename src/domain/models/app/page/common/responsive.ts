/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Component properties that can be overridden at specific breakpoints
 *
 * Supports overriding:
 * - props: Component properties (className, style, etc.)
 * - content: Text content
 * - visible: Show/hide component
 * - children: Different child components
 *
 * @example
 * ```typescript
 * const overrides = {
 *   props: { className: 'text-2xl text-center' },
 *   content: 'Welcome!',
 *   visible: true
 * }
 * ```
 */
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

/**
 * Breakpoint-specific component overrides for responsive design
 *
 * Provides responsive variants matching common breakpoints:
 * - mobile: Base mobile styles
 * - sm: Small (640px)
 * - md: Medium (768px)
 * - lg: Large (1024px)
 * - xl: Extra large (1280px)
 * - 2xl: 2x extra large (1536px)
 *
 * All breakpoints are optional. Use mobile-first approach: define base
 * styles at mobile level, then override at larger breakpoints.
 *
 * @example
 * ```typescript
 * const responsive = {
 *   mobile: {
 *     props: { className: 'text-2xl text-center' },
 *     content: 'Welcome!',
 *     visible: true
 *   },
 *   md: {
 *     props: { className: 'text-4xl text-left' },
 *     content: 'Welcome to Our Platform'
 *   },
 *   lg: {
 *     props: { className: 'text-6xl text-left font-bold' },
 *     content: 'Welcome to Our Amazing Platform'
 *   }
 * }
 * ```
 *
 * @see specs/app/pages/common/responsive.schema.json
 */
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
