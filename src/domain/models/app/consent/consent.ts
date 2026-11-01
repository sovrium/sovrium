/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConsentPurposesSchema } from './purposes'

/**
 * `consent`: the purposes a visitor is asked to accept or refuse, the page
 * that explains them, and how many days a choice is kept before it is asked
 * again.
 *
 * Declared, it holds back what it gates until the visitor accepts the matching
 * purpose: a page script whose `consent` names the purpose, and, when a purpose
 * with id `analytics` is declared, the built-in analytics and the page
 * `meta.analytics` providers. Cross-property rules (a script's `consent` naming
 * a declared purpose, providers needing an `analytics` purpose) are checked at
 * the app level, in `consent-validation.ts`.
 */
export const ConsentSchema = Schema.Struct({
  purposes: ConsentPurposesSchema,
  policyHref: Schema.String.pipe(
    Schema.annotate({
      description:
        'Address of the page explaining the purposes: a path on this site (/privacy) or an http(s) URL.',
      examples: ['/privacy-policy'],
    }),
    Schema.check(Schema.isPattern(/^(\/(?!\/)|https?:\/\/)\S*$/))
  ),
  expiresAfterDays: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        title: 'Expires After Days',
        description:
          'Days a visitor’s choice is kept before they are asked again (1-730). This is a product default, chosen by Sovrium.',
        defaultNote: '180',
      }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 730 }))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'Consent',
    title: 'Visitor Consent',
    description:
      'Purposes the visitor is asked to accept or refuse before what they gate runs, the page explaining them, and how long a choice is kept.',
    examples: [
      {
        purposes: [
          {
            id: 'analytics',
            label: '$t:consent.analytics.label',
            description: '$t:consent.analytics.description',
          },
        ],
        policyHref: '/privacy-policy',
        expiresAfterDays: 180,
      },
    ],
  })
)

/** @public */
export type Consent = Schema.Schema.Type<typeof ConsentSchema>

/** @public */
export type ConsentEncoded = Schema.Codec.Encoded<typeof ConsentSchema>
