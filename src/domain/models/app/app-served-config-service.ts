/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withholdSelfSeedAutomationsForHost } from './automations/actions/app/self-seed-gate-service'
import { prunePagesByRequirements } from './pages/page-requires'
import type { App } from './app'

/**
 * The app the server runs, derived from the decoded app, and the notices that
 * derivation owes the operator.
 *
 * Pages whose `requires` the app does not meet are dropped, and so is every
 * automation an `app/seed` step the host's `SOVRIUM_SELF_SEED` does not allow
 * would run — withheld before anything reads `automations`, so no trigger is
 * armed, no listing shows it and no route can start it.
 *
 * ONE derivation for every path that hands an app to a listener: the boot, the
 * restart of a `--watch` reload, and its in-place handler swap. A path that
 * served the decoded app instead would answer a page its missing capability
 * hides. The decoded app stays the one to diff a later save against; this is
 * only what is served.
 */
export const servedAppOf = <T extends App>(
  decoded: T,
  env: Readonly<Record<string, string | undefined>>
): { readonly app: T; readonly selfSeedNotices: readonly string[] } => {
  const { app, notices } = withholdSelfSeedAutomationsForHost(
    prunePagesByRequirements(decoded),
    env
  )
  return { app, selfSeedNotices: notices }
}
