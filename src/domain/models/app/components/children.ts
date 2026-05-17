/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { buildComponentUnion } from '../pages/components/component-types'

/**
 * Component Children (child elements array for component templates)
 *
 * Array of component elements or strings that can be nested recursively.
 * Each child can be:
 * - ComponentChildElement: Component with type, optional props, optional nested children, and optional content
 * - String: Direct text content or variable placeholder (e.g., '$title', 'Static text')
 *
 * This enables building complex component hierarchies with variable substitution.
 *
 * @example
 * ```typescript
 * const children = [
 *   {
 *     type: 'icon',
 *     props: {
 *       name: '$icon',
 *       color: '$color',
 *     },
 *   },
 *   {
 *     type: 'text',
 *     content: '$label',
 *   },
 *   '$title', // Direct string (can be variable or static text)
 * ]
 * ```
 *
 * @see specs/app/components/common/component-children.schema.json
 */
export const ComponentChildrenSchema: Schema.Schema<
  ReadonlyArray<unknown>,
  ReadonlyArray<unknown>,
  never
> = Schema.Array(
  Schema.Union(
    Schema.suspend(() => ComponentChildElementSchema).pipe(
      Schema.annotations({
        identifier: 'ComponentChildElement',
      })
    ),
    Schema.String
  )
).pipe(
  Schema.annotations({
    title: 'Component Children',
    description: 'Child elements array for component templates (components or strings)',
  })
)

/**
 * Component Child Element (component in a component template)
 *
 * Represents a single component element with:
 * - type: Component type (required, discriminated by category)
 * - props: Component properties (optional)
 * - children: Nested child elements (optional, recursive)
 * - content: Text content with $variable support (optional)
 *
 * Uses a discriminated union: each component type only accepts properties
 * relevant to its category (e.g., data-table accepts columns but not chartType).
 *
 * Note: This schema is recursive - children can contain more ComponentChildElement objects.
 *
 * @example
 * ```typescript
 * const iconChild = {
 *   type: 'icon',
 *   props: {
 *     name: '$icon',
 *     color: '$color',
 *   },
 * }
 *
 * const textChild = {
 *   type: 'text',
 *   content: '$label',
 * }
 *
 * const containerChild = {
 *   type: 'div',
 *   props: { className: 'flex gap-2' },
 *   children: [iconChild, textChild],
 * }
 * ```
 *
 * @see specs/app/components/common/component-children.schema.json#/items
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Recursive schema with suspended children requires any for circular reference resolution
export const ComponentChildElementSchema: Schema.Schema<any, any, never> = buildComponentUnion({
  children: Schema.optional(
    Schema.suspend(() => ComponentChildrenSchema).pipe(
      Schema.annotations({
        identifier: 'ComponentChildren',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Component Child Element',
    description: 'Component element in a component template',
  })
)

/** @public */
export type ComponentChildElement = Schema.Schema.Type<typeof ComponentChildElementSchema>
/** @public */
export type ComponentChildren = Schema.Schema.Type<typeof ComponentChildrenSchema>
