/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TriggerSchema } from './trigger'

/** The fewest and the most entries a `triggers` list accepts. */
export const MIN_TRIGGERS = 1
export const MAX_TRIGGERS = 10

/**
 * The list form: 1 to 10 triggers that each start the same steps.
 *
 * The bounds are judged on the automation (`trigger-list-validation.ts`) so
 * the refusal can name it; the check below only publishes them to the JSON
 * Schema an editor reads, and always passes.
 */
export const TriggerListSchema = Schema.Array(TriggerSchema).pipe(
  Schema.annotate({
    description:
      "Several triggers that each start this automation's steps — a schedule and a webhook, a record change and a manual start. 1 to 10 entries. A webhook, manual, form or automation-call trigger appears at most once (the automation has one address for each); a cron, record, auth, comment or automation-failure trigger may repeat, each repetition carrying a `name`. Names default to the type and are unique within the automation. A run reads the trigger that started it at `{{trigger.type}}` and `{{trigger.name}}`.",
    howTo:
      'Use `triggers` when one list of steps must run on more than one event — `nightly and on demand` is a cron entry and a manual entry. Branch on `{{trigger.name}}` with a `path` step when one road needs an extra step; give each road its own automation when the steps differ throughout. Two record triggers may not watch the same event of the same table.',
  }),
  Schema.check(
    Schema.makeFilter(() => true, {
      toJsonSchema: () => ({ minItems: MIN_TRIGGERS, maxItems: MAX_TRIGGERS }),
    })
  )
)

/** @public */
export type TriggerList = Schema.Schema.Type<typeof TriggerListSchema>
