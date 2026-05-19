/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ViewFieldsSchema = Schema.Array(Schema.String).pipe(
  Schema.annotations({
    title: 'View Fields',
    description: 'Array of field names to include in the view.',
  })
)

export type ViewFields = Schema.Schema.Type<typeof ViewFieldsSchema>
