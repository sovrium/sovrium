/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `unclaimed: true` accounts of `seed/users.yaml`: a person the data names who
 * has not been asked to join. The account is created with no credential and no
 * invitation — no password, no token, nothing sent, nothing printed — so a
 * migration can keep a collaborator's name on the records they own without
 * handing out a join link nobody asked for. Its owner claims it later through
 * the app's ordinary roads: a password reset to that email, which links the
 * credential on first use, or an invitation an admin sends.
 */

import type { App } from '@/domain/models/app'
import type { SeedAccount } from '@/domain/models/seed'

/**
 * Create the unclaimed accounts a run plans, and return one refusal line per
 * account the auth layer would not create — none when every one was.
 */
export const createUnclaimedSeedAccounts = async (
  app: Readonly<App>,
  accounts: readonly SeedAccount[]
): Promise<readonly string[]> => {
  if (accounts.length === 0) return []
  const { createUnclaimedAccounts } = await import('@/index')
  const outcomes = await createUnclaimedAccounts(
    app,
    accounts.map(({ email, name, role }) => ({ email, name, role }))
  )
  return outcomes.flatMap((outcome) =>
    outcome.ok ? [] : [`accounts: "${outcome.email}": ${outcome.message}`]
  )
}
