/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'

/**
 * How a `browser/run` step names the element it acts on.
 *
 * The locator says what a PERSON sees — a role and its accessible name, a
 * field's label, visible text, a placeholder — before it says how the page is
 * built. `testId` and `selector` exist for the pages where nothing visible is
 * stable; they are the last resort, not the default, because a redesign of
 * the site breaks them first.
 *
 * Exactly one way of finding the element per locator. `name` narrows `role`
 * only; `exact` and `nth` refine whichever way was chosen.
 */

/** The ways of finding an element; exactly one of them per locator. */
export const LOCATOR_KINDS = ['role', 'label', 'text', 'placeholder', 'testId', 'selector'] as const

/** The ARIA roles a `role` locator accepts. */
export const LOCATOR_ROLES = [
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'option',
  'switch',
  'tab',
  'tabpanel',
  'menuitem',
  'heading',
  'row',
  'cell',
  'grid',
  'gridcell',
  'dialog',
  'alertdialog',
  'alert',
  'status',
  'progressbar',
  'img',
  'table',
  'list',
  'listitem',
  'navigation',
  'main',
  'region',
  'form',
  'spinbutton',
  'slider',
] as const

export const BrowserStepLocatorSchema = Schema.Struct({
  role: Schema.optional(
    Schema.Literals(LOCATOR_ROLES).pipe(
      Schema.annotate({
        description:
          'The ARIA role of the element (button, link, textbox, checkbox, combobox, row, …), the way assistive technology names it. Pair it with `name`.',
      })
    )
  ),
  name: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The accessible name the element with that `role` must have (a button reading "Submit", a link reading "Invoices"). Only with `role`.',
      })
    )
  ),
  label: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The text of the label attached to a form field ("Email address"). The usual way to reach a field.',
      })
    )
  ),
  text: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Visible text the element contains, for elements that are neither a field nor a named control.',
      })
    )
  ),
  placeholder: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description: "The field's placeholder text, for a field that has no label.",
      })
    )
  ),
  testId: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "The value of the element's `data-testid` attribute, when the site provides one.",
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  selector: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'A CSS selector. The last resort: it depends on how the page is built, so it is the first thing a redesign of the site breaks.',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  exact: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'Match `name`, `label`, `text` or `placeholder` exactly, case included. By default the match is case-insensitive and accepts the text as part of a longer one.',
      })
    )
  ),
  nth: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Which match to use when several elements match, counted from 0. Without it, a locator matching more than one element fails the step rather than guessing.',
      }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 999 }))
    )
  ),
})
  .annotate({
    title: 'Browser Step Locator',
    description:
      'How the step finds its element: exactly one of `role` (with `name`), `label`, `text`, `placeholder`, `testId` or `selector`, refined by `exact` and `nth`.',
  })
  .pipe(
    Schema.check(
      Schema.makeFilter(
        (locator) =>
          LOCATOR_KINDS.filter((kind) => locator[kind] !== undefined).length === 1 &&
          (locator.name === undefined || locator.role !== undefined),
        {
          message:
            'a locator takes exactly one of `role`, `label`, `text`, `placeholder`, `testId` and `selector`; `name` requires `role`',
        }
      )
    )
  )

/** @public */
export type BrowserStepLocator = Schema.Schema.Type<typeof BrowserStepLocatorSchema>
