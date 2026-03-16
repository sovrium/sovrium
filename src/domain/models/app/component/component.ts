/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentChildrenSchema } from './common/component-children'
import { ComponentPropsSchema } from './common/component-props'
import { ComponentReferenceNameSchema } from './common/component-reference'

/**
 * Component template name identifier (same pattern as component reference name)
 *
 * Must be in kebab-case:
 * - Start with lowercase letter
 * - Contain only lowercase letters, numbers, and hyphens
 * - Used for data-testid generation: data-testid="component-{name}"
 *
 * @example
 * ```typescript
 * const names = ['icon-badge', 'section-header', 'feature-card', 'cta-button-2']
 * ```
 */
export const ComponentTemplateNameSchema = ComponentReferenceNameSchema.annotations({
  title: 'Component Template Name',
  description: 'Unique component template identifier in kebab-case',
  examples: ['icon-badge', 'section-header', 'feature-card', 'cta-button-2'],
})

/**
 * Reusable UI component template with variable placeholders
 *
 * A component template defines the structure of a reusable component that can be
 * instantiated multiple times with different data via component references.
 *
 * Required properties:
 * - name: Unique identifier (kebab-case)
 * - type: Component type (container, flex, grid, card, text, button, etc.)
 *
 * Optional properties:
 * - props: Component properties (may contain $variable placeholders)
 * - children: Nested child components
 * - content: Text content (may contain $variable placeholders)
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
 * @see specs/app/components/component/component.schema.json
 */
export const ComponentTemplateSchema = Schema.Struct({
  name: ComponentTemplateNameSchema,
  type: Schema.String.annotations({
    description: 'Component type',
    examples: ['container', 'flex', 'grid', 'card', 'text', 'button'],
  }),
  props: Schema.optional(ComponentPropsSchema),
  children: Schema.optional(ComponentChildrenSchema),
  content: Schema.optional(
    Schema.String.annotations({
      description: 'Text content (may contain $variable references)',
    })
  ),
}).annotations({
  title: 'Component Template',
  description: 'A reusable UI component template with variable placeholders',
})

export type ComponentTemplateName = Schema.Schema.Type<typeof ComponentTemplateNameSchema>
export type ComponentTemplate = Schema.Schema.Type<typeof ComponentTemplateSchema>
