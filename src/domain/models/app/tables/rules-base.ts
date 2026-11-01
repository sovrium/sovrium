/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The keys every business rule shares, whatever its `kind`: its `name`, the
 * `message` a refused write answers with, and the roles it does not bind.
 *
 * Which roles `exemptRoles` may name, and that a `$t:` message is translated in
 * every language, depend on the whole app, so they are judged with the app
 * (`business-rule-validation.ts`), not here.
 */

/** Longest name a rule may carry: it is quoted in every refusal it answers. */
const MAX_RULE_NAME_LENGTH = 50

/** kebab-case: lowercase words of letters and digits joined by single hyphens. */
const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/** At least one character that is not white space. */
const NOT_BLANK = /\S/

export const BusinessRuleNameSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      "The rule's name, unique within the table: lowercase words joined by hyphens, at most 50 characters (`invoice-frozen-once-validated`). A refused write names the rule it broke, so a client can tell two refusals apart.",
  }),
  Schema.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(MAX_RULE_NAME_LENGTH),
    Schema.isPattern(KEBAB_CASE, {
      message:
        'A rule name is lowercase words joined by hyphens, e.g. invoice-frozen-once-validated',
    })
  )
)

export const BusinessRuleMessageSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      'What a refused write answers, shown to the person who made it. Plain text, or a `$t:` key translated in every language the app declares.',
  }),
  Schema.check(Schema.isPattern(NOT_BLANK, { message: 'A rule message cannot be empty' }))
)

export const BusinessRuleExemptRolesSchema = Schema.Array(
  Schema.String.pipe(
    Schema.annotate({ description: 'A role this rule does not bind.' }),
    Schema.check(Schema.isMinLength(1))
  )
).pipe(
  Schema.annotate({
    description:
      'The roles this rule does not bind. Each must be a role the app declares. Every other caller is bound: an admin, the top role, an automation, the AI chat and the MCP tools included.',
    defaultNote: 'none: the rule binds everyone, admins included',
  })
)
