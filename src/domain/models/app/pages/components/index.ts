/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentReferenceSchema } from '../../components/reference'
import { buildComponentUnion, ComponentTypeSchema } from './component-types'

export { ComponentTypeSchema }

/**
 * Page component item - either a direct component or a component reference
 *
 * Page components support three patterns:
 * 1. Direct component: Inline definition with type, props, children, etc.
 * 2. Simple component reference: Reference by name with { component: 'name' }
 * 3. Component reference with vars: Reference with variable substitution { $ref: 'name', vars: {} }
 *
 * This hybrid approach enables:
 * - Quick prototyping with inline components
 * - Reusability through component references
 * - Flexibility to mix all patterns
 *
 * @example
 * ```typescript
 * const components = [
 *   // Direct component
 *   {
 *     type: 'section',
 *     props: { id: 'hero' },
 *     children: [
 *       { type: 'text', content: 'Welcome' }
 *     ]
 *   },
 *   // Simple component reference
 *   {
 *     component: 'shared-component'
 *   },
 *   // Component reference with variables
 *   {
 *     $ref: 'section-header',
 *     vars: {
 *       title: 'Our Features',
 *       subtitle: 'Everything you need'
 *     }
 *   }
 * ]
 * ```
 */
export const PageComponentItemSchema = Schema.Union(
  Schema.suspend(() => ComponentSchema).pipe(
    Schema.annotations({
      identifier: 'PageComponent',
    })
  ),
  ComponentReferenceSchema
).annotations({
  title: 'Page Component Item',
  description:
    'A page component that can be either a direct component or component reference (with optional variables)',
})

/**
 * Direct component definition for page components
 *
 * Uses a discriminated union: each component type only accepts properties
 * relevant to its category (e.g., data-table accepts columns but not chartType).
 *
 * A component can be either inline (direct definition) or referenced (component template).
 * Direct components allow full customization without creating a reusable component template.
 *
 * Required properties:
 * - type: Component type (discriminated by category)
 *
 * Optional properties:
 * - props: Component properties (className, id, style, etc.)
 * - children: Nested child components (recursive, unlimited depth)
 * - content: Text content (for text components)
 * - interactions: Interactive behaviors (hover, click, scroll, entrance)
 * - responsive: Breakpoint-specific overrides for responsive design
 *
 * @example
 * ```typescript
 * const component = {
 *   type: 'section',
 *   props: {
 *     id: 'hero',
 *     className: 'min-h-screen bg-gradient'
 *   },
 *   children: [
 *     {
 *       type: 'text',
 *       props: { level: 'h1' },
 *       content: 'Welcome'
 *     }
 *   ],
 *   interactions: {
 *     entrance: { animation: 'fadeIn' }
 *   },
 *   responsive: {
 *     md: {
 *       props: { className: 'min-h-screen bg-gradient-2xl' }
 *     }
 *   }
 * }
 * ```
 *
 * @see specs/app/pages/components/sections.schema.json
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Recursive schema with suspended types requires any for circular reference resolution
export const ComponentSchema: Schema.Schema<any, any, never> = buildComponentUnion({
  children: Schema.optional(
    Schema.Array(
      Schema.Union(
        Schema.suspend(() => PageComponentItemSchema).pipe(
          Schema.annotations({
            identifier: 'PageComponentItem',
          })
        ),
        Schema.String
      )
    ).pipe(
      Schema.annotations({
        identifier: 'Children',
        title: 'Child Components',
        description: 'Array of child components or text strings',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Component',
    description: 'Direct component definition',
  })
)

/**
 * Array of page components
 *
 * The main content structure for pages, consisting of stacked components.
 * Each component can be nested arbitrarily deep through the children array.
 *
 * Page components enable:
 * - Component composition (nest components to build layouts)
 * - Reusability (reference components with $ref)
 * - Responsive design (override props per breakpoint)
 * - Interactivity (add hover, click, scroll, entrance behaviors)
 *
 * @example
 * ```typescript
 * const components = [
 *   {
 *     type: 'section',
 *     props: {
 *       id: 'hero',
 *       className: 'min-h-screen bg-gradient'
 *     },
 *     children: [
 *       {
 *         type: 'container',
 *         props: { maxWidth: 'max-w-7xl' },
 *         children: [
 *           {
 *             type: 'text',
 *             props: {
 *               level: 'h1',
 *               className: 'text-6xl font-bold'
 *             },
 *             content: 'Welcome to Our Platform'
 *           }
 *         ]
 *       }
 *     ]
 *   },
 *   {
 *     $ref: 'section-header',
 *     vars: {
 *       title: 'Our Features',
 *       subtitle: 'Everything you need to succeed'
 *     }
 *   }
 * ]
 * ```
 *
 * @see specs/app/pages/components/sections.schema.json
 */
export const PageComponentsSchema = Schema.Array(PageComponentItemSchema).annotations({
  title: 'Page Components',
  description: 'Array of page components',
})

/** @public */
export type ComponentType = Schema.Schema.Type<typeof ComponentTypeSchema>
export type Component = Schema.Schema.Type<typeof ComponentSchema>
/** @public */
export type PageComponentItem = Schema.Schema.Type<typeof PageComponentItemSchema>
/** @public */
export type PageComponents = Schema.Schema.Type<typeof PageComponentsSchema>
