/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/** A trigger name: kebab-case, starting with a letter. */
const TRIGGER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/

/** The longest trigger name accepted. */
const TRIGGER_NAME_MAX_LENGTH = 50

const TRIGGER_NAME_RULE = `A trigger name is kebab-case: lowercase letters, digits and hyphens, starting with a letter, at most ${TRIGGER_NAME_MAX_LENGTH} characters (e.g. \`nightly\`, \`warehouse-hook\`)`

/**
 * The name of one trigger of an automation.
 *
 * Optional on every trigger type. When it is left out the trigger is named
 * after its type, so a single-trigger automation's trigger is `webhook`,
 * `cron`, `manual` and so on. A run reads the name of the trigger that
 * started it at `{{trigger.name}}`, and the run history records and filters
 * on it.
 */
export const TriggerNameSchema = Schema.String.pipe(
  Schema.annotate({
    identifier: 'TriggerName',
    title: 'Trigger Name',
    description:
      "Name of this trigger within its automation, read by a run at `{{trigger.name}}` and recorded on the run. Kebab-case, at most 50 characters, unique within the automation. Defaults to the trigger's type, and is required on every trigger whose type appears more than once in the automation's `triggers` list.",
    defaultNote: "the trigger's type (e.g. `cron`)",
    examples: ['nightly', 'warehouse-hook', 'new-order'],
  }),
  Schema.check(
    Schema.isPattern(TRIGGER_NAME_PATTERN, { message: TRIGGER_NAME_RULE }),
    Schema.isMaxLength(TRIGGER_NAME_MAX_LENGTH, { message: TRIGGER_NAME_RULE })
  )
)

/** @public */
export type TriggerName = Schema.Schema.Type<typeof TriggerNameSchema>
