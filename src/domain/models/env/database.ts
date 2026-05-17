/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Database environment configuration.
 *
 * Env vars: DATABASE_URL
 */
export const DatabaseEnvSchema = Schema.Struct({
  databaseUrl: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^postgresql:\/\/.+/),
      Schema.annotations({
        description: 'PostgreSQL connection string (DATABASE_URL)',
        examples: ['postgresql://user:password@localhost:5432/dbname'],
      })
    )
  ),
})

export type DatabaseEnvConfig = Schema.Schema.Type<typeof DatabaseEnvSchema>

/** @public */
export const parseDatabaseEnvConfig = (): DatabaseEnvConfig =>
  Schema.decodeUnknownSync(DatabaseEnvSchema)({
    databaseUrl: process.env.DATABASE_URL,
  })
