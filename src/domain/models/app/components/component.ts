/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { buildComponentUnion } from '../pages/components/component-types'
import { ComponentChildrenSchema } from './children'
import { ComponentReferenceNameSchema } from './reference'

export const ComponentTemplateNameSchema = ComponentReferenceNameSchema.annotations({
  title: 'Component Template Name',
  description: 'Unique component template identifier in kebab-case',
  examples: ['icon-badge', 'section-header', 'feature-card', 'cta-button-2'],
})

export const ComponentTemplateSchema: Schema.Schema<any, any, never> = buildComponentUnion(
  {
    children: Schema.optional(ComponentChildrenSchema),
  },
  {
    name: ComponentTemplateNameSchema,
  }
).pipe(
  Schema.annotations({
    title: 'Component Template',
    description: 'A reusable UI component template with variable placeholders',
  })
)

export type ComponentTemplateName = Schema.Schema.Type<typeof ComponentTemplateNameSchema>
export type ComponentTemplate = Schema.Schema.Type<typeof ComponentTemplateSchema>
