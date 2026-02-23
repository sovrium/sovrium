/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentTemplateSchema } from './component/component'

/**
 * Array of reusable UI component templates
 *
 * Components provide a library that can be referenced across pages
 * using the $ref pattern. Each component defines a template with variable
 * placeholders ($variable) that are substituted when the component is instantiated.
 *
 * Benefits:
 * - DRY: Define once, reuse multiple times
 * - Consistency: Centralized updates affect all instances
 * - Maintainability: Single source of truth for UI patterns
 *
 * @example
 * ```typescript
 * const components = [
 *   {
 *     name: 'icon-badge',
 *     type: 'badge',
 *     props: { color: '$color' },
 *     children: [
 *       { type: 'icon', props: { name: '$icon' } },
 *       { type: 'text', content: '$text' }
 *     ]
 *   },
 *   {
 *     name: 'section-header',
 *     type: 'container',
 *     props: { className: 'text-center mb-12' },
 *     children: [
 *       { type: 'text', props: { level: 'h2' }, content: '$title' },
 *       { type: 'text', props: { level: 'p' }, content: '$subtitle' }
 *     ]
 *   }
 * ]
 * ```
 *
 * @see specs/app/components/components.schema.json
 */
export const ComponentsSchema = Schema.Array(ComponentTemplateSchema).pipe(
  Schema.filter((components) => {
    const names = components.map((component) => component.name)
    const uniqueNames = new Set(names)
    return (
      names.length === uniqueNames.size ||
      'Component names must be unique within the components array'
    )
  }),
  Schema.annotations({
    title: 'Reusable Components',
    description:
      'Array of reusable UI component templates with variable substitution for use across pages',
  })
)

export type Components = Schema.Schema.Type<typeof ComponentsSchema>
