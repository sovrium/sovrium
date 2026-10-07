/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { buildComponentUnion } from '../pages/components/component-types'
import { ComponentChildrenSchema, ComponentSlotSchema } from './children'
import { ComponentGuidanceSchema } from './guidance'
import { ComponentReferenceNameSchema } from './reference'

/**
 * Component template name identifier (same pattern as component reference name)
 *
 * Must be in kebab-case:
 * - Start with lowercase letter
 * - Contain only lowercase letters, numbers, and hyphens
 * - Names the placed template's root: `data-component="{name}"`, and
 *   `data-testid="component-{name}"` (with an index suffix when the template is
 *   placed more than once) unless the template's own `props` declare a
 *   `data-testid`, which wins
 *
 * @example
 * ```typescript
 * const names = ['icon-badge', 'section-header', 'feature-card', 'cta-button-2']
 * ```
 */
export const ComponentTemplateNameSchema = ComponentReferenceNameSchema.annotate({
  title: 'Component Template Name',
  description:
    'Unique component template identifier in kebab-case. A placed template\'s root carries `data-testid="component-<name>"` (with an index suffix when it is placed more than once) unless its own `props` declare a `data-testid`, which wins.',
  examples: ['icon-badge', 'section-header', 'feature-card', 'cta-button-2'],
})

/**
 * Reusable UI component template with variable placeholders
 *
 * A component template defines the structure of a reusable component that can be
 * instantiated multiple times with different data via component references.
 *
 * Uses a discriminated union: each component type only accepts properties
 * relevant to its category (e.g., data-table accepts columns but not chartType).
 *
 * Required properties:
 * - name: Unique identifier (kebab-case)
 * - type: Component type (discriminated by category)
 *
 * Optional properties:
 * - props: Component properties (may contain $variable placeholders)
 * - children: Nested child components, or `$children` — the slot a placing
 *   reference fills with the page's own components (see `ComponentSlotSchema`)
 * - content: Text content (may contain $variable placeholders)
 * - guidance: What it is, when to reach for it, and the misuse to refuse
 *
 * `guidance` is injected here rather than into the per-type field records
 * because it is a property of the TEMPLATE, not of any component type: an
 * inline `{ type: 'badge' }` inside a page has no name to be documented under
 * and nothing to say beside a specimen. It sits alongside `name` for exactly
 * that reason — the two are the pair that makes a component template a
 * REUSABLE, referenceable thing rather than a one-off node.
 *
 * @example
 * ```typescript
 * const component = {
 *   name: 'icon-badge',
 *   type: 'badge',
 *   props: { color: '$color' },
 *   children: [
 *     { type: 'icon', props: { name: '$icon', size: 4 } },
 *     { type: 'text', props: { level: 'span' }, content: '$text' }
 *   ]
 * }
 * ```
 *
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Discriminated union with recursive children requires any
export const ComponentTemplateSchema: Schema.Codec<any, any, never> = buildComponentUnion(
  {
    // `$children` here makes the template's root itself the slot: the template
    // is then a frame — its own type, props and classes — around the page's
    // components, with nothing of its own inside.
    children: Schema.optional(
      Schema.Union([ComponentChildrenSchema, ComponentSlotSchema]).annotate({
        description:
          "The template's child elements — components or text strings, with `$variable` placeholders — or `$children`, which makes the template's root its slot: a frame around the page components a placement passes as `children`.",
      })
    ),
  },
  {
    name: ComponentTemplateNameSchema,
    guidance: Schema.optional(ComponentGuidanceSchema),
  }
).pipe(
  Schema.annotate({
    title: 'Component Template',
    description: 'A reusable UI component template with variable placeholders',
  })
)

/** @public */
export type ComponentTemplateName = Schema.Schema.Type<typeof ComponentTemplateNameSchema>
export type ComponentTemplate = Schema.Schema.Type<typeof ComponentTemplateSchema>
