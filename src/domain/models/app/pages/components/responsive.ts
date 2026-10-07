/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
const OverridePropKeySchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message: 'Property key must be camelCase starting with a letter',
    })
  )
)

export const VariantOverridesSchema = Schema.Struct({
  props: Schema.optional(
    Schema.Record(
      Schema.String,
      Schema.Union([
        Schema.String,
        Schema.Finite,
        Schema.Boolean,
        Schema.Record(Schema.String, Schema.Unknown),
        Schema.Array(Schema.Unknown),
      ])
    ).pipe(
      Schema.annotate({
        description: 'Props to override',
      }),
      // Keys: any string in the key position, and the pattern enforced by
      // `isPropertyNames`, so a mistyped key is refused by name at its own path
      // with the pattern it must match. A pattern on the key schema itself makes
      // Effect 4 skip the entry, and the config report then named it an unknown
      // property with nothing accepted. The JSON Schema rendering keeps the pattern.
      Schema.check(
        Schema.isPropertyNames(OverridePropKeySchema, {
          toJsonSchema: () => ({
            propertyNames: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9]*$' },
          }),
        })
      )
    )
  ),
  content: Schema.optional(
    Schema.String.annotate({
      description: 'Content to display at this breakpoint',
    })
  ),
  visible: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Show/hide component at this breakpoint',
    })
  ),
  children: Schema.optional(
    Schema.Array(Schema.Unknown).annotate({
      description: 'Different children at this breakpoint',
    })
  ),
}).annotate({
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
 */
export const ResponsiveSchema = Schema.Struct({
  mobile: Schema.optional(VariantOverridesSchema),
  sm: Schema.optional(VariantOverridesSchema),
  md: Schema.optional(VariantOverridesSchema),
  lg: Schema.optional(VariantOverridesSchema),
  xl: Schema.optional(VariantOverridesSchema),
  '2xl': Schema.optional(VariantOverridesSchema),
}).annotate({
  title: 'Responsive Variants',
  description: 'Breakpoint-specific component overrides for responsive design',
})

export type VariantOverrides = Schema.Schema.Type<typeof VariantOverridesSchema>
export type Responsive = Schema.Schema.Type<typeof ResponsiveSchema>

/**
 * One value per breakpoint, for a single LAYOUT prop.
 *
 * `ResponsiveSchema` overrides a whole component at a breakpoint; this is the
 * narrower shape one prop needs — a calendar's day height, a KPI's size — so
 * the prop can say "64px on a phone, 90px from md up" without an arbitrary
 * `max-md:` selector. A breakpoint left out inherits the nearest narrower one
 * that is set, which is how Tailwind's min-width breakpoints read, and why the
 * keys are min-width names rather than ranges. One value for every screen is
 * written `{ mobile: <value> }`.
 *
 * It is a plain struct, the same shape as a gallery's `gridColumns`, rather
 * than a "value OR struct" union: the published option tree and the editor
 * completion both read a struct's keys directly.
 *
 * @param value - The schema of one value.
 * @param what - What the value is, for the published description.
 */
export const responsiveValue = <S extends Schema.Top & { readonly Rebuild: S }>(
  value: S,
  what: string
) =>
  Schema.Struct({
    mobile: Schema.optional(
      value.annotate({ description: `${what} from the narrowest screen up` })
    ),
    sm: Schema.optional(value.annotate({ description: `${what} from 640px up` })),
    md: Schema.optional(value.annotate({ description: `${what} from 768px up` })),
    lg: Schema.optional(value.annotate({ description: `${what} from 1024px up` })),
    xl: Schema.optional(value.annotate({ description: `${what} from 1280px up` })),
    '2xl': Schema.optional(value.annotate({ description: `${what} from 1536px up` })),
  }).annotate({
    title: 'Per-Breakpoint Value',
    description: `${what}, one value per breakpoint (\`mobile\`, \`sm\`, \`md\`, \`lg\`, \`xl\`, \`2xl\`); a breakpoint left out inherits the nearest narrower one`,
  })
