/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from '@/domain/models/shared/permissions'

/**
 * Form Access
 *
 * Reuses the shared `PermissionValueSchema` (same model used by tables,
 * pages, buckets, automations, and agents):
 *
 * - `'all'` — Everyone (including unauthenticated users)
 * - `'authenticated'` — Any logged-in user
 * - `['admin', 'editor']` — Specific role names
 *
 * `redirectTo` is currently **declaration-only**: it is accepted and
 * validated by the schema, but no runtime reads it, so every denial today
 * is answered by status — 401 for an `authenticated` gate, 404 for a role
 * gate (S1 anti-enumeration). Honouring it needs a new access decision
 * variant plus a policy call, because a *role* denial must never redirect:
 * a redirect confirms the form exists to the very users it hides it from.
 */
export const FormAccessSchema = Schema.Struct({
  /** Required access level. */
  require: PermissionValueSchema,
  /** Optional redirect path for denied submitters. Not yet honoured at runtime. */
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

/** @public */
export type FormAccess = Schema.Schema.Type<typeof FormAccessSchema>
