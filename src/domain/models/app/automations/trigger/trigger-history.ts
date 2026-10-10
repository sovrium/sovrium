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
 * and no steps. A run that waits on an approval or a long delay keeps what it
 * needs to resume until it ends.
 */
export const TriggerHistorySchema = Schema.Literals(['full', 'minimal']).pipe(
  Schema.annotate({
    identifier: 'TriggerHistory',
    title: 'Run History',
    description:
      "How much of a run this trigger starts is kept once the run ends. `full` keeps the trigger data and every step with its input and output. `minimal` keeps only the run's status, trigger name, timings and error — no trigger data and no steps — for a trigger that fires often; such a run cannot be replayed without new trigger data.",
    defaultNote: '`full`',
  })
)

/** @public */
export type TriggerHistory = Schema.Schema.Type<typeof TriggerHistorySchema>
