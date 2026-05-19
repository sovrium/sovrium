/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AiAgentActionSchema } from './agent'
import { AiClassifyActionSchema } from './classify'
import { AiExtractActionSchema } from './extract'
import { AiGenerateActionSchema } from './generate'

export const AiActionSchema = Schema.Union(
  AiGenerateActionSchema,
  AiClassifyActionSchema,
  AiExtractActionSchema,
  AiAgentActionSchema
).pipe(
  Schema.annotations({
    identifier: 'AiAction',
    title: 'AI Action',
    description:
      'AI/LLM operations: text generation, classification, structured extraction, and agent task delegation',
  })
)

export type AiAction = Schema.Schema.Type<typeof AiActionSchema>

export * from './agent'
export * from './classify'
export * from './extract'
export * from './generate'
