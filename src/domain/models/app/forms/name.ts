/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const FormNameSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(64),
  Schema.pattern(/^[a-z][a-z0-9-]*$/, {
    message: () =>
      'Form name must be kebab-case: start with a lowercase letter, contain only lowercase letters, digits, and hyphens',
  }),
  Schema.annotations({
    identifier: 'FormName',
    title: 'Form Name',
    description: 'Kebab-case unique form name (1-64 chars, ^[a-z][a-z0-9-]*$)',
    examples: ['contact', 'support-request', 'lead-capture'],
  })
)

export type FormName = Schema.Schema.Type<typeof FormNameSchema>
