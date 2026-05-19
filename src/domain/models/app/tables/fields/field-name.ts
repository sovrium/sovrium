/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { createDatabaseIdentifierSchema } from '@/domain/validators/database-identifier'

export const FieldNameSchema = createDatabaseIdentifierSchema('field').pipe(
  Schema.annotations({
    title: 'Field Name',
    description:
      'Internal identifier name for database columns following PostgreSQL naming conventions. Must start with a letter, contain only lowercase letters, numbers, and underscores, maximum 63 characters.',
    examples: ['email', 'person_status', 'invoice_item', 'customer_email', 'created_at'],
  })
)

export type FieldName = Schema.Schema.Type<typeof FieldNameSchema>
