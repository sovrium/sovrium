/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * OAuth Provider Schema
 *
 * Essential OAuth providers for v1.
 * Focused on enterprise and developer use cases.
 *
 * Providers:
 * - google: Google Workspace integration
 * - github: Developer authentication
 * - microsoft: Enterprise/Azure AD
 * - slack: Workspace communication
 * - gitlab: Developer/CI-CD integration
 *
 * Credentials are loaded from environment variables:
 * - {PROVIDER}_CLIENT_ID (e.g., GOOGLE_CLIENT_ID)
 * - {PROVIDER}_CLIENT_SECRET (e.g., GOOGLE_CLIENT_SECRET)
 *
 * @example
 * ```typescript
 * const providers = ['google', 'github', 'slack']
 * ```
 */
export const OAuthProviderSchema = Schema.Literal(
  'google',
  'github',
  'microsoft',
  'slack',
  'gitlab'
).pipe(
  Schema.annotations({
    title: 'OAuth Provider',
    description: 'Supported OAuth providers for social login',
  })
)

/** @public */
export type OAuthProvider = Schema.Schema.Type<typeof OAuthProviderSchema>
