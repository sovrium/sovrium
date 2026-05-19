/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from '@/domain/models/shared/permissions'

const AccessPermissionSchema = PermissionValueSchema

export const PageAccessExtendedSchema = Schema.Struct({
  require: AccessPermissionSchema,
  redirectTo: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^\//, {
        message: () => 'Redirect path must start with /',
      })
    ).annotations({
      description: 'URL path to redirect unauthenticated/unauthorized users',
      examples: ['/login', '/signup', '/403'],
    })
  ),
}).annotations({
  title: 'Page Access Extended',
  description: 'Extended access configuration with redirect support',
})

export const PageAccessSchema = Schema.Union(AccessPermissionSchema, PageAccessExtendedSchema).pipe(
  Schema.annotations({
    identifier: 'PageAccess',
    title: 'Page Access',
    description:
      "Page access control. 'all' (public), 'authenticated' (logged-in), role array ['admin'], or extended { require, redirectTo }.",
    examples: [
      'all',
      'authenticated',
      ['admin'],
      { require: 'authenticated', redirectTo: '/login' },
    ],
  })
)

export type PageAccess = Schema.Schema.Type<typeof PageAccessSchema>
export type PageAccessExtended = Schema.Schema.Type<typeof PageAccessExtendedSchema>
