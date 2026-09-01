/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How `sovrium migrate` says what it did, would do, or found.
 *
 * Split out of the command so the handler stays a sequence of decisions and the
 * wording stays reviewable in one place. Every renderer here is PURE — it takes
 * facts already read from the database and returns blocks; nothing in this file
 * touches a connection, which is what makes it safe to reason about `--check`'s
 * "writes nothing" contract by reading the command alone.
 *
 * ## Which stream each mode uses, and why it is not one stream
 *
 * A report is the command's ANSWER and goes to stdout. A refusal is not an
 * answer and goes to stderr behind `Error:` (T3/T21/T31). `--check` legitimately
 * writes BOTH on an unsafe database: the operator still gets the dialect, the
 * folder and the counts they asked for, and separately learns the upgrade is
 * blocked. Merging the two would either bury the verdict in a pipe or make
 * `sovrium migrate --check > report.txt` silently lose the reason.
 */

import { formatAccountCollisionMessage } from '@/infrastructure/database/drizzle/account-issuer-preflight'
import { formatOauthClientIdCollisionMessage } from '@/infrastructure/database/drizzle/oauth-client-id-preflight'
import type { MigrationJournalState } from '@/infrastructure/database/drizzle/migrate'
import type { MigrationPreflightReport } from '@/infrastructure/database/drizzle/migrate-preflight'
import type { TableChange } from '@/infrastructure/database/schema/schema-dry-run'
import type { CliBlock } from '@/infrastructure/logging/cli-output'

/** The journal entries this database has NOT applied, in journal order. */
export const pendingTags = (state: MigrationJournalState): readonly string[] =>
  state.tags.slice(state.appliedCount)

/** Which engine, and the folder drizzle actually resolved. */
export const contextBlock = (state: MigrationJournalState): CliBlock => [
  { text: `Dialect: ${state.dialect}` },
  { text: `Migrations: ${state.migrationsFolder}` },
]

/**
 * What the journal did, named by tag.
 *
 * The applied tags are the SLICE between the before and after counts, because
 * drizzle applies journal entries in order and records no tag of its own. An
 * empty slice is reported positively — "nothing pending" and "the command
 * produced no output" have to stay distinguishable, which is the distinction
 * the silent v0.23.0 boot destroyed.
 */
export const appliedBlock = (
  before: MigrationJournalState,
  after: MigrationJournalState
): CliBlock => {
  const applied = after.tags.slice(before.appliedCount, after.appliedCount)
  const position = `${after.appliedCount} of ${after.tags.length}`

  return applied.length === 0
    ? [{ glyph: 'ok', text: `No pending migrations. The journal is at ${position}.` }]
    : [
        {
          glyph: 'ok',
          text: `Applied ${applied.length} pending ${
            applied.length === 1 ? 'migration' : 'migrations'
          }. The journal is at ${position}.`,
          detail: applied,
        },
      ]
}

/**
 * What the dynamic half covered.
 *
 * Named "reconciled" rather than "created": `initializeSchema` compares a
 * checksum and may legitimately decide there is nothing to do, so claiming a
 * creation would report something that did not happen.
 */
export const configTablesBlock = (tableNames: readonly string[]): CliBlock =>
  tableNames.length === 0
    ? [{ glyph: 'ok', text: 'No config tables declared.' }]
    : [{ glyph: 'ok', text: `Config tables reconciled: ${tableNames.join(', ')}.` }]

/** One planned table change, as the line a `--dry-run` prints for it. */
const changeLine = (change: TableChange): CliBlock =>
  change.kind === 'unchanged'
    ? []
    : change.unsimulated
      ? [
          {
            text: `would recreate table ${change.table} and copy its rows (not simulated)`,
            detail: [
              'The statement list depends on the live column set at the moment it runs,',
              'so it cannot be rendered ahead of time. Expect a table rebuild and a full',
              'row copy — plan a maintenance window for it.',
            ],
          },
        ]
      : [
          {
            text:
              change.kind === 'create'
                ? `would create table ${change.table}`
                : `would alter table ${change.table} (${change.statements.length} statement(s))`,
            detail: change.statements,
          },
        ]

/**
 * Every refusal the planned config-table changes would raise, as report rows.
 *
 * Shared by `--dry-run` and `--check` so the two modes cannot drift into
 * describing the same refusal differently — the formatter that produces this
 * prose is the one the boot itself uses, for the same reason the two
 * collision formatters are reached for rather than re-worded.
 *
 * @public
 */
export const configTableRefusalRows = (changes: readonly TableChange[]): readonly string[] =>
  changes.flatMap((change) => change.refusals.flatMap((refusal) => refusal.split('\n')))

/**
 * The whole `--dry-run` document.
 *
 * Follows `sovrium seed`'s convention: a `⚠` header stating nothing was written,
 * the plan itself GLYPH-LESS (a `✓` asserts something completed, and a plan has
 * completed nothing), and a closing line naming the command that would apply it.
 */
export const dryRunBlocks = (
  state: MigrationJournalState,
  changes: readonly TableChange[]
): readonly CliBlock[] => {
  const pending = pendingTags(state)
  const journal: CliBlock =
    pending.length === 0
      ? [{ text: 'no pending migrations' }]
      : [
          {
            text: `would apply ${pending.length} pending migration(s)`,
            detail: pending,
          },
        ]

  const tables = changes.flatMap(changeLine)
  const schema: CliBlock = tables.length === 0 ? [{ text: 'no config table changes' }] : tables

  // A plan that would be REFUSED is not a plan, so the closing line must not
  // invite the operator to apply it.
  const refusals = configTableRefusalRows(changes)
  const closing: CliBlock =
    refusals.length > 0
      ? [{ text: 'This plan would be refused. Resolve what is named below first.' }]
      : [{ text: 'Re-run without --dry-run to apply this plan.' }]

  return [
    [{ glyph: 'warn', text: 'Dry run — nothing was written.' }],
    contextBlock(state),
    journal,
    schema,
    closing,
  ]
}

/**
 * The `--check` report, on stdout, regardless of the verdict.
 *
 * These are the three facts nobody could obtain during the v0.23.0 outage
 * without opening a database tunnel by hand: which engine, which folder, and
 * where the journal actually stands.
 */
export const checkBlocks = (
  state: MigrationJournalState,
  findings: MigrationPreflightReport,
  configTableChanges: readonly TableChange[]
): readonly CliBlock[] => {
  const pending = pendingTags(state)
  const counts: CliBlock = [
    ...contextBlock(state),
    { text: `Applied: ${state.appliedCount} of ${state.tags.length}` },
    { text: `Pending: ${pending.length}` },
  ]

  const listing: CliBlock =
    pending.length === 0 ? [] : [{ text: 'Pending migrations:', detail: pending }]

  // The Layer-B section, and it is deliberately NOT `configTablesBlock`: that
  // one says "reconciled", which is a claim about something having happened.
  // `--check` reconciles nothing, and a `✓` beside a table it merely inspected
  // would be the kind of over-claim this command exists to replace. Conditional
  // on the config declaring tables — silence there would leave the operator
  // unable to tell "nothing to check" from "not checked".
  const configTables: CliBlock =
    configTableChanges.length === 0
      ? [{ text: 'Config tables: none declared.' }]
      : [
          {
            text: `Config tables inspected: ${configTableChanges.length}`,
            detail: configTableChanges.map((change) => change.table),
          },
        ]

  // Layer B counts toward the verdict. [internal ref] names "a type coercion over
  // populated rows" as the dynamic migrator's failure class, so printing
  // "Safe to migrate." over one would be the under-reporting that decision
  // classes as a defect rather than a limitation.
  const blocked =
    findings.accountCollisions.length > 0 ||
    findings.oauthClientCollisions.length > 0 ||
    findings.hashDrift.length > 0 ||
    configTableRefusalRows(configTableChanges).length > 0

  const verdict: CliBlock = blocked
    ? []
    : pending.length === 0
      ? [{ glyph: 'ok', text: 'No pending migrations. This database is at the current schema.' }]
      : [{ glyph: 'ok', text: 'Safe to migrate.' }]

  return [counts, listing, configTables, verdict]
}

/**
 * The refusal rows for an unsafe database, one per finding class.
 *
 * The two collision formatters already produce operator-facing prose, so their
 * multi-line output is SPLIT rather than rewritten: a second wording of the same
 * refusal is a second thing to keep true. Both modules are leaves with no
 * imports of their own, so reaching for them costs the CLI cold path nothing.
 *
 * Hash drift has no formatter yet because nothing has ever surfaced it — this is
 * the first caller, so the wording lives here until a second one needs it.
 */
export const checkFindingRows = (findings: MigrationPreflightReport): readonly string[] => [
  ...(findings.accountCollisions.length > 0
    ? formatAccountCollisionMessage(findings.accountCollisions).split('\n')
    : []),
  ...(findings.oauthClientCollisions.length > 0
    ? formatOauthClientIdCollisionMessage(findings.oauthClientCollisions).split('\n')
    : []),
  ...(findings.hashDrift.length > 0
    ? [
        `${findings.hashDrift.length} released migration(s) no longer match the file this build ships:`,
        '',
        ...findings.hashDrift.map(
          (drift) =>
            `    ${drift.tag}: stored ${drift.storedHash.slice(0, 12)}…, shipped ${drift.expectedHash.slice(0, 12)}…`
        ),
        '',
        'Drizzle decides what to apply by timestamp and never re-reads the hash it',
        'stored, so a rewritten released migration is invisible to it and fatal to',
        'every database that already applied the original. Restore the file this',
        'release shipped rather than editing the stored hash: the hash is the only',
        'evidence that the rewrite happened.',
      ]
    : []),
]
