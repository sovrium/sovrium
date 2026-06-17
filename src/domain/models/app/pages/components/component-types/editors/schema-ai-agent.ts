/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { InlinePrefillSchema } from '../data/form'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const SchemaAiAgentTypeLiteral = Schema.Literal('schema-ai-agent')

export const schemaAiAgentFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  agent: Schema.optional(
    Schema.String.annotations({
      description: 'Agent name from app.agents[] that drives the config authoring conversation',
    })
  ),
  submitToTable: Schema.optional(
    Schema.String.annotations({
      description:
        'Table slug the agent-proposed config is submitted to (e.g. "config_submissions")',
    })
  ),
  configField: Schema.optional(
    Schema.String.annotations({
      description: 'Column on the submit table that stores the agent-authored config',
    })
  ),
  formatField: Schema.optional(
    Schema.String.annotations({
      description:
        'Column on the submit table that stores the editor format discriminant ("agent")',
    })
  ),
  placeholder: Schema.optional(
    Schema.String.annotations({ description: 'Placeholder text for the agent chat input' })
  ),
  initialValue: Schema.optional(
    Schema.String.annotations({
      description: 'Initial config the agent reasons from (e.g. "$record.config")',
    })
  ),
  chatHeight: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Agent conversation container height in pixels' })
    )
  ),
  inlinePrefill: Schema.optional(InlinePrefillSchema),
} as const
