/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `seed/users.yaml` file format — sign-in accounts a seed run creates.
 *
 * ```yaml
 * users:
 *   - email: ines@northwind.example
 *     name: Inès Moreau
 *     role: admin
 *     password: 'Correct-Horse-Battery-42'   # optional
 *   - email: ahmed@northwind.example
 *     name: Ahmed Benali
 *     role: member                           # takes SOVRIUM_SEED_PASSWORD
 * ```
 *
 * ## Why a top-level `users:` key and not `records:`
 *
 * A table can be named `users`, and its seed file is `seed/users.yaml` with a
 * `records:` list. The KEY is what tells the two apart, so neither shape can be
 * read as the other: an accounts file carries no `records:`, and a table file
 * carries no `users:`.
 *
 * ## Invited accounts
 *
 * `invited: true` creates the account as a PENDING invitation instead: no
 * password, no credential, and an invitation link the person opens to choose
 * their own password and join. `invitedBy` names the account the invitation is
 * from, so the invitation page can say who sent it. No email is sent; the run
 * prints each new invitation's link, once.
 *
 * ```yaml
 *   - email: chloe@northwind.example
 *     name: Chloé Martin
 *     role: member
 *     invited: true
 *     invitedBy: ines@northwind.example
 * ```
 *
 * The token is never written in the file: a template ships its seed folder
 * publicly, and a token everyone can read is an invitation anyone can accept.
 *
 * ## Access grants
 *
 * An app that lists tables in `auth.scopeTables` decides who sees which of
 * their records through grants. `grants` gives the account its grants, written
 * with the same `@<table>.<key>` references a table seed file uses, so a demo
 * portal can be seeded whole — accounts, records, and who sees what:
 *
 * ```yaml
 *   - email: nadia@quayside.example
 *     name: Nadia Benali
 *     role: member
 *     grants:
 *       - table: projects
 *         records: ['@projects.harbour-refit', '@projects.quay-lighting']
 *         role: client
 * ```
 *
 * Each grant names one scope table and the records of THAT table: a reference
 * into another table is refused here, before any file is resolved, because a
 * grant over `projects` naming a client is not a typo the database could catch
 * — record ids are not typed by table.
 *
 * ## Why the password is optional
 *
 * A template ships its seed folder publicly. A password written in it is a
 * password everyone knows, so the file may leave it out and let the operator
 * supply one through `SOVRIUM_SEED_PASSWORD` at seed time. Whether a password is
 * available at all is decided by the command, which is the only place both
 * sources are visible — and an account that already exists needs none.
 */

import { Schema } from 'effect'
import { parseSeedReference } from './references'

/** One access grant a seed run gives an account. */
export const SeedGrantSchema = Schema.Struct({
  table: Schema.String.pipe(
    Schema.annotate({
      description: 'The scope table the grant covers. Must be listed in auth.scopeTables.',
    }),
    Schema.check(Schema.isNonEmpty({ message: 'table must not be empty' }))
  ),
  records: Schema.Array(
    Schema.String.pipe(
      Schema.annotate({
        description: 'A record of that table, as a seed reference: @<table>.<key>.',
      })
    )
  ).pipe(
    Schema.annotate({
      description:
        'The records the account is given access to, each written @<table>.<key> with the grant table.',
    }),
    Schema.check(Schema.isMinLength(1, { message: 'records must name at least one record' }))
  ),
  role: Schema.String.pipe(
    Schema.annotate({
      description: 'The role the account holds over those records. Must be declared in auth.roles.',
    }),
    Schema.check(Schema.isNonEmpty({ message: 'role must not be empty' }))
  ),
}).pipe(
  Schema.annotate({
    title: 'Seed Grant',
    description: 'Access to some records of one scope table, under one role.',
  }),
  Schema.check(
    Schema.makeFilter((grant) => {
      const stray = grant.records.find(
        (record) => parseSeedReference(record)?.table !== grant.table
      )
      return stray === undefined
        ? true
        : `"${stray}" is not a record of ${grant.table}: write each record as @${grant.table}.<key>.`
    })
  )
)

/** One account a seed run creates. */
export const SeedAccountSchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.check(Schema.isNonEmpty({ message: 'email must not be empty' })),
    Schema.annotate({
      description: 'The sign-in email. An email that already has an account is left unchanged.',
    })
  ),
  name: Schema.String.pipe(
    Schema.check(Schema.isNonEmpty({ message: 'name must not be empty' })),
    Schema.annotate({ description: 'The display name.' })
  ),
  role: Schema.String.pipe(
    Schema.check(Schema.isNonEmpty({ message: 'role must not be empty' })),
    Schema.annotate({ description: 'The role the account is created with, e.g. admin or member.' })
  ),
  password: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'The sign-in password. When omitted, SOVRIUM_SEED_PASSWORD is used. Not allowed on an invited account.',
      })
    )
  ),
  invited: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        description:
          'Create the account as a pending invitation: no password, and an invitation link printed by the run instead of an email.',
      })
    )
  ),
  invitedBy: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Email of the account the invitation is from, shown on the invitation page. Only on an invited account.',
      }),
      Schema.check(Schema.isNonEmpty({ message: 'invitedBy must not be empty' }))
    )
  ),
  grants: Schema.optional(
    Schema.Array(SeedGrantSchema).pipe(
      Schema.annotate({
        description:
          'Access grants the account is given over records of the scope tables, written after those tables are seeded.',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    title: 'Seed Account',
    description: 'One sign-in account a seed run creates.',
  }),
  Schema.check(
    Schema.makeFilter((account) => {
      if (account.invited === true && account.password !== undefined) {
        return `"${account.email}" is invited, so it takes no password: the invitee chooses one when accepting.`
      }
      if (account.invitedBy !== undefined && account.invited !== true) {
        return `"${account.email}" names invitedBy but is not invited: add invited: true, or remove invitedBy.`
      }
      return true
    })
  )
)

export type SeedAccount = Schema.Schema.Type<typeof SeedAccountSchema>

/** The decoded contents of `seed/users.yaml`. */
export const SeedUsersFileSchema = Schema.Struct({
  users: Schema.Array(SeedAccountSchema).pipe(
    Schema.annotate({ description: 'Sign-in accounts, created before any table is seeded.' })
  ),
}).pipe(
  Schema.annotate({
    title: 'Seed Users File',
    description: 'Sign-in accounts for a seed run, under a top-level users: key.',
  })
)

/**
 * True when a parsed seed file is an accounts file rather than a table file.
 *
 * Decided by the keys alone, before either schema runs, so a malformed accounts
 * file is reported against the accounts shape rather than as "missing records".
 */
export const isSeedUsersFile = (parsed: unknown): boolean =>
  typeof parsed === 'object' &&
  parsed !== null &&
  !Array.isArray(parsed) &&
  'users' in parsed &&
  !('records' in parsed)

/**
 * Emails listed more than once across every accounts file, lower-cased.
 *
 * Two entries for one email would disagree about its name, role or password,
 * and whichever came second would silently lose. Returned sorted.
 */
export const findDuplicateAccountEmails = (accounts: readonly SeedAccount[]): readonly string[] => {
  const emails = accounts.map((account) => account.email.toLowerCase())
  return [...new Set(emails)]
    .filter((email) => emails.filter((candidate) => candidate === email).length > 1)
    .toSorted()
}
