/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * View Fields Schema
 *
 * Array of field names to include in the view.
 * Fields are included in the order specified.
 *
 * @example
 * ```typescript
 * ['name', 'email', 'created_at']
 * ```
 */
export const ViewFieldsSchema = Schema.Array(Schema.String).pipe(
  Schema.annotations({
    title: 'View Fields',
    description: 'Array of field names to include in the view.',
  })
)

export type ViewFields = Schema.Schema.Type<typeof ViewFieldsSchema>
