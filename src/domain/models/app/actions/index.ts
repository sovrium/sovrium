/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AiAccessSchema } from '@/domain/models/shared/ai-access'
import { ActionSchema } from './action'
import { ActionTemplateVariablesSchema } from './variables'

export const ActionTemplateSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9-]*$/),
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.annotations({
      description: 'Unique action template name for $ref referencing (kebab-case)',
    })
  ),

  action: ActionSchema,

  variables: Schema.optional(ActionTemplateVariablesSchema),

  aiAccess: Schema.optional(AiAccessSchema),
}).pipe(
  Schema.annotations({
    identifier: 'ActionTemplate',
    title: 'Reusable Action Template',
    description: 'Preconfigured action template reusable across automations via $ref',
  })
)

export type ActionTemplate = Schema.Schema.Type<typeof ActionTemplateSchema>

const RESERVED_TEMPLATE_NAMES: ReadonlySet<string> = new Set(['ref'])

export const ActionTemplatesSchema = Schema.Array(ActionTemplateSchema).pipe(
  Schema.annotations({
    identifier: 'ActionTemplates',
    title: 'Reusable Action Templates',
    description:
      'Library of preconfigured action templates reusable across automations via $ref pattern',
  }),
  Schema.filter((templates) => {
    const names = templates.map((t) => t.name)
    const uniqueNames = new Set(names)
    if (names.length !== uniqueNames.size) return 'Action template names must be unique'
    const reserved = names.find((n) => RESERVED_TEMPLATE_NAMES.has(n))
    if (reserved !== undefined) {
      return `Action template name '${reserved}' is reserved (collides with the runtime context.actions.${reserved}() method exposed to code action bodies). Rename the template.`
    }
    return true
  })
)

export type ActionTemplates = Schema.Schema.Type<typeof ActionTemplatesSchema>
