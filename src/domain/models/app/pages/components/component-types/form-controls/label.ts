/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `label` — the visible name of one form control, wired to it so a click
 * focuses the control. shadcn/ui's Label, under its own name.
 *
 * ## Why a type, when `text` can already render a `<label>`
 *
 * A `text` with `element: label` renders the element but has no key for `for`:
 * the association has to be smuggled through `props.htmlFor`, and nothing checks
 * that it names anything. Here `for` is a first-class key, and a `for` that
 * names no component of the label's own page is refused at validation
 * (`label-for-validation.ts`) — a `<label for>` cannot reach another document,
 * so a label pointing elsewhere is a click that focuses nothing.
 *
 * ## The required mark stays out of the control's name
 *
 * `required` draws the mark after the text, hidden from assistive technology,
 * so the control is announced by the words the author wrote ("Work email"), not
 * by "Work email star".
 *
 * Source: [internal ref]
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const LabelTypeLiteral = Schema.Literal('label')

export const labelFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  text: Schema.String.annotate({
    title: 'Label Text',
    description:
      'The words that name the control, which are also its accessible name. A `$t:` key is translated.',
    examples: ['Work email', '$t:signup.email'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
  for: Schema.optional(
    Schema.String.annotate({
      title: 'For',
      description:
        "The `props.id` of the control this label names, on the same page: a click on the label focuses it. Refused when no component of the label's page carries that id. shadcn/ui's Label htmlFor.",
      examples: ['signup-email'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  required: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Required',
      defaultNote: 'false',
      description:
        "Draws the required mark after the text. The mark is hidden from assistive technology, so the control's name stays the text alone.",
    })
  ),
} as const
