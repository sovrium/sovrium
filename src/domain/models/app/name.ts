/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const NameSchema = Schema.String.pipe(
  Schema.minLength(1, { message: () => 'Name must not be empty' }),
  Schema.maxLength(214, { message: () => 'Name must not exceed 214 characters' }),
  Schema.pattern(/^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/, {
    message: () =>
      'Name must be lowercase and follow npm package naming conventions (no leading/trailing spaces, no dots/underscores at start, URL-safe characters only)',
  }),
  Schema.annotations({
    title: 'Application Name',
    description: 'The name of the application (follows npm package naming conventions)',
    examples: ['my-app', 'todo-app', '@myorg/my-app', 'blog-system', 'dashboard-admin'],
  })
)

export type Name = Schema.Schema.Type<typeof NameSchema>

export type NameEncoded = Schema.Schema.Encoded<typeof NameSchema>
