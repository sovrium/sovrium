/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * View Field Configuration Schema
 *
 * Configuration for field visibility and width in the view.
 *
 * @example
 * ```typescript
 * { field: 'name', visible: true, width: 200 }
 * { field: 'email', visible: true, width: 250 }
 * { field: 'notes', visible: false }
 * ```
 */
export const ViewFieldConfigSchema = Schema.Struct({
  field: Schema.String,
  visible: Schema.optional(Schema.Boolean),
  width: Schema.optional(Schema.Number),
}).pipe(
  Schema.annotations({
    title: 'View Field Configuration',
    description: 'Configuration for field visibility and display width in the view.',
  })
)

export type ViewFieldConfig = Schema.Schema.Type<typeof ViewFieldConfigSchema>
