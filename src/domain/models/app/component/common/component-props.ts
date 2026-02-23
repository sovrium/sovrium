/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

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
 * @see specs/app/components/common/component-props.schema.json#/patternProperties/.../oneOf
 */
export const ComponentPropValueSchema: Schema.Schema<
  string | number | boolean | Record<string, unknown> | readonly unknown[]
> = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  Schema.Array(Schema.Unknown)
)

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
 * @see specs/app/components/common/component-props.schema.json
 */
export const ComponentPropsSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^([a-zA-Z][a-zA-Z0-9]*|data-[a-z]+(-[a-z]+)*|aria-[a-z]+(-[a-z]+)*)$/, {
      message: () =>
        'Property key must be camelCase (e.g., className, maxWidth) or kebab-case with data-/aria- prefix (e.g., data-testid, aria-label)',
    }),
    Schema.annotations({
      title: 'Component Prop Key',
      description:
        'Valid JavaScript property name (camelCase) or HTML data-*/aria-* attribute (kebab-case)',
      examples: ['className', 'size', 'enabled', 'maxWidth', 'data-testid', 'aria-label'],
    })
  ),
  value: ComponentPropValueSchema,
}).pipe(
  Schema.annotations({
    title: 'Component Props',
    description: 'Properties for component templates, supporting variable references',
  })
)

export type ComponentPropValue = Schema.Schema.Type<typeof ComponentPropValueSchema>
export type ComponentProps = Schema.Schema.Type<typeof ComponentPropsSchema>
