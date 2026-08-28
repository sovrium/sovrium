/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `seed/<table>.yaml` file format.
 *
 * ## Why a folder of files, and not an AppSchema key
 *
 * Seed data is not configuration. It is the *content* an app happens to start
 * with, it is large, and it changes on a completely different cadence from the
 * schema that shapes it. Putting it in `app.yaml` would have three costs that
 * each land somewhere visible: every `templates/<slug>/app.yaml` is republished
 * verbatim on its public `/apps/<slug>` page, so inlined rows would degrade a
 * marketing page; a config property implies a running app reads it, and nothing
 * would; and it would make "reseed" a config edit rather than an operation.
 *
 * So seeding is a CLI verb over files in a folder — `sovrium seed` — and the
 * folder mirrors `config/tables/` one-for-one so an author never has to learn a
 * second layout.
 *
 * ```
 * templates/crm/
 *   config/tables/{companies,contacts,deals}.yaml
 *   seed/{companies,contacts,deals}.yaml     <- same names
 *   seed/assets/*.{avif,png}                 <- optional binaries
 * ```
 *
 * ## The file
 *
 * ```yaml
 * # seed/deals.yaml
 * mergeOn: [name]              # optional; see below
 * records:
 *   - key: acme-renewal        # natural key, referenced by other files
 *     fields:
 *       name: Acme renewal
 *       company: '@companies.acme'
 *       stage: Negotiation
 *       close_date: '{{today+21d}}'
 * ```
 *
 * `table:` may be given explicitly but defaults to the file's stem, so the
 * mirrored layout needs no ceremony.
 *
 * ## `key` vs `mergeOn` — two different identities, deliberately separate
 *
 * `key` is **file-local**. It exists so one row can name another before either
 * has a database id, and it is never written to the database. Two runs against
 * a fresh database produce the same rows from the same keys, but the ids differ
 * — which is fine, because nothing outside the seed run refers to them.
 *
 * `mergeOn` is a **database** identity: real columns, carrying a real unique
 * constraint, used as `fieldsToMergeOn` when `--mode upsert` replays a data set
 * over rows that already exist. Conflating the two was the tempting design and
 * it does not survive contact with the database: `key` is not a column, so
 * there is nothing to match on, and inventing a hidden column to store it would
 * put seeding metadata into every user's schema forever.
 *
 * When `mergeOn` is omitted, `--mode upsert` falls back to the table's single
 * `unique: true` field. Zero such fields, or more than one, is refused rather
 * than guessed — an upsert that merges on the wrong column silently overwrites
 * unrelated rows, and that is not a failure anybody notices in time.
 *
 * ## An empty `records` list is legal
 *
 * Under `--mode replace` it means "this table should end up empty", which is a
 * real intent for a table an app populates at runtime.
 */

import { Schema } from 'effect'
import { SEED_KEY_PATTERN } from './references'

/**
 * How an existing table is treated.
 *
 * - `if-empty` — seed only tables with no rows. The default, because it is the
 *   only mode that can never destroy data a user typed.
 * - `upsert`   — replay by `mergeOn`, idempotently.
 * - `replace`  — remove every row, then insert. What the nightly demo reset runs.
 */
export const SEED_MODES = ['if-empty', 'upsert', 'replace'] as const

export const SeedModeSchema = Schema.Literals(SEED_MODES).pipe(
  Schema.annotate({
    title: 'Seed Mode',
    description: 'How `sovrium seed` treats a table that already has rows.',
  })
)

export type SeedMode = Schema.Schema.Type<typeof SeedModeSchema>

/** The default when `--mode` is not passed. */
export const DEFAULT_SEED_MODE: SeedMode = 'if-empty'

/**
 * Parse the `--mode` flag value.
 *
 * Returns `undefined` for an unrecognised value so the caller can print the
 * accepted set — a CLI that answers an unknown mode by silently using the
 * default would destroy data under `replace`'s name or refuse to write under
 * `if-empty`'s, and in both cases the operator's exit code says success.
 */
export const parseSeedMode = (raw: string | undefined): SeedMode | undefined =>
  raw === undefined
    ? DEFAULT_SEED_MODE
    : (SEED_MODES as readonly string[]).includes(raw)
      ? (raw as SeedMode)
      : undefined

/**
 * One seeded row.
 *
 * `fields` is an open record because the field *names* are defined by the
 * app's own table config, which this schema cannot see. Validating a field
 * name against the table it targets is the seed resolver's job, and it reports
 * an undeclared field by name alongside the table's real field list.
 */
export const SeedRecordSchema = Schema.Struct({
  key: Schema.String.pipe(
    Schema.check(
      Schema.isPattern(SEED_KEY_PATTERN, {
        message:
          'key must start with a letter or digit and contain only letters, digits, "-" and "_"',
      })
    ),
    Schema.annotate({
      description:
        'File-local natural key. Other seed rows reference this row as @<table>.<key>. Never written to the database.',
      examples: ['acme', 'acme-renewal', 'q3_kickoff'],
    })
  ),
  fields: Schema.Record(Schema.String, Schema.Unknown).pipe(
    Schema.annotate({
      description:
        'Column values for this row. String values may carry @<table>.<key> references, @asset:<file> references, or {{today±Nd}} tokens.',
    })
  ),
}).pipe(
  Schema.annotate({
    title: 'Seed Record',
    description: 'A single row in a seed file, addressable by its natural key.',
  })
)

/** The decoded contents of one `seed/<table>.yaml`. */
export const SeedFileSchema = Schema.Struct({
  table: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isNonEmpty({ message: 'table must not be empty' })),
      Schema.annotate({
        description: 'Target table name. Defaults to the seed file name without its extension.',
      })
    )
  ),
  mergeOn: Schema.optional(
    Schema.Array(Schema.String.pipe(Schema.check(Schema.isNonEmpty()))).pipe(
      Schema.check(
        Schema.isMinLength(1, {
          message: 'mergeOn must name at least one field, or be omitted entirely',
        })
      ),
      Schema.annotate({
        description:
          'Real, uniquely-constrained column(s) used to match existing rows under --mode upsert.',
        examples: [['email'], ['name']],
      })
    )
  ),
  records: Schema.Array(SeedRecordSchema).pipe(
    Schema.annotate({
      description:
        'Rows to seed, in any order — `sovrium seed` resolves cross-table dependencies itself. May be empty.',
    })
  ),
}).pipe(
  Schema.annotate({
    title: 'Seed File',
    description: 'One table of seed data, mirroring config/tables/<table>.yaml.',
    examples: [
      {
        mergeOn: ['name'],
        records: [{ key: 'acme', fields: { name: 'Acme Corp', tier: 'Enterprise' } }],
      },
    ],
  })
)

export type SeedFile = Schema.Schema.Type<typeof SeedFileSchema>

/**
 * Resolve the table a seed file targets: explicit `table:` wins, otherwise the
 * file stem. Accepts a bare filename or a full path.
 */
export const resolveSeedTableName = (file: SeedFile, filePath: string): string => {
  if (file.table !== undefined) return file.table
  const base = filePath.split('/').at(-1) ?? filePath
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

/**
 * Report duplicate `key` values within one file.
 *
 * A duplicate is not a merge and not a last-one-wins: it means two rows compete
 * for the same reference target, and every `@table.key` pointing at it becomes
 * a coin flip. Returned sorted so the message is stable across runs.
 */
export const findDuplicateKeys = (file: SeedFile): readonly string[] => {
  const keys = file.records.map((record) => record.key)
  const duplicated = [...new Set(keys)].filter(
    (key) => keys.filter((candidate) => candidate === key).length > 1
  )
  // eslint-disable-next-line functional/immutable-data, no-restricted-syntax -- single in-place sort on a freshly-spread copy; never mutates input
  return [...duplicated].sort()
}
