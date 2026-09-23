/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { validateTailwindClassList } from '../tailwind-class-list'

/**
 * The two prop keys whose string value becomes CSS classes verbatim.
 *
 * `RESERVED_PROPS` in `src/presentation/rendering/prop-conversion.ts` passes
 * both through raw — `className` is the documented spelling, `class` is the
 * HTML one an author reaches for out of habit. Validating only the first would
 * leave the habit as the escape hatch.
 */
const CLASS_LIST_PROP_KEYS: ReadonlySet<string> = new Set(['className', 'class'])

/**
 * Component property value (string, number, boolean, object, or array)
 *
 * Flexible property values supporting:
 * - String: May contain $variable references for template substitution
 * - Number: Numeric values
 * - Boolean: True/false flags
 * - Object: Nested property objects
 * - Array: Lists of values
 *
 * @example
 * ```typescript
 * const stringProp = 'text-$color bg-$bgColor'
 * const numberProp = 100
 * const booleanProp = true
 * const objectProp = { nested: 'value' }
 * const arrayProp = [1, 2, 3]
 * ```
 *
 * @see [internal ref]#/patternProperties/.../oneOf
 */
export const ComponentPropValueSchema: Schema.Codec<
  string | number | boolean | Record<string, unknown> | readonly unknown[]
> = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Record(Schema.String, Schema.Unknown),
  Schema.Array(Schema.Unknown),
])

/**
 * Component Props (properties for component templates with variable references)
 *
 * Dynamic object supporting:
 * - JavaScript property names (camelCase): className, maxWidth, isEnabled
 * - HTML data-* attributes (kebab-case): data-testid, data-user-id
 * - HTML aria-* attributes (kebab-case): aria-label, aria-describedby
 *
 * Properties can be strings (with $variable), numbers, booleans, objects, or arrays.
 * Used for template customization and variable substitution.
 *
 * @example
 * ```typescript
 * const props = {
 *   className: 'text-$color bg-$bgColor',
 *   size: '$size',
 *   enabled: true,
 *   maxWidth: 'max-w-$width',
 *   count: 10,
 *   'data-testid': 'my-component',
 *   'aria-label': 'Interactive button',
 * }
 * ```
 *
 */
export const ComponentPropsSchema = Schema.Record(
  Schema.String.pipe(
    Schema.annotate({
      title: 'Component Prop Key',
      description:
        'Valid JavaScript property name (camelCase) or HTML data-*/aria-* attribute (kebab-case)',
      examples: ['className', 'size', 'enabled', 'maxWidth', 'data-testid', 'aria-label'],
    }),
    Schema.check(
      Schema.isPattern(/^([a-zA-Z][a-zA-Z0-9]*|data-[a-z]+(-[a-z]+)*|aria-[a-z]+(-[a-z]+)*)$/, {
        message:
          'Property key must be camelCase (e.g., className, maxWidth) or kebab-case with data-/aria- prefix (e.g., data-testid, aria-label)',
      })
    )
  ),
  ComponentPropValueSchema
).pipe(
  Schema.annotate({
    title: 'Component Props',
    description:
      'Properties for component templates, supporting variable references. A `className` or `class` value is validated as a Tailwind class list: arbitrary values are allowed, but `url(`, `image-set(`, `attr(`, `expression(` and `@import` are refused inside one.',
  }),
  // A RECORD-level check, not a per-value schema, and the annotation above it
  // deliberately comes FIRST.
  //
  // Record-level, because `ComponentPropsSchema` is a `Schema.Record` over ONE
  // value schema: there is no per-key value schema to attach
  // `TailwindClassListSchema` to, so the only place that can see the key
  // alongside its value is a filter over the whole decoded record.
  //
  // Annotation first, because a `check` piped before an `annotate` lands the
  // annotation on the CHECK rather than the node, and the emitted JSON Schema
  // then loses the `title` and `description` — the same ordering trap recorded
  // at `pages/index.ts:55-57` and in the type-scale module.
  Schema.check(
    Schema.makeFilter((props: Readonly<Record<string, unknown>>) => {
      const violation = Object.entries(props)
        .flatMap(([key, value]) =>
          CLASS_LIST_PROP_KEYS.has(key) && typeof value === 'string'
            ? [validateTailwindClassList(value)]
            : []
        )
        .find((result) => result !== true)
      return violation ?? true
    })
  )
)

/** @public */
export type ComponentPropValue = Schema.Schema.Type<typeof ComponentPropValueSchema>
/** @public */
export type ComponentProps = Schema.Schema.Type<typeof ComponentPropsSchema>
