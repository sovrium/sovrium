/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The seed folder a page export draws from (`--seed <dir>`), read into the rows
 * a drawing shows: the files `sovrium seed` reads, as its loader decodes them,
 * resolved in memory without a database.
 *
 * - Each table file becomes that table's rows, in file order, the n-th row
 *   carrying the id `n`; a `@table.key` value becomes the id of the row it
 *   names, `@user:<email>` the id of that seeded account, and a `{{today…}}`
 *   token the date it reads at the export's clock (`--now`).
 * - A count field is counted from the seeded rows linked to the row.
 * - `auth/<list>.yaml` and `system/<name>.yaml` hold the rows a page drawing an
 *   auth list or a system endpoint shows.
 *
 * ─── A SECRET NEVER LEAVES THE FOLDER ──────────────────────────────────────
 *
 * The value of a write-only field, and of any auth or system column naming a
 * secret (at any depth of the record), is replaced by {@link SECRET_SPECIMEN}
 * as the folder is read, and an account's password is never read into the
 * seed at all: nothing drawn from these rows can carry one.
 */

import { planSeedValue, type SeedValue } from '@/application/use-cases/seed/seed-values'
import type { LoadedSeedFile } from '@/application/use-cases/seed/seed-plan'
import type { App } from '@/domain/models/app'
import type { SeedAccount } from '@/domain/models/seed'

/** How a secret is drawn: always the same eight dots, whatever it was. */
export const SECRET_SPECIMEN = '••••••••'

/** One seeded row, its `id` included. */
export type PageSeedRow = Readonly<Record<string, unknown>>

/** One seeded account, without its password. */
export interface PageSeedAccount {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly role: string
}

/** The seed folder, resolved: what a page export draws instead of the synthetic sample. */
export interface PageSeed {
  /** The folder, relative to the config file, as the node map names it. */
  readonly dir: string
  readonly tables: Readonly<Record<string, readonly PageSeedRow[]>>
  readonly accounts: readonly PageSeedAccount[]
  /** The rows of each auth list (`auth/<list>.yaml`), by list name. */
  readonly auth: Readonly<Record<string, readonly PageSeedRow[]>>
  /** The rows of each system endpoint (`system/<name>.yaml`), by name. */
  readonly system: Readonly<Record<string, readonly PageSeedRow[]>>
}

/** What the CLI read from the folder, before any value is resolved. */
export interface SeedFolderRead {
  readonly dir: string
  readonly files: readonly LoadedSeedFile[]
  readonly accounts: readonly SeedAccount[]
  readonly auth: Readonly<Record<string, readonly unknown[]>>
  readonly system: Readonly<Record<string, readonly unknown[]>>
}

type Field = Readonly<Record<string, unknown>>

/** A column name that holds a secret wherever these words appear in it. */
const SECRET_TEXT = /password|secret|token|hash|credential|private|backup/i

/** A column name that holds a secret when it is exactly this. */
const SECRET_NAME = /^(?:value|code|device_?code|otp)$/i

/** The words of a column name, `apiKey` and `api_key` alike: `api`, `key`. */
const wordsOf = (name: string): readonly string[] =>
  name.split(/[\s_-]+|(?<=[a-z0-9])(?=[A-Z])/).map((word) => word.toLowerCase())

/**
 * Whether a column of an auth list or a system endpoint holds a secret: a
 * password, a token, a hash, a key (`apiKey`, `private_key`), a device code.
 * A key's public `prefix` and a device's `user_code` are shown.
 */
const isSecretColumn = (name: string): boolean =>
  name !== 'prefix' &&
  (SECRET_TEXT.test(name) ||
    SECRET_NAME.test(name) ||
    wordsOf(name).some((word) => word === 'key' || word === 'keys'))

/** A value with every secret column inside it, at any depth, replaced. */
const withoutSecrets = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutSecrets)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([name, item]) => [
      name,
      isSecretColumn(name) ? SECRET_SPECIMEN : withoutSecrets(item),
    ])
  )
}

const fieldsOf = (app: App, table: string): readonly Field[] =>
  (app.tables?.find((candidate) => candidate.name === table)?.fields ?? []) as readonly Field[]

/** The id of every seeded row, by table and key. */
const keyIdsOf = (files: readonly LoadedSeedFile[]): ReadonlyMap<string, number> =>
  new Map(
    files.flatMap((file) =>
      file.records.map((record, at) => [`${file.table}\0${record.key}`, at + 1] as const)
    )
  )

/** What one planned value draws as. */
const resolvedValue = (
  value: SeedValue,
  ids: ReadonlyMap<string, number>,
  accounts: ReadonlyMap<string, string>
): unknown => {
  switch (value.kind) {
    case 'literal':
      return value.value
    case 'ref':
      return ids.get(`${value.ref.table}\0${value.ref.key}`)
    case 'refs':
      return value.refs.flatMap((ref) => ids.get(`${ref.table}\0${ref.key}`) ?? [])
    case 'user':
      return accounts.get(value.email.toLowerCase())
    case 'users':
      return value.emails.flatMap((email) => accounts.get(email.toLowerCase()) ?? [])
    case 'asset':
      return value.filename
    case 'assets':
      return value.filenames
  }
}

/** One table's rows, every value resolved and every write-only value replaced. */
const rowsOf = (
  app: App,
  file: LoadedSeedFile,
  context: {
    readonly now: Readonly<Date>
    readonly ids: ReadonlyMap<string, number>
    readonly accounts: ReadonlyMap<string, string>
  }
): readonly PageSeedRow[] => {
  const writeOnly = new Set(
    fieldsOf(app, file.table).flatMap((field) =>
      field['writeOnly'] === true ? [String(field['name'])] : []
    )
  )
  return file.records.map((record, at) => ({
    id: at + 1,
    ...Object.fromEntries(
      Object.entries(record.fields).map(([name, raw]) => {
        if (writeOnly.has(name)) return [name, SECRET_SPECIMEN] as const
        const planned = planSeedValue(raw, context.now)
        return [
          name,
          planned.ok ? resolvedValue(planned.value, context.ids, context.accounts) : raw,
        ] as const
      })
    ),
  }))
}

/** Whether a seeded row is linked to `id` through `field`. */
const linksTo = (row: PageSeedRow, field: string, id: unknown): boolean => {
  const value = row[field]
  return Array.isArray(value) ? value.includes(id) : value === id
}

/**
 * The field of `related` that links its rows back to a row of `table`: the
 * relationship's own `foreignKey`, else the related table's link to `table`.
 */
const backLinkOf = (app: App, table: string, relationship: Field): string | undefined => {
  if (typeof relationship['foreignKey'] === 'string') return relationship['foreignKey']
  const related = String(relationship['relatedTable'])
  const back = fieldsOf(app, related).find(
    (field) => field['type'] === 'relationship' && field['relatedTable'] === table
  )
  return back === undefined ? undefined : String(back['name'])
}

/** A table's rows with each count field counted from the seeded rows linked to them. */
const withCounts = (
  app: App,
  table: string,
  rows: readonly PageSeedRow[],
  tables: Readonly<Record<string, readonly PageSeedRow[]>>
): readonly PageSeedRow[] => {
  const fields = fieldsOf(app, table)
  const counts = fields.flatMap((field) => {
    if (field['type'] !== 'count') return []
    const relationship = fields.find(
      (candidate) => candidate['name'] === field['relationshipField']
    )
    if (relationship === undefined) return []
    const link = backLinkOf(app, table, relationship)
    const related = tables[String(relationship['relatedTable'])] ?? []
    return link === undefined ? [] : [{ name: String(field['name']), link, related }]
  })
  return rows.map((row) => ({
    ...row,
    ...Object.fromEntries(
      counts.map((count) => [
        count.name,
        count.related.filter((linked) => linksTo(linked, count.link, row['id'])).length,
      ])
    ),
  }))
}

/** One record of an auth list or a system endpoint: its own columns, a secret replaced. */
const listRowOf = (record: unknown): PageSeedRow => {
  const object = (typeof record === 'object' && record !== null ? record : {}) as Field
  const fields = (
    typeof object['fields'] === 'object' && object['fields'] !== null ? object['fields'] : object
  ) as Field
  return withoutSecrets(fields) as PageSeedRow
}

const listsOf = (
  lists: Readonly<Record<string, readonly unknown[]>>
): Readonly<Record<string, readonly PageSeedRow[]>> =>
  Object.fromEntries(Object.entries(lists).map(([name, records]) => [name, records.map(listRowOf)]))

/**
 * The seed a page export draws from, read from the folder `--seed` named.
 *
 * @param app - the validated config: which fields are write-only, which count.
 * @param read - the folder as the CLI read it.
 * @param now - the export's clock, which every `{{today…}}` token reads.
 */
export const pageSeedOf = (app: App, read: SeedFolderRead, now: Readonly<Date>): PageSeed => {
  const accounts: readonly PageSeedAccount[] = read.accounts.map((account, at) => ({
    id: `user-${String(at + 1)}`,
    email: account.email,
    name: account.name,
    role: account.role,
  }))
  const byEmail = new Map(accounts.map((account) => [account.email.toLowerCase(), account.id]))
  const ids = keyIdsOf(read.files)
  const declared = new Set((app.tables ?? []).map((table) => table.name))
  const resolved = Object.fromEntries(
    read.files
      .filter((file) => declared.has(file.table))
      .map((file) => [file.table, rowsOf(app, file, { now, ids, accounts: byEmail })] as const)
  )
  const tables = Object.fromEntries(
    Object.entries(resolved).map(([table, rows]) => [table, withCounts(app, table, rows, resolved)])
  )
  return {
    dir: read.dir,
    tables,
    accounts,
    auth: listsOf(read.auth),
    system: listsOf(read.system),
  }
}
