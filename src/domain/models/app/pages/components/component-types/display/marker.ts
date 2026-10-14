/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `marker` — an inline note inside a thread or a list: a status, a system line,
 * a labelled break. shadcn/ui's Marker, under its own name.
 *
 * Four uses, one shape: words with a decorative icon ("Léa joined the thread"),
 * a labelled break that spans its column (`variant: separator`, "Yesterday"), a
 * status announced as it changes (`live: true`, "Generating a reply") and a link
 * back to where the thread came from (`href`).
 *
 * Source: [internal ref]
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const MarkerTypeLiteral = Schema.Literal('marker')

/** How a marker is drawn. */
export const MarkerVariantSchema = Schema.Literals(['default', 'border', 'separator']).annotate({
  title: 'Marker Variant',
  defaultNote: 'default',
  description:
    "'default' (the words alone), 'border' (a rule under them) or 'separator' (the words centred between two rules that span the column). shadcn/ui's Marker variant.",
})

export const markerFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  content: Schema.String.annotate({
    title: 'Content',
    description: 'The words of the note. A `$t:` key is translated.',
    examples: ['Yesterday', 'Léa Moreau joined the thread'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
  icon: Schema.optional(
    Schema.String.annotate({
      title: 'Icon',
      description:
        'A Lucide icon name drawn before the words. Decorative: it is hidden from assistive technology.',
      examples: ['user-plus', 'clock'],
    })
  ),
  variant: Schema.optional(MarkerVariantSchema),
  live: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Live',
      defaultNote: 'false',
      description:
        'Announces the marker as a status (role="status"), for a line that changes while the reader watches, such as "Generating a reply".',
    })
  ),
  href: Schema.optional(
    Schema.String.annotate({
      title: 'Link',
      description: 'Makes the marker a link to this address, named by its words.',
      examples: ['/tickets/4821'],
    })
  ),
} as const
