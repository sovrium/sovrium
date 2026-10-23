/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The account half of a seed run's checks, shared by `sovrium seed` and the
 * in-server seeder an `app/seed` step runs: each refuses on the errors in its
 * own way (the command exits, the step fails).
 */

import type { AccountIndex, AccountPlan } from './seed-accounts'
import type { SeedPlan } from '@/application/use-cases/seed/seed-plan'
import type { App } from '@/domain/models/app'
import type { SeedAccount } from '@/domain/models/seed'

/**
 * Every account question for the run, with the errors that refuse it: the
 * plan against the accounts that exist (`index`, read live when absent) and the
 * pending invitees, plus every grant the files carry. Writes nothing.
 */
export const settleAccountPlan = async (input: {
  readonly app: Readonly<App>
  readonly accounts: readonly SeedAccount[]
  readonly plan: SeedPlan
  readonly actingAs: string | undefined
  readonly index?: AccountIndex
  readonly pendingInvitees?: ReadonlySet<string>
}): Promise<AccountPlan> => {
  const { collectAccountReferences } = await import('@/application/use-cases/seed/seed-checks')
  const { planAccounts, readAccountIndex, readPendingInvitees } = await import('./seed-accounts')
  const { checkSeedGrants } = await import('./seed-grants')
  const planned = planAccounts({
    app: input.app,
    accounts: input.accounts,
    index: input.index ?? (await readAccountIndex()),
    references: collectAccountReferences(input.plan.tables),
    actingAs: input.actingAs,
    fallbackPassword: Bun.env.SOVRIUM_SEED_PASSWORD,
    pendingInvitees: input.pendingInvitees ?? (await readPendingInvitees()),
  })
  return {
    ...planned,
    errors: [...planned.errors, ...checkSeedGrants(input.app, input.plan, input.accounts)],
  }
}
