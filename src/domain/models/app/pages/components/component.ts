/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  buildComponentReferenceSchema,
  type ComponentReference,
  type ComponentReferenceChildrenSchema,
} from '../../components/reference'
import { buildComponentUnion, ComponentTypeSchema, type ComponentUnion } from './component-types'

export { ComponentTypeSchema }

/**
 * The `children` half of a page component's shape.
 *
 * Spelled here rather than in {@link ComponentUnion} because
 * {@link buildComponentUnion} injects `children` per consumer and only onto
 * container types — page children accept `$ref`, template children do not.
 *
 * Written recursively against `Component` rather than derived from
 * `PageComponentItemSchema`: that schema's type is INFERRED from
 * `ComponentSchema`, so deriving from it would make `Component` reference its
 * own initializer and collapse back to `any` — the exact hole this type closes.
 *
 * Must be an `interface`, not an inline object literal. TypeScript resolves an
 * interface's members lazily but a type alias's eagerly, so inlining this shape
 * into {@link WithPageChildren} makes `Component` self-referential during
 * resolution and fails with TS2456 (`Type alias 'Component' circularly
 * references itself`) — observed, not theorised.
 */
interface PageChildren {
  readonly children?: ReadonlyArray<Component | ComponentReference | string>
}

/**
 * Attach {@link PageChildren} to every branch of the component union.
 *
 * Distributed (`T extends unknown ? … : never`) so `children` lands on each
 * branch individually and `type`-discriminated narrowing keeps working; a
 * non-distributed `Union & PageChildren` would not narrow.
 */
type WithPageChildren<T> = T extends unknown ? T & PageChildren : never

/**
 * One member of a page node's `children`: a page component or a reference. The
 * identifier is set ONCE, on this instance, so the JSON Schema rendering names
 * one definition however many lists hold it.
 */
const PageComponentItemMember = Schema.suspend(() => PageComponentItemSchema).pipe(
  Schema.annotate({
    identifier: 'PageComponentItem',
  })
)

/**
 * The member list a page node's `children` holds — page components, references
 * and text. Two consumers hold it: a direct component's `children`, and a
 * reference's `children`, which fill the template's `$children` slot. Built per
 * consumer so each carries its own description.
 */
const pageChildItems = (): ComponentReferenceChildrenSchema =>
  Schema.Array(Schema.Union([PageComponentItemMember, Schema.String]))

/**
 * A placement of a component template on a page, in any of its four forms,
 * with the page components that fill the template's `$children` slot.
 *
 * The one instance of {@link buildComponentReferenceSchema} the AppSchema
 * decodes — built here because the slot's members are page components.
 *
 * @example
 * ```typescript
 * const reference = {
 *   component: 'app-shell',
 *   children: [{ type: 'text', element: 'h1', content: 'Invoices' }],
 * }
 * ```
 */
export const ComponentReferenceSchema = buildComponentReferenceSchema(pageChildItems())

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
export const PageComponentItemSchema = Schema.Union([
  Schema.suspend(() => ComponentSchema).pipe(
    Schema.annotate({
      identifier: 'PageComponent',
    })
  ),
  Schema.suspend(() => ComponentReferenceSchema).pipe(
    Schema.annotate({
      identifier: 'ComponentReference',
    })
  ),
]).annotate({
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
 * Typed `Schema.Codec<TypedComponent, any, never>`. The ENCODED side stays
 * `any` for good: `buildComponentUnion` returns `Schema.Schema<any, any, never>`
 * because spelling the encoded half of the 89-branch union exceeds the .d.ts
 * serialization limit (TS7056). The DECODED side is the closed union, so a page
 * tree read off a decoded `App` is {@link TypedComponent}. The annotation is
 * compile-time only: the runtime decode is the same union either way.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- encoded side only: TS7056 (see above)
export const ComponentSchema: Schema.Codec<TypedComponent, any, never> = buildComponentUnion({
  children: Schema.optional(
    pageChildItems().pipe(
      Schema.annotate({
        identifier: 'Children',
        title: 'Child Components',
        description: 'Array of child components or text strings',
      })
    )
  ),
}).pipe(
  Schema.annotate({
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
 */
export const PageComponentsSchema = Schema.Array(PageComponentItemSchema).annotate({
  title: 'Page Components',
  description: 'Array of page components',
})

/** @public */
export type ComponentType = Schema.Schema.Type<typeof ComponentTypeSchema>
/**
 * Decoded shape of a direct page component: the closed component union, with
 * page `children` attached to every branch.
 *
 * A key the schema does not declare does not compile
 * (`component.thisKeyDoesNotExistAnywhere` is an error), and narrowing on
 * `type` yields that branch's props. To name ONE branch in a signature, use
 * {@link ComponentOfType}.
 */
export type Component = TypedComponent

/**
 * The closed component union that {@link Component} names.
 *
 * Read off the same `allComponents` tuple `buildComponentUnion` iterates, so it
 * cannot drift from what actually decodes; the guard test proves it rejects
 * unknown keys. Deriving it costs nothing at runtime.
 */
export type TypedComponent = WithPageChildren<ComponentUnion>

/**
 * The single component branch whose discriminant is `K` — e.g.
 * `ComponentOfType<'table'>` carries `columns`, `views` and `autoSave`,
 * and carries no `chartType`.
 *
 * Use it to name a branch in a signature, so a per-type builder or renderer is
 * checked against the schema that actually decodes rather than against `any`.
 * Inside a function body prefer plain narrowing (`if (c.type === 'chart')`) —
 * the compiler does it for free.
 */
export type ComponentOfType<K extends ComponentType> = Extract<TypedComponent, { readonly type: K }>
/** @public */
export type PageComponentItem = Schema.Schema.Type<typeof PageComponentItemSchema>
/** @public */
export type PageComponents = Schema.Schema.Type<typeof PageComponentsSchema>
