/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from '@/domain/models/shared/permissions'

export const FormAccessSchema = Schema.Struct({
  require: PermissionValueSchema,
  redirectTo: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^\//, {
        message: () => 'Redirect path must start with /',
      })
    ).annotations({
      description: 'URL path to redirect unauthenticated/unauthorized submitters',
      examples: ['/login', '/signup'],
    })
  ),
}).annotations({
  identifier: 'FormAccess',
  title: 'Form Access',
  description: 'Access control for a form. Reuses the shared permission model.',
})

export type FormAccess = Schema.Schema.Type<typeof FormAccessSchema>
