/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const ConsentChoiceTypeLiteral = Schema.Literal('consent-choice')

/**
 * The purpose a control decides: a purpose id the app declares in
 * `consent.purposes`, or `analytics`, the built-in analytics, which stays valid
 * without a `consent` block. The app-level consent check resolves the id.
 */
export const ConsentPurposeSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      "The purpose this control decides: a purpose id declared in consent.purposes, or 'analytics', the built-in analytics.",
    examples: ['analytics'],
  }),
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/), Schema.isMaxLength(50))
)

/**
 * A visitor's own choice about one purpose, placed by configuration.
 *
 * Renders a toggle button whose accessible name never changes and whose
 * `aria-pressed` says whether the purpose is on for this visitor, a status line
 * saying what is happening now, and a message shown instead when the browser
 * runs no JavaScript. The choice is kept in the visitor's own browser, so it
 * holds across reloads and later visits on the same site until they change it.
 * A browser privacy signal the site honours takes precedence over the stored
 * choice, and the status line says so.
 */
export const consentChoiceFields = {
  ...coreFields,
  ...visibilityFields,
  purpose: ConsentPurposeSchema,
  label: Schema.optional(
    Schema.String.annotate({
      description:
        'Accessible name and text of the toggle button. It stays the same in both states; the pressed state carries the choice.',
    })
  ),
  grantedText: Schema.optional(
    Schema.String.annotate({
      description: 'Status line shown while the purpose is on for this visitor.',
    })
  ),
  deniedText: Schema.optional(
    Schema.String.annotate({
      description: 'Status line shown while this visitor has turned the purpose off.',
    })
  ),
  signalText: Schema.optional(
    Schema.String.annotate({
      description:
        'Status line shown while a browser privacy signal the site honours (Global Privacy Control or Do Not Track) keeps the purpose off, whatever the stored choice says.',
    })
  ),
  noScriptText: Schema.optional(
    Schema.String.annotate({
      description:
        'Message shown in place of the button when the browser runs no JavaScript, in which case nothing is measured.',
    })
  ),
} as const
