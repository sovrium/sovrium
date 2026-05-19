/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const FormOnErrorSchema = Schema.Struct({
  type: Schema.Literal('toast', 'message', 'errorPage'),
  message: Schema.String,
  title: Schema.optional(Schema.String),
  variant: Schema.optional(Schema.Literal('error', 'warning')),
}).annotations({
  identifier: 'FormOnError',
  title: 'Form onError',
  description: 'What to show when a form submission fails server-side',
})

export type FormOnError = Schema.Schema.Type<typeof FormOnErrorSchema>
