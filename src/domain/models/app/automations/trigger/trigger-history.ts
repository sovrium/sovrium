/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * How much of a run this trigger starts is kept once the run ends.
 *
 * Optional on every trigger type, beside `name`. `full`, the default, keeps
 * the trigger data and every step with its input and output. `minimal` keeps
 * the run alone — its status, trigger name, timings and error — which is what
 * a trigger that fires thousands of times a day can afford: no trigger data
 * and no steps. `none` keeps no row at all for a run that succeeds, and the
 * same row `minimal` keeps for one that does not (failed, timed out, cancelled),
 * so its failure stays visible. A run that waits on an approval or a long delay
 * keeps what it needs to resume until it ends.
 */
export const TriggerHistorySchema = Schema.Literals(['full', 'minimal', 'none']).pipe(
  Schema.annotate({
    identifier: 'TriggerHistory',
    title: 'Run History',
    description:
      "How much of a run this trigger starts is kept once the run ends. `full` keeps the trigger data and every step with its input and output. `minimal` keeps only the run's status, trigger name, timings and error — no trigger data and no steps — for a trigger that fires often; such a run cannot be replayed without new trigger data. `none` keeps nothing of a run that succeeds and, for a run that does not, the row `minimal` keeps with its error — for a tick whose runs nobody reads one by one.",
    defaultNote: '`full`',
  })
)

/** @public */
export type TriggerHistory = Schema.Schema.Type<typeof TriggerHistorySchema>
