/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The id a purpose is referred to by: from a page script's `consent` key, from a
 * `consent-choice` control's `purpose`, and in the visitor's stored choice.
 *
 * Lowercase letters, digits and hyphens, starting with a letter. `analytics` is
 * the id the built-in analytics answers to.
 */
export const ConsentPurposeIdSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      "Id of the purpose, referred to by a page script's consent key and by a consent-choice control. The id analytics names the built-in analytics.",
    examples: ['analytics', 'support-chat'],
  }),
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/), Schema.isMaxLength(50))
)

/** One purpose the visitor is asked about. */
export const ConsentPurposeDeclarationSchema = Schema.Struct({
  id: ConsentPurposeIdSchema,
  label: Schema.String.pipe(
    Schema.annotate({
      description: 'Name of the purpose shown to the visitor. Accepts a $t: translation key.',
      examples: ['$t:consent.analytics.label'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  description: Schema.String.pipe(
    Schema.annotate({
      description:
        'One or two sentences telling the visitor what the purpose is for. Accepts a $t: translation key.',
      examples: ['$t:consent.analytics.description'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({
  title: 'Consent Purpose',
  description: 'A purpose the visitor is asked to accept or refuse.',
})

/**
 * The purposes, at least one, each id declared once: the id is what a script
 * and a stored choice refer to, so a second declaration would make it ambiguous.
 */
export const ConsentPurposesSchema = Schema.Array(ConsentPurposeDeclarationSchema).pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.annotate({
    identifier: 'ConsentPurposes',
    title: 'Consent Purposes',
    description: 'The purposes the visitor is asked about, at least one, each id declared once.',
  }),
  Schema.check(
    Schema.makeFilter((purposes) => {
      const ids = purposes.map((purpose) => purpose.id)
      return ids.length === new Set(ids).size || 'Consent purpose ids must be unique'
    })
  )
)

/** @public */
export type ConsentPurposeDeclaration = Schema.Schema.Type<typeof ConsentPurposeDeclarationSchema>
/** @public */
export type ConsentPurposes = Schema.Schema.Type<typeof ConsentPurposesSchema>
