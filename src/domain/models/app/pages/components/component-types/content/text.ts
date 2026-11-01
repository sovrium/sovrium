/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { sessionFields } from '../../session-binding'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const TextTypeLiteral = Schema.Literal('text')

/**
 * The elements a `text` node may name. One tuple, read by the `element` field
 * here and by `design.components.text.elements`, which is keyed by the same
 * names so a styling rule exists for exactly the elements a text can be.
 */
export const TEXT_ELEMENTS = [
  'p',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'label',
  'pre',
  'kbd',
  'blockquote',
  'code',
] as const

/** One element a `text` node may name. */
export type TextElement = (typeof TEXT_ELEMENTS)[number]

export const TextElementSchema = Schema.Literals(TEXT_ELEMENTS).annotate({
  defaultNote: 'span',
  title: 'Text Element',
  description: 'HTML element to render. Without one, the text is drawn as a `span`.',
})

export const textFields = {
  ...coreFields,
  ...contentFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...sessionFields,
  element: Schema.optional(TextElementSchema),
  required: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'When rendered as a <label> element, appends a required-indicator (*) after the label text.',
    })
  ),
} as const
