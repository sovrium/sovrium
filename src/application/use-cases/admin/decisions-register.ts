/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The read behind `GET /api/admin/decisions` ([internal ref] amendment A6).
 *
 * A projection of the decoded `App` and nothing else — no repository, no
 * driver, no environment. It is an Effect rather than a plain function for the
 * reason every other admin read is: the span is what lets an operator's slowest
 * console page be attributed to the read that made it, and a projection that is
 * cheap today is exactly the one nobody instruments later.
 *
 * ─── THE ORDER IS THE FILE'S ORDER ─────────────────────────────────────────
 *
 * The register is returned as the config states it. Ordering is a reading
 * choice that belongs to the surface making it; sorting here would bake one
 * console's current preference into the contract, and no reader could recover
 * the file's own order afterwards.
 *
 * ─── AN ABSENT REGISTER IS AN EMPTY ONE ────────────────────────────────────
 *
 * `app.decisions` omitted yields an empty list and four zero counts, never a
 * failure. An operator who declared no decisions is not an error case, and the
 * console's empty state is drawn from that body.
 */

import { Effect } from 'effect'
import type { AdminDecisionsCatalogResponse } from '@/domain/models/api/admin/decisions/catalog'
import type { App } from '@/domain/models/app'
import type { Decision } from '@/domain/models/app/decisions'

/** Shape one declared record for the wire, dropping the two absent link keys. */
const toWireRecord = (decision: Decision): AdminDecisionsCatalogResponse['decisions'][number] => ({
  id: decision.id,
  title: decision.title,
  status: decision.status,
  date: decision.date,
  deciders: [...decision.deciders],
  touches: [...decision.touches],
  context: decision.context,
  decision: decision.decision,
  consequences: decision.consequences,
  ...(decision.supersedes === undefined ? {} : { supersedes: decision.supersedes }),
  ...(decision.supersededBy === undefined ? {} : { supersededBy: decision.supersededBy }),
})

/**
 * Read the declared register, with its four flat counts.
 *
 * The counts are derived from the list rather than carried beside it, so the
 * two can never disagree — a register of five whose counts sum to four is the
 * kind of defect that survives a 200.
 */
export const readDecisionRegister = (
  app: App
): Effect.Effect<AdminDecisionsCatalogResponse, never, never> =>
  Effect.sync(() => {
    const declared = app.decisions ?? []
    const countOf = (status: Decision['status']): number =>
      declared.filter((decision) => decision.status === status).length
    return {
      decisions: declared.map(toWireRecord),
      total: declared.length,
      accepted: countOf('accepted'),
      proposed: countOf('proposed'),
      superseded: countOf('superseded'),
    }
  }).pipe(Effect.withSpan('admin.read-decision-register'))
