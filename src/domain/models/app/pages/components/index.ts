/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentReferenceSchema, type ComponentReference } from '../../components/reference'
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
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Recursive schema with suspended types requires any for circular reference resolution; see the `Component` docblock for the measured cost of narrowing this
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
 */
export const PageComponentsSchema = Schema.Array(PageComponentItemSchema).annotations({
  title: 'Page Components',
  description: 'Array of page components',
})

/** @public */
export type ComponentType = Schema.Schema.Type<typeof ComponentTypeSchema>
/**
 * Decoded shape of a direct page component — **`any` today**, because
 * `ComponentSchema` is annotated `Schema.Schema<any, any, never>`.
 *
 * That is a real hole: `component.thisKeyDoesNotExistAnywhere` compiles, which
 * is why three separate data-table drifts (`views` never reaching the island,
 * `autoSave` absent from the type, `defaultSort` typed but never decoded) each
 * cost a full RED cycle instead of a compile error.
 *
 * {@link TypedComponent} is the closed replacement, derived mechanically from
 * the same `allComponents` tuple the decoder iterates, and proven to reject
 * unknown keys by `index.test.ts`. Re-pointing THIS alias at it is measured at
 * **179 TypeScript errors across 32 files** (re-measured Wave I; 245 before the
 * per-type props dispatch below was typed). The bulk are not typos: they are
 * the recursive page walkers — `data-source-resolver.ts`, `component-renderer`,
 * `render-page` — which spread and rewrite a component without caring what type
 * it is, and which TypeScript cannot re-assign to a discriminated union without
 * a cast per rewrite seam (microsoft/TypeScript#30581).
 *
 * WHAT ALREADY HAS THE GUARD, without this alias moving: any signature naming
 * {@link ComponentOfType} gets that ONE branch, checked. `TYPE_BUILDERS` in
 * `type-specific-props-builder.ts` is keyed that way, which is where all three
 * bugs above actually lived — a data-table prop that the schema does not
 * declare no longer compiles there, and the four dead reads that conversion
 * surfaced are gone.
 *
 * WHEN FINISHING IT: annotate `ComponentSchema` as
 * `Schema.Schema<TypedComponent, any, never>` and re-point this alias. The
 * Encoded side must stay `any` — `buildComponentUnion` returns
 * `Schema.Schema<any, any, never>` because the 89-branch union exceeds the
 * .d.ts serialization limit (TS7056).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above; TypedComponent is the closed replacement
export type Component = any

/**
 * The shape {@link Component} will have once the rendering layer narrows.
 *
 * Exported so new code can opt into it today — via {@link ComponentOfType},
 * which every per-type dispatch table should key on — and so the guard test can
 * prove it rejects unknown keys. Deriving it costs nothing at runtime: it is
 * read off the same `allComponents` tuple `buildComponentUnion` iterates, so it
 * cannot drift from what actually decodes.
 */
export type TypedComponent = WithPageChildren<ComponentUnion>

/**
 * The single component branch whose discriminant is `K` — e.g.
 * `ComponentOfType<'data-table'>` carries `columns`, `views` and `autoSave`,
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
