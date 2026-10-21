/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `seed/<table>.jsonl` file format: the same seed, one record per line.
 *
 * ## Why a second spelling of the same file
 *
 * `seed/<table>.yaml` is written for people: a template's few dozen rows, read
 * and edited by hand. A migrated table is written by `sovrium import`, and it
 * can hold a hundred thousand rows. At that size YAML costs three times over —
 * its parser is several times slower than `JSON.parse`, a diff of one changed
 * row reflows nothing but is unreadable anyway, and one malformed row fails a
 * file whose error message points at a line nobody can open in an editor.
 *
 * JSON Lines keeps every property of the YAML file and changes only the
 * spelling: the header carries what the YAML file's top level carries (`table`,
 * `mergeOn`), and each further line is one `SeedRecordSchema` row, unchanged —
 * the same `key`, the same `fields`, the same `@table.key`, `@asset:` and
 * `@user:` references. A refusal names the line number.
 *
 * ```jsonl
 * {"format":"sovrium.seed","version":1,"mergeOn":["source_id"]}
 * {"key":"rec8kQ2","fields":{"source_id":"rec8kQ2","name":"Acme Corp","owner":"@user:ines@northwind.example"}}
 * {"key":"rec9xT4","fields":{"source_id":"rec9xT4","name":"Globex","parent":"@companies.rec8kQ2"}}
 * ```
 *
 * The header is REQUIRED. A first line that is a record would make the format
 * ambiguous with a header-less variant nobody declared, and a versioned header
 * is what lets the format change without guessing.
 *
 * ## Idempotent re-imports: `source_id` is a plain field, not a seed feature
 *
 * Every table `sovrium import` creates gains one `single-line-text` field,
 * `source_id`, marked `unique`, holding the source record's id; its seed file
 * declares `mergeOn: [source_id]`, and `--apply` seeds with `--mode upsert`.
 * A re-import therefore matches the rows it wrote before and inserts none.
 * Nothing about it is special to seeding: it is an ordinary unique column, which
 * is exactly what `mergeOn` already requires (see `seed-file.ts`), so the seed
 * format needs no new key for it — the JSONL spelling is the only addition.
 *
 * ## Where migrated seed files live: the `seed/import/` layer
 *
 * A migration carries the operator's real records, form responses and
 * collaborator emails, so `sovrium import` writes its seed files to
 * `seed/import/` (attachments to `seed/import/assets/`) and adds that folder to
 * `.gitignore`. It is read as a second LAYER of the seed folder:
 *
 * - a plain `sovrium seed` reads `seed/` and, when it exists, `seed/import/`,
 *   as one set — one dependency order, `@table.key` references across both,
 *   each layer's `@asset:` resolved against its own `assets/` folder. A table
 *   with a seed file in both layers is refused, naming both files: two files
 *   competing for one table is never merged silently.
 * - `sovrium seed --dir <folder>` reads that one folder and nothing else, as
 *   today.
 * - `sovrium import --apply` seeds the `seed/import/` layer alone, in `upsert`
 *   mode — exactly `sovrium seed --dir seed/import --mode upsert`, which the
 *   report prints so the operator can replay it.
 */

import { Schema } from 'effect'
import { SeedRecordSchema, type SeedFile } from './seed-file'

/** The header format identifier. */
export const SEED_JSONL_FORMAT = 'sovrium.seed'

/** The layer of the seed folder `sovrium import` writes into: `seed/import/`. */
export const SEED_IMPORT_LAYER = 'import'

/** The file extension `sovrium seed` reads as JSON Lines. */
export const SEED_JSONL_EXTENSION = '.jsonl'

/**
 * Above this many records `sovrium import` writes `seed/import/<table>.jsonl`
 * instead of `seed/import/<table>.yaml`. A table at or below it stays YAML, which a person can
 * still read.
 */
export const SEED_JSONL_THRESHOLD = 5000

/** The first line of a `seed/<table>.jsonl` file. */
export const SeedJsonlHeaderSchema = Schema.Struct({
  format: Schema.Literal(SEED_JSONL_FORMAT).annotate({
    description: 'The format identifier, which tells a header from a record',
  }),
  version: Schema.Literal(1).annotate({ description: 'The format version' }),
  table: Schema.optional(
    Schema.String.annotate({
      description: 'Target table name. Defaults to the seed file name without its extension.',
    }).check(Schema.isNonEmpty({ message: 'table must not be empty' }))
  ),
  mergeOn: Schema.optional(
    Schema.Array(Schema.String.check(Schema.isNonEmpty()))
      .annotate({
        description:
          'Real, uniquely-constrained column(s) used to match existing rows under --mode upsert.',
        examples: [['source_id']],
      })
      .check(
        Schema.isMinLength(1, {
          message: 'mergeOn must name at least one field, or be omitted entirely',
        })
      )
  ),
}).annotate({
  identifier: 'SeedJsonlHeader',
  title: 'Seed JSONL Header',
  description: 'The header line of a seed file written as JSON Lines.',
})

/** The result of reading one `seed/<table>.jsonl`. */
export type SeedJsonlParse =
  | { readonly ok: true; readonly file: SeedFile }
  | { readonly ok: false; readonly line: number; readonly message: string }

const decodeHeader = Schema.decodeUnknownResult(SeedJsonlHeaderSchema)
const decodeRecord = Schema.decodeUnknownResult(SeedRecordSchema)

const parseLine = (
  text: string,
  line: number
): { readonly ok: true; readonly value: unknown } | Extract<SeedJsonlParse, { ok: false }> => {
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false, line, message: 'not valid JSON' }
  }
}

const decodeRecordLine = (entry: {
  readonly content: string
  readonly line: number
}):
  | { readonly ok: true; readonly row: SeedFile['records'][number] }
  | Extract<SeedJsonlParse, { ok: false }> => {
  const json = parseLine(entry.content, entry.line)
  if (!json.ok) return json
  const record = decodeRecord(json.value)
  return record._tag === 'Failure'
    ? { ok: false, line: entry.line, message: 'a record needs a "key" and a "fields" object' }
    : { ok: true, row: record.success }
}

/**
 * Read a `seed/<table>.jsonl` file's text into the same `SeedFile` a YAML file
 * decodes to.
 *
 * Blank lines are skipped, a trailing newline included. The first non-blank
 * line must be the header; every later one a record. The first bad line stops
 * the read and is named by its 1-based number, so the operator can open the
 * file at it.
 */
export const parseSeedJsonl = (text: string): SeedJsonlParse => {
  const lines = text
    .split('\n')
    .map((content, index) => ({ content: content.trim(), line: index + 1 }))
    .filter((entry) => entry.content !== '')

  const first = lines[0]
  if (first === undefined) return { ok: false, line: 1, message: 'the header line is missing' }

  const headerJson = parseLine(first.content, first.line)
  if (!headerJson.ok) return headerJson
  const header = decodeHeader(headerJson.value)
  if (header._tag === 'Failure')
    return {
      ok: false,
      line: first.line,
      message: `the first line must be the header {"format":"${SEED_JSONL_FORMAT}","version":1}`,
    }

  // One pass, linear in the row count: a migrated table can hold 100,000 rows.
  const decoded = lines.slice(1).map(decodeRecordLine)
  const failure = decoded.find((entry) => !entry.ok)
  if (failure !== undefined && !failure.ok) return failure

  return {
    ok: true,
    file: {
      ...(header.success.table === undefined ? {} : { table: header.success.table }),
      ...(header.success.mergeOn === undefined ? {} : { mergeOn: header.success.mergeOn }),
      records: decoded.flatMap((entry) => (entry.ok ? [entry.row] : [])),
    },
  }
}
