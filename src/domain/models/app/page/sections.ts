/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BlockReferenceSchema } from '../block/common/block-reference'
import { InteractionsSchema } from './common/interactions/interactions'
import { PropsSchema } from './common/props'
import { ResponsiveSchema } from './common/responsive'

/**
 * Component type enum for page sections
 *
 * Comprehensive set of component types for building pages:
 * - Layout: section, container, flex, grid, div, modal, sidebar, hero, navigation, header, footer, main, article, aside, nav
 * - Content: text, heading, paragraph, h1, h2, h3, h4, h5, h6, icon, image, avatar, customHTML, span, p, code, pre
 * - Interactive: button, link, a, accordion, dropdown
 * - Grouping: card, badge, timeline, list-item, speech-bubble, card-with-header, card-header, card-body, card-footer
 * - Media: video, audio, iframe
 * - Forms: form, input
 * - Feedback: toast, spinner, alert
 * - UI Elements: fab (floating action button), list
 */
export const ComponentTypeSchema = Schema.Literal(
  'section',
  'container',
  'flex',
  'grid',
  'card',
  'card-with-header',
  'card-header',
  'card-body',
  'card-footer',
  'text',
  'heading',
  'paragraph',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'icon',
  'image',
  'img',
  'avatar',
  'button',
  'link',
  'a',
  'timeline',
  'accordion',
  'badge',
  'speech-bubble',
  'customHTML',
  'video',
  'audio',
  'iframe',
  'form',
  'input',
  'div',
  'span',
  'modal',
  'sidebar',
  'toast',
  'hero',
  'hero-section',
  'fab',
  'spinner',
  'list',
  'list-item',
  'dropdown',
  'navigation',
  'alert',
  'p',
  'code',
  'pre',
  'header',
  'footer',
  'main',
  'article',
  'aside',
  'nav',
  'responsive-grid'
).annotations({
  description: 'Component type for page building',
})

/**
 * Direct component definition for page sections
 *
 * A component can be either inline (direct definition) or referenced (block).
 * Direct components allow full customization without creating a reusable block.
 *
 * Required properties:
 * - type: Component type (17 options)
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
 * @see specs/app/pages/sections/sections.schema.json
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ComponentSchema: Schema.Schema<any, any, never> = Schema.Struct({
  type: ComponentTypeSchema,
  props: Schema.optional(PropsSchema),
  children: Schema.optional(
    Schema.Array(
      Schema.Union(
        Schema.suspend(() => SectionItemSchema).pipe(
          Schema.annotations({
            identifier: 'SectionItem',
          })
        ),
        Schema.String
      )
    ).pipe(
      Schema.annotations({
        identifier: 'Children',
        description: 'Array of child components or text strings',
      })
    )
  ),
  content: Schema.optional(
    Schema.Union(
      Schema.String,
      Schema.Record({ key: Schema.String, value: Schema.Unknown })
    ).annotations({
      description:
        'Text content for text components, or structured content object (e.g., { button: { text, animation } })',
    })
  ),
  interactions: Schema.optional(InteractionsSchema),
  responsive: Schema.optional(ResponsiveSchema),
  i18n: Schema.optional(
    Schema.Record({
      key: Schema.String.pipe(
        Schema.pattern(/^[a-z]{2}(-[A-Z]{2})?$/, {
          message: () => 'Language code must be ISO 639-1 format (e.g., en-US, fr-FR)',
        })
      ),
      value: Schema.Struct({
        content: Schema.optional(
          Schema.String.annotations({
            description: 'Translated content text',
          })
        ),
        props: Schema.optional(PropsSchema),
      }),
    }).annotations({
      description: 'Localized translations per language for this component',
    })
  ),
}).annotations({
  description: 'Direct component definition',
})

/**
 * Section item - either a direct component or a block reference
 *
 * Sections support three patterns:
 * 1. Direct component: Inline definition with type, props, children, etc.
 * 2. Simple block reference: Reference by name with { block: 'name' }
 * 3. Block reference with vars: Reference with variable substitution { $ref: 'name', vars: {} }
 *
 * This hybrid approach enables:
 * - Quick prototyping with inline components
 * - Reusability through block references
 * - Flexibility to mix all patterns
 *
 * @example
 * ```typescript
 * const sections = [
 *   // Direct component
 *   {
 *     type: 'section',
 *     props: { id: 'hero' },
 *     children: [
 *       { type: 'text', content: 'Welcome' }
 *     ]
 *   },
 *   // Simple block reference
 *   {
 *     block: 'shared-block'
 *   },
 *   // Block reference with variables
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
export const SectionItemSchema = Schema.Union(ComponentSchema, BlockReferenceSchema).annotations({
  description:
    'A page section that can be either a component or block reference (with optional variables)',
})

/**
 * Array of page content sections
 *
 * The main content structure for pages, consisting of stacked sections.
 * Each section can be nested arbitrarily deep through the children array.
 *
 * Sections enable:
 * - Component composition (nest components to build layouts)
 * - Reusability (reference blocks with $ref)
 * - Responsive design (override props per breakpoint)
 * - Interactivity (add hover, click, scroll, entrance behaviors)
 *
 * @example
 * ```typescript
 * const sections = [
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
 * @see specs/app/pages/sections/sections.schema.json
 */
export const SectionsSchema = Schema.Array(SectionItemSchema).annotations({
  title: 'Page Sections',
  description: 'Array of page content sections',
})

export type ComponentType = Schema.Schema.Type<typeof ComponentTypeSchema>
export type Component = Schema.Schema.Type<typeof ComponentSchema>
export type SectionItem = Schema.Schema.Type<typeof SectionItemSchema>
export type Sections = Schema.Schema.Type<typeof SectionsSchema>
