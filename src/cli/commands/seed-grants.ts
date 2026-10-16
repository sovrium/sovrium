/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Access grants a seed run gives its accounts — the `grants` of
 * `seed/users.yaml`, written into the engine-managed `user_access` table.
 *
 * ## Why every grant is checked before anything is written
 *
 * A grant naming a table outside `auth.scopeTables`, an undeclared role, or a
 * record key no seed file defines would otherwise fail after the accounts and
 * the rows already landed — and the retry would meet tables `--mode if-empty`
 * then skips forever. So {@link checkSeedGrants} runs with the account checks,
 * before the first write, and every refusal names the account.
 *
 * ## Why a grant over a table this run does not seed is skipped
 *
 * A run restricted with `--table` writes only the tables it names. A grant over
 * another table names records this run neither writes nor needs, so it is left
 * alone rather than refused: the next full run writes it.
 *
 * ## Why a replay leaves each grant once
 *
 * The accounts file is replayed nightly over a reset demo. A grant is matched
 * on its account, its table and its role; a match is brought to the records
 * the file names, never written a second time.
 */

import { Effect } from 'effect'
import { UserAccessRepository } from '@/application/ports/repositories/auth/user-access-repository'
import { parseSeedReference } from '@/domain/models/seed'
import { runUserAccessProgram } from '@/infrastructure/layers/table-layer'
import { resolveSeedFields } from './seed-resolve'
import type { SeedKeyIndex, SeedResolveContext } from './seed-resolve'
import type { SeedPlan } from '@/application/use-cases/seed/seed-plan'
import type { App } from '@/domain/models/app'
import type { SeedAccount } from '@/domain/models/seed'

/** A refusal raised while writing grants — its message is printed verbatim. */
export class SeedGrantError extends Error {}

type SeedGrant = NonNullable<SeedAccount['grants']>[number]

/** One grant of one account, in the order the file lists them. */
interface AccountGrant {
  readonly email: string
  readonly grant: SeedGrant
}

const grantsOf = (accounts: readonly SeedAccount[]): readonly AccountGrant[] =>
  accounts.flatMap((account) =>
    (account.grants ?? []).map((grant) => ({ email: account.email, grant }))
  )

/** The record keys of a grant (its references were checked against its table on decode). */
const keysOf = (grant: SeedGrant): readonly string[] =>
  grant.records.flatMap((record) => {
    const reference = parseSeedReference(record)
    return reference === undefined ? [] : [reference.key]
  })

/** A grant over a table `auth.scopeTables` does not list. */
const checkScopeTable = (app: Readonly<App>, { email, grant }: AccountGrant): readonly string[] => {
  const scopeTables = app.auth?.scopeTables ?? []
  return scopeTables.includes(grant.table)
    ? []
    : [
        `seed/users.yaml: "${email}" is granted records of "${grant.table}", which is not listed ` +
          `in auth.scopeTables (${scopeTables.join(', ') || 'none'}).`,
      ]
}

/** A grant under a role `auth.roles` does not declare. */
const checkRole = (app: Readonly<App>, { email, grant }: AccountGrant): readonly string[] => {
  const roles = app.auth?.roles?.map((role) => role.name) ?? []
  return roles.includes(grant.role)
    ? []
    : [
        `seed/users.yaml: "${email}" is granted the role "${grant.role}", which auth.roles does ` +
          `not declare (${roles.join(', ') || 'none'}).`,
      ]
}

/**
 * The record keys of a grant no seed file declares. A table outside this run is
 * not written, and neither is a grant over it, so its keys are not checked.
 */
const checkKeys = (plan: SeedPlan, { email, grant }: AccountGrant): readonly string[] => {
  if (!plan.order.includes(grant.table)) return []
  const declared = new Set(
    plan.tables
      .filter((table) => table.name === grant.table)
      .flatMap((table) => table.records.map((record) => record.key))
  )
  return keysOf(grant)
    .filter((key) => !declared.has(key))
    .map(
      (key) =>
        `seed/users.yaml: "${email}" is granted @${grant.table}.${key}, but no seed file ` +
        `declares a row keyed "${key}" in "${grant.table}".`
    )
}

/** The refusals one grant earns, naming its account: the first rule it breaks. */
const checkOne = (app: Readonly<App>, plan: SeedPlan, entry: AccountGrant): readonly string[] => {
  const scope = checkScopeTable(app, entry)
  if (scope.length > 0) return scope
  const role = checkRole(app, entry)
  return role.length > 0 ? role : checkKeys(plan, entry)
}

/** Every refusal the accounts' grants earn, before anything is written. */
export const checkSeedGrants = (
  app: Readonly<App>,
  plan: SeedPlan,
  accounts: readonly SeedAccount[]
): readonly string[] => grantsOf(accounts).flatMap((entry) => checkOne(app, plan, entry))

/** The grants this run writes: those over a table it seeds. */
export const grantsInScope = (
  plan: SeedPlan,
  accounts: readonly SeedAccount[]
): readonly AccountGrant[] =>
  grantsOf(accounts).filter((entry) => plan.order.includes(entry.grant.table))

/** Write one grant, or bring the account's matching grant to the records it names. */
const writeOne = (input: {
  readonly userId: string
  readonly grant: SeedGrant
  readonly recordIds: readonly string[]
  readonly createdBy: string
}) =>
  Effect.gen(function* () {
    const repo = yield* UserAccessRepository
    const { userId, grant, recordIds } = input
    const held = yield* repo.list({ userId, tableSlug: grant.table })
    const match = held.find((row) => row.role === grant.role)
    if (match === undefined) {
      yield* repo.insert(
        { userId, tableSlug: grant.table, recordIds, role: grant.role },
        input.createdBy
      )
      return
    }
    yield* repo.update(match.id, { recordIds })
  })

/**
 * Write the grants of the run, once the tables are written and every key has an
 * id. Returns the report line, or nothing when the accounts carry no grant over
 * a table this run seeds.
 */
export const writeSeedGrants = async (input: {
  readonly plan: SeedPlan
  readonly accounts: readonly SeedAccount[]
  /** Account ids by lower-cased email. */
  readonly accountIds: ReadonlyMap<string, string>
  readonly context: SeedResolveContext
  readonly index: SeedKeyIndex
  /** The account recorded as having minted the grants. */
  readonly createdBy: string
}): Promise<readonly string[]> => {
  const entries = grantsInScope(input.plan, input.accounts)
  if (entries.length === 0) return []
  await entries.reduce<Promise<SeedKeyIndex>>(
    (previous, entry) =>
      previous.then(async (index) => {
        const userId = input.accountIds.get(entry.email.toLowerCase())
        if (userId === undefined) {
          throw new SeedGrantError(`seed/users.yaml: "${entry.email}" has no account to grant.`)
        }
        const refs = keysOf(entry.grant).map((key) => ({ table: entry.grant.table, key }))
        const resolved = await resolveSeedFields(
          input.context,
          index,
          { records: { kind: 'refs', refs } },
          entry.grant.table
        )
        const recordIds = (resolved.value['records'] as readonly (string | number)[]).map(String)
        const result = await runUserAccessProgram(
          writeOne({ userId, grant: entry.grant, recordIds, createdBy: input.createdBy })
        )
        if (result._tag === 'Failure') {
          const { cause } = result.failure
          throw new SeedGrantError(
            `seed/users.yaml: the grant of "${entry.email}" over "${entry.grant.table}" could ` +
              `not be written: ${cause instanceof Error ? cause.message : String(cause)}`
          )
        }
        return resolved.index
      }),
    Promise.resolve(input.index)
  )
  return [`grants: ${entries.length} written`]
}
