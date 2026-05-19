/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

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

export type OAuthProvider = Schema.Schema.Type<typeof OAuthProviderSchema>
