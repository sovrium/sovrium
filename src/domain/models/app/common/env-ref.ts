/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Environment Variable Reference Schema
 *
 * References an environment variable using $VAR_NAME syntax.
 * Used for secrets that should not be hardcoded in config files.
 *
 * @example
 * ```typescript
 * secret: '$BETTER_AUTH_SECRET'
 * password: '$SMTP_PASSWORD'
 * apiKey: '$SENDGRID_API_KEY'
 * ```
 */
export const EnvRefSchema = Schema.String.pipe(
  Schema.pattern(/^\$[A-Z_][A-Z0-9_]*$/),
  Schema.annotations({
    title: 'Environment Variable Reference',
    description: 'Reference to an environment variable (e.g., $BETTER_AUTH_SECRET)',
    examples: ['$BETTER_AUTH_SECRET', '$SMTP_PASSWORD', '$SENDGRID_API_KEY', '$AWS_ACCESS_KEY'],
  })
)

export type EnvRef = Schema.Schema.Type<typeof EnvRefSchema>
