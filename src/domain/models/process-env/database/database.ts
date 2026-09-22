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
 *
 * NOTE: this schema models ONLY the PostgreSQL case. `DATABASE_URL` may also
 * carry a `file:` / `sqlite:` / `:memory:` value for SQLite — full
 * dialect resolution lives in `parseDatabaseDialectConfig`
 * (`./database-dialect`), which is the single source of truth.
 */
export const DatabaseEnvSchema = Schema.Struct({
  databaseUrl: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isPattern(/^postgresql:\/\/.+/)),
      Schema.annotate({
        description: 'PostgreSQL connection string (DATABASE_URL)',
        examples: ['postgresql://user:password@localhost:5432/dbname'],
      })
    )
  ),
})
