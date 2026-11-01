/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The adapter of a Supabase snapshot: a PostgreSQL database read like a Retool
 * Database (`retool-database-adapter-service.ts` reads its `public` catalogue
 * and rows), plus what Supabase keeps in its own schemas.
 *
 * ```
 * raw/schema/…                    the `public` catalogue, as for Retool Database
 * raw/schema/enums.json           the labels of the `public` enum types
 * raw/schema/auth-references.json the one-column foreign keys to `auth.users`
 * raw/tables/<n>/rows-0001.json … the rows
 * raw/rls.json                    { table, enabled } per `public` table
 * raw/policies.json               pg_policies of `public`, verbatim
 * raw/auth-users.json             auth.users, never its password hash
 * raw/storage/buckets.json        storage.buckets
 * raw/storage/objects.json        storage.objects (the list; the bytes are in assets/)
 * raw/storage/policies.json       the storage policies, by name
 * ```
 *
 * - **A key to `auth.users`** is not a relationship to an imported table: it
 *   names the account that owns the row. The column keeps the source type
 *   `auth.users`, and each value becomes that account by email, so a row stays
 *   with its person though the account id changes. An account that is not
 *   imported (anonymous, phone only, deleted) leaves the cell empty.
 * - **An enum column** keeps the source type `enum`, its labels as options.
 * - **Policies are kept verbatim**, as `pg_policies` deparsed them: translating
 *   them is `row-security-mapper-service.ts`'s job.
 * - **Users**: one account per user with an email, named by
 *   `raw_user_meta_data.full_name`, then `name`, then the part of the email
 *   before `@`; a confirmed user is `unclaimed`, an invited one who never
 *   confirmed `invited`. Anonymous, phone-only and deleted users are counted.
 */

import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { IMPORT_ATTACHMENT_INDEX, attachmentIndexOf } from '../snapshot-manifest'
import { RETOOL_SCHEMA_PATHS, adaptRetoolDatabaseSnapshot } from './retool-database-adapter-service'
import type {
  CanonicalBase,
  CanonicalBucketSchema,
  CanonicalField,
  CanonicalPolicySchema,
  CanonicalRecord,
  CanonicalTable,
} from '../canonical-base'
import type { TableAdapterResult } from '../tabular-adapter-service'
import type { Schema } from 'effect'

/** The snapshot paths of Supabase's own reads. */
export const SUPABASE_PATHS = {
  rls: 'raw/rls.json',
  policies: 'raw/policies.json',
  authUsers: 'raw/auth-users.json',
  enums: 'raw/schema/enums.json',
  authReferences: 'raw/schema/auth-references.json',
  buckets: 'raw/storage/buckets.json',
  objects: 'raw/storage/objects.json',
  storagePolicies: 'raw/storage/policies.json',
} as const

/** The source type of a column that references `auth.users(id)`. */
export const AUTH_USERS_SOURCE_TYPE = 'auth.users'

type Json = Readonly<Record<string, unknown>>
type CanonicalPolicy = Schema.Schema.Type<typeof CanonicalPolicySchema>
type CanonicalBucket = Schema.Schema.Type<typeof CanonicalBucketSchema>
type SkipReason = 'anonymous' | 'no-email' | 'deleted'

const rowsAt = (raw: ReadonlyMap<string, unknown>, path: string): readonly Json[] =>
  arrayOf(raw.get(path)).filter(isRecord)

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** The `public` columns that reference `auth.users`, as `<table>.<column>`. */
const authReferencesOf = (raw: ReadonlyMap<string, unknown>): ReadonlySet<string> =>
  new Set(
    rowsAt(raw, SUPABASE_PATHS.authReferences).map(
      (row) => `${text(row['table'])}.${text(row['column'])}`
    )
  )

/** Whether two catalogue rows name the same constraint: schema, name and table together. */
const sameConstraint = (a: Json, b: Json): boolean =>
  ['constraint_schema', 'constraint_name', 'table_schema', 'table_name'].every(
    (column) => text(a[column]) === text(b[column])
  )

/** The catalogue with every foreign key to `auth.users` left out, so it is no link. */
const withoutAuthForeignKeys = (
  raw: ReadonlyMap<string, unknown>,
  references: ReadonlySet<string>
): ReadonlyMap<string, unknown> => {
  const keys = rowsAt(raw, RETOOL_SCHEMA_PATHS.keyColumnUsage)
  const kept = rowsAt(raw, RETOOL_SCHEMA_PATHS.tableConstraints).filter((constraint) => {
    if (text(constraint['constraint_type']) !== 'FOREIGN KEY') return true
    const columns = keys
      .filter((key) => sameConstraint(key, constraint))
      .map((key) => key['column_name'])
    return !(
      columns.length === 1 &&
      references.has(`${text(constraint['table_name'])}.${text(columns[0])}`)
    )
  })
  return new Map([...raw, [RETOOL_SCHEMA_PATHS.tableConstraints, kept]])
}

/** The labels of each `public` enum type, in their declared order. */
const enumsOf = (raw: ReadonlyMap<string, unknown>): ReadonlyMap<string, readonly string[]> =>
  rowsAt(raw, SUPABASE_PATHS.enums)
    .toSorted((a, b) => Number(a['position']) - Number(b['position']))
    .reduce(
      (map, row) =>
        new Map([
          ...map,
          [text(row['name']), [...(map.get(text(row['name'])) ?? []), text(row['label'])]],
        ]),
      new Map<string, readonly string[]>()
    )

/** One imported account. */
type Account = CanonicalBase['users'][number]

interface Accounts {
  readonly accounts: readonly Account[]
  readonly emailById: ReadonlyMap<string, string>
  readonly skipped: NonNullable<CanonicalBase['skippedUsers']>
}

const skipReasonOf = (user: Json): SkipReason | undefined => {
  if (user['is_anonymous'] === true) return 'anonymous'
  if (user['deleted_at'] !== null && user['deleted_at'] !== undefined) return 'deleted'
  return text(user['email']).trim() === '' ? 'no-email' : undefined
}

/** A person's name: their metadata's `full_name`, then `name`, then the email before `@`. */
const nameOf = (user: Json, email: string): string => {
  const meta = isRecord(user['raw_user_meta_data']) ? user['raw_user_meta_data'] : {}
  const named = [meta['full_name'], meta['name']].find(
    (value): value is string => typeof value === 'string' && value.trim() !== ''
  )
  return named ?? email.slice(0, email.indexOf('@'))
}

const isSet = (value: unknown): boolean => value !== null && value !== undefined && value !== ''

/** The users with an email as accounts, the others counted by reason. */
const accountsOf = (raw: ReadonlyMap<string, unknown>): Accounts => {
  const users = rowsAt(raw, SUPABASE_PATHS.authUsers)
  const kept = users.filter((user) => skipReasonOf(user) === undefined)
  const reasons = users.flatMap((user) => {
    const reason = skipReasonOf(user)
    return reason === undefined ? [] : [reason]
  })
  const accounts = kept
    .map((user): Account => {
      const email = text(user['email']).trim()
      const invited = !isSet(user['email_confirmed_at']) && isSet(user['invited_at'])
      return { email, name: nameOf(user, email), state: invited ? 'invited' : 'unclaimed' }
    })
    .toSorted((a, b) => a.email.localeCompare(b.email))
  const skipped = (['anonymous', 'deleted', 'no-email'] as const).flatMap((reason) => {
    const count = reasons.filter((one) => one === reason).length
    return count === 0 ? [] : [{ reason, count }]
  })
  return {
    accounts,
    emailById: new Map(kept.map((user) => [text(user['id']), text(user['email']).trim()])),
    skipped,
  }
}

const COMMANDS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'] as const

/** `roles` as a list: an array, or the `{a,b}` text a driver may return. */
const rolesOf = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value.map(String)
  return text(value)
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((role) => role.trim().replace(/^"|"$/g, ''))
    .filter((role) => role !== '')
}

const policyOf = (row: Json): CanonicalPolicy | undefined => {
  const command = COMMANDS.find((one) => one === text(row['cmd']).toUpperCase())
  const name = text(row['policyname'])
  if (command === undefined || name === '') return undefined
  return {
    name,
    permissive: text(row['permissive']).toUpperCase() !== 'RESTRICTIVE',
    roles: rolesOf(row['roles']),
    command,
    ...(isSet(row['qual']) ? { using: text(row['qual']) } : {}),
    ...(isSet(row['with_check']) ? { check: text(row['with_check']) } : {}),
  }
}

/** Each `public` table's row-level security: whether it was on, and its policies. */
const rowSecurityOf = (
  raw: ReadonlyMap<string, unknown>
): ReadonlyMap<string, NonNullable<CanonicalTable['rowSecurity']>> => {
  const policies = rowsAt(raw, SUPABASE_PATHS.policies)
  return new Map(
    rowsAt(raw, SUPABASE_PATHS.rls).map((row) => {
      const table = text(row['table'])
      return [
        table,
        {
          enabled: row['enabled'] === true,
          policies: policies
            .filter((policy) => text(policy['tablename']) === table)
            .flatMap((policy) => {
              const one = policyOf(policy)
              return one === undefined ? [] : [one]
            }),
        },
      ] as const
    })
  )
}

/** A field as Supabase means it: an owner column, an enum, or as Retool Database reads it. */
const fieldOf = (
  field: CanonicalField,
  owner: boolean,
  enums: ReadonlyMap<string, readonly string[]>
): CanonicalField => {
  if (owner) return { ...field, sourceType: AUTH_USERS_SOURCE_TYPE }
  const labels = enums.get(text(field.options?.['udt_name']))
  return field.sourceType === 'USER-DEFINED' && labels !== undefined
    ? {
        ...field,
        sourceType: 'enum',
        options: { ...field.options, options: labels.map((name) => ({ name })) },
      }
    : field
}

/** An owner cell as the account it names, or nothing when that account is not imported. */
const recordOf = (
  record: CanonicalRecord,
  owners: ReadonlySet<string>,
  emailById: ReadonlyMap<string, string>
): CanonicalRecord => ({
  ...record,
  values: Object.fromEntries(
    Object.entries(record.values).flatMap(([field, value]) => {
      if (!owners.has(field)) return [[field, value] as const]
      const email = emailById.get(String(value))
      return email === undefined ? [] : [[field, { kind: 'user' as const, email }] as const]
    })
  ),
})

const tableOf = (
  table: CanonicalTable,
  context: {
    readonly references: ReadonlySet<string>
    readonly enums: ReadonlyMap<string, readonly string[]>
    readonly emailById: ReadonlyMap<string, string>
    readonly security: ReadonlyMap<string, NonNullable<CanonicalTable['rowSecurity']>>
  }
): CanonicalTable => {
  const owners = new Set(
    table.fields
      .filter((field) => context.references.has(`${table.name}.${field.sourceId}`))
      .map((field) => field.sourceId)
  )
  const rowSecurity = context.security.get(table.name)
  return {
    ...table,
    fields: table.fields.map((field) => fieldOf(field, owners.has(field.sourceId), context.enums)),
    records: table.records.map((record) => recordOf(record, owners, context.emailById)),
    ...(rowSecurity === undefined ? {} : { rowSecurity }),
  }
}

const positiveInt = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined

/** One storage object: its path, where its bytes sit in the snapshot, what the source recorded. */
const objectOf = (object: Json, asset: string | undefined): CanonicalBucket['objects'][number] => {
  const meta = isRecord(object['metadata']) ? object['metadata'] : {}
  const { size, mimetype } = meta
  return {
    path: text(object['name']),
    ...(asset === undefined ? {} : { asset }),
    ...(typeof mimetype === 'string' ? { mimeType: mimetype } : {}),
    ...(typeof size === 'number' && Number.isInteger(size) && size >= 0 ? { size } : {}),
  }
}

/** The buckets, each with the objects it holds and where their bytes sit in the snapshot. */
const bucketsOf = (raw: ReadonlyMap<string, unknown>): readonly CanonicalBucket[] => {
  const assets = attachmentIndexOf(raw.get(IMPORT_ATTACHMENT_INDEX))
  const objects = rowsAt(raw, SUPABASE_PATHS.objects)
  return rowsAt(raw, SUPABASE_PATHS.buckets).map((bucket) => {
    const id = text(bucket['id'])
    const types = arrayOf(bucket['allowed_mime_types']).filter(
      (type): type is string => typeof type === 'string'
    )
    const maxFileSize = positiveInt(bucket['file_size_limit'])
    return {
      sourceId: id,
      name: text(bucket['name']) || id,
      public: bucket['public'] === true,
      ...(maxFileSize === undefined ? {} : { maxFileSize }),
      ...(types.length === 0 ? {} : { allowedMimeTypes: types }),
      objects: objects
        .filter((object) => text(object['bucket_id']) === id && text(object['name']) !== '')
        .map((object) => objectOf(object, assets.get(`${id}/${text(object['name'])}`)?.asset))
        .toSorted((a, b) => a.path.localeCompare(b.path)),
    }
  })
}

/** The storage policies, by name, once each. */
const storagePoliciesOf = (raw: ReadonlyMap<string, unknown>): readonly string[] => [
  ...new Set(
    rowsAt(raw, SUPABASE_PATHS.storagePolicies)
      .map((row) => text(row['policyname']))
      .filter((name) => name !== '')
  ),
]

/**
 * A Supabase snapshot as one base.
 *
 * @param raw - every `raw/` file of the snapshot, parsed, by snapshot path.
 */
export const adaptSupabaseSnapshot = (raw: ReadonlyMap<string, unknown>): TableAdapterResult => {
  const references = authReferencesOf(raw)
  const read = adaptRetoolDatabaseSnapshot(withoutAuthForeignKeys(raw, references))
  const { accounts, emailById, skipped } = accountsOf(raw)
  const context = { references, enums: enumsOf(raw), emailById, security: rowSecurityOf(raw) }
  const hasBuckets = raw.has(SUPABASE_PATHS.buckets)
  const base: CanonicalBase = {
    ...read.base,
    tool: 'supabase',
    sourceId: 'supabase',
    name: 'Supabase',
    tables: read.base.tables.map((table) => tableOf(table, context)),
    users: accounts,
    skippedUsers: skipped,
    ...(hasBuckets ? { buckets: bucketsOf(raw) } : {}),
  }
  return {
    base,
    identities: read.identities,
    ...(hasBuckets ? { storagePolicies: storagePoliciesOf(raw) } : {}),
  }
}
