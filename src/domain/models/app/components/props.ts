/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ComponentPropValueSchema: Schema.Schema<
  string | number | boolean | Record<string, unknown> | readonly unknown[]
> = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  Schema.Array(Schema.Unknown)
)

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
