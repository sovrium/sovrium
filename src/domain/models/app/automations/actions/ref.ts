/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Schema } from 'effect'
import { ActionBaseFields } from './base'

/**
 * Action Reference (type: ref, no operator)
 *
 * References a reusable action template defined in app.actions[].
 * Variables in $vars override the template's default variable values.
 */
export const ActionRefSchema = Schema.Struct({
  ...ActionBaseFields,
  /**
   * Discriminator. Optional — when omitted it defaults to `'ref'` since the
   * presence of `$ref` is itself unambiguous. Authors may write either
   * `{ name: 'alert', $ref: 'notify-admin' }` (concise) or the explicit
   * `{ name: 'alert', type: 'ref', $ref: 'notify-admin' }`.
   */
  type: Schema.Literal('ref').pipe(Schema.withDecodingDefaultKey(Effect.succeed('ref' as const))),

  $ref: Schema.String.pipe(
    Schema.check(
      Schema.isPattern(/^[a-z][a-z0-9-]*$/),
      Schema.isMinLength(1),
      Schema.isMaxLength(100)
    ),
    Schema.annotate({
      description: 'Name of the action template to invoke (must match a template in app.actions[])',
    })
  ),

  $vars: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).pipe(
      Schema.annotate({
        description:
          'Variables to substitute in the referenced template (overrides template defaults)',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'ActionRef',
    title: 'Action Template Reference',
    description:
      'Reference to a reusable action template defined in app.actions[], with optional variable overrides',
  })
)

/** @public */
export type ActionRef = Schema.Schema.Type<typeof ActionRefSchema>
