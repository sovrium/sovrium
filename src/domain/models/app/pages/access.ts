/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from '@/domain/models/shared/permissions'

/**
 * Access permission value
 *
 * Uses the shared PermissionValueSchema — same 3-format system as tables,
 * buckets, automations, and agents.
 *
 * - `'all'` — Everyone (including unauthenticated users)
 * - `'authenticated'` — Any logged-in user
 * - `['admin', 'editor']` — Specific role names (array)
 */
const AccessPermissionSchema = PermissionValueSchema

/**
 * Extended page access with redirect configuration
 *
 * When access is denied, redirects to a specified path (e.g., login page).
 *
 * @example
 * ```yaml
 * access:
 *   require: authenticated
 *   redirectTo: /login
 * ```
 */
export const PageAccessExtendedSchema = Schema.Struct({
  /** Access requirement: 'all', 'authenticated', or role array */
  require: AccessPermissionSchema,
  /** Path to redirect when access is denied */
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

/**
 * Page Access Schema
 *
 * Controls who can access a page. Accepts three formats:
 *
 * 1. **Simple string**: `'all'` (public) or `'authenticated'` (logged-in users)
 * 2. **Role array**: `['admin', 'editor']` (specific roles)
 * 3. **Extended object**: `{ require: 'authenticated', redirectTo: '/login' }`
 *
 * Default when omitted: `'all'` (public access)
 *
 * @example
 * ```yaml
 * # Public page (default)
 * pages:
 *   - name: home
 *     path: /
 *
 * # Authenticated users only
 *   - name: dashboard
 *     path: /dashboard
 *     access: authenticated
 *
 * # Specific roles
 *   - name: admin
 *     path: /admin
 *     access: ['admin']
 *
 * # With redirect
 *   - name: profile
 *     path: /profile
 *     access:
 *       require: authenticated
 *       redirectTo: /login
 * ```
 */
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
/** @public */
export type PageAccessExtended = Schema.Schema.Type<typeof PageAccessExtendedSchema>
