/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ActionTemplateVariablesSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).pipe(
  Schema.annotations({
    identifier: 'ActionTemplateVariables',
    title: 'Action Template Variables',
    description: 'Variable declarations with default values. Override via $vars when referenced.',
  })
)

export type ActionTemplateVariables = Schema.Schema.Type<typeof ActionTemplateVariablesSchema>
