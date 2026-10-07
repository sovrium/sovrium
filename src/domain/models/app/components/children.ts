/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { buildComponentUnion } from '../pages/components/component-types'

/**
 * The slot marker: `children: $children` on one node of a component template.
 *
 * Written IN PLACE of a node's `children` list, it says "the page's own
 * components go here": a reference that places the template passes them as its
 * `children`, and they are drawn at this position, read in the page's scope.
 * A template holds at most one slot, at any depth of its tree; a placement
 * that passes `children` to a template without one is refused, so nothing a
 * page writes is dropped in silence.
 *
 * A string literal rather than a `{ slot: true }` node so the marker reads as
 * what it is in YAML (`children: $children`) and needs no new component type:
 * the node that holds it keeps its own type, props and classes, and the slot
 * is simply where its children come from.
 *
 * @example
 * ```typescript
 * const shell = {
 *   name: 'app-shell',
 *   type: 'flex',
 *   children: [
 *     { type: 'sidebar', groups: [] },
 *     { type: 'container', element: 'main', children: '$children' },
 *   ],
 * }
 * ```
 */
export const ComponentSlotSchema = Schema.Literal('$children').pipe(
  Schema.annotate({
    title: 'Component Slot',
    description:
      "Marks the template's slot: written as `children: $children` on one node, it is replaced by the `children` the placing reference passes — the page's own components, read in the page's scope. At most one per template; the template's `vars` never reach the slotted components.",
  })
)

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
 */
export const ComponentChildrenSchema: Schema.Codec<
  ReadonlyArray<unknown>,
  ReadonlyArray<unknown>,
  never
> = Schema.Array(
  Schema.Union([
    Schema.suspend(() => ComponentChildElementSchema).pipe(
      Schema.annotate({
        identifier: 'ComponentChildElement',
      })
    ),
    Schema.String,
  ])
).pipe(
  Schema.annotate({
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
 * @see [internal ref]#/items
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Recursive schema with suspended children requires any for circular reference resolution
export const ComponentChildElementSchema: Schema.Codec<any, any, never> = buildComponentUnion({
  children: Schema.optional(
    Schema.Union([
      Schema.suspend(() => ComponentChildrenSchema).pipe(
        Schema.annotate({
          identifier: 'ComponentChildren',
          description:
            'Child elements nested inside this one, recursive to any depth. A template child is a component or a text string; unlike a page child it cannot be a `$ref`, because a template is itself what a `$ref` resolves to.',
        })
      ),
      ComponentSlotSchema,
    ]).annotate({
      description:
        "Child elements nested inside this one, recursive to any depth — components or text strings — or `$children`, which makes this node the template's slot: the page components a placement passes as `children` are drawn here.",
    })
  ),
}).pipe(
  Schema.annotate({
    title: 'Component Child Element',
    description: 'Component element in a component template',
  })
)

/** @public */
export type ComponentChildElement = Schema.Schema.Type<typeof ComponentChildElementSchema>
/** @public */
export type ComponentChildren = Schema.Schema.Type<typeof ComponentChildrenSchema>
/** @public */
export type ComponentSlot = Schema.Schema.Type<typeof ComponentSlotSchema>
