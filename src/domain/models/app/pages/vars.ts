/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const PageVarsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
}).pipe(
  Schema.annotations({
    identifier: 'PageVars',
    title: 'Page Variables',
    description:
      'Key-value variables for substitution in page sections. Values can be strings, numbers, or booleans.',
  })
)

export type PageVars = Schema.Schema.Type<typeof PageVarsSchema>
