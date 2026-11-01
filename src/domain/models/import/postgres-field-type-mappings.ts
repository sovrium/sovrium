/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The field-type tables of the PostgreSQL table sources, which read
 * `information_schema` and name a column by its `data_type`. Kept beside
 * `field-type-mappings.ts`, which lists them with every other source's.
 */

import type { FieldTypeMapping } from './field-type-mappings'

/**
 * Retool Database, by PostgreSQL `data_type`. A column holding a one-column
 * foreign key is typed by its constraint, `FOREIGN KEY`, whatever its type.
 */
export const RETOOL_DATABASE: readonly FieldTypeMapping[] = [
  { source: 'text', sovrium: 'single-line-text' },
  { source: 'character varying', sovrium: 'single-line-text' },
  { source: 'character', sovrium: 'single-line-text' },
  { source: 'uuid', sovrium: 'single-line-text' },
  { source: 'smallint', sovrium: 'integer' },
  { source: 'integer', sovrium: 'integer' },
  { source: 'bigint', sovrium: 'integer' },
  { source: 'numeric', sovrium: 'decimal' },
  { source: 'real', sovrium: 'decimal' },
  { source: 'double precision', sovrium: 'decimal' },
  { source: 'boolean', sovrium: 'checkbox' },
  { source: 'date', sovrium: 'date' },
  { source: 'timestamp without time zone', sovrium: 'datetime' },
  { source: 'timestamp with time zone', sovrium: 'datetime' },
  { source: 'time without time zone', sovrium: 'time' },
  { source: 'interval', sovrium: 'duration' },
  { source: 'json', sovrium: 'json' },
  { source: 'jsonb', sovrium: 'json' },
  { source: 'ARRAY', sovrium: 'array' },
  { source: 'FOREIGN KEY', sovrium: 'relationship' },
]

/**
 * Supabase, by PostgreSQL `data_type`: Retool Database's rows, since both are
 * PostgreSQL read through `information_schema`, plus two kinds the Supabase
 * adapter names itself. `enum` is a column whose type is a PostgreSQL enum
 * (`information_schema` says `USER-DEFINED`; the adapter checks `pg_type`), its
 * labels becoming the options. `auth.users` is a one-column foreign key to
 * `auth.users(id)`: the account that owns the row, which becomes a `user`
 * field so a row rule can compare it with the signed-in person. Any other
 * `USER-DEFINED` type (a PostGIS geometry, a composite) is left unlisted and
 * kept as text.
 */
export const SUPABASE: readonly FieldTypeMapping[] = [
  ...RETOOL_DATABASE,
  { source: 'enum', sovrium: 'single-select' },
  { source: 'auth.users', sovrium: 'user' },
]
