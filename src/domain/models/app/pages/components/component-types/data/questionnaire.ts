/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `questionnaire` — one question per screen, answered by choosing, with a count
 * of how many remain. shadcn/ui's Questionnaire, under its own name.
 *
 * ## One submission, through a form the app already declares
 *
 * The answers are held in the page and submitted ONCE, at the end, through the
 * top-level form `formRef` names: that form owns the validation, the storage
 * and the permissions, so there is no second write path. Nothing is written
 * before the last screen. Each item's `name` is a field of that form, checked
 * at validation (`questionnaire-validation.ts`), as is the form itself.
 *
 * ## Not a stepper, not a wizard
 *
 * A `stepper` walks through arbitrary bodies and writes nothing; a `form` in
 * wizard mode walks through groups of record fields. A questionnaire is one
 * prompt with its choices per screen: a single choice moves on by itself, a
 * multiple item waits for Next, an optional item offers Skip.
 *
 * Source: [internal ref]
 */

import { Schema } from 'effect'
import { FormNameSchema } from '../../../../forms/name'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const QuestionnaireTypeLiteral = Schema.Literal('questionnaire')

const nonEmpty = (title: string, description: string) =>
  Schema.String.annotate({ title, description }).pipe(Schema.check(Schema.isMinLength(1)))

/** One answer an item offers. */
export const QuestionnaireChoiceSchema = Schema.Struct({
  value: nonEmpty('Value', 'What is stored when this choice is picked.'),
  label: nonEmpty('Label', 'What the reader reads and picks.'),
  description: Schema.optional(Schema.String.annotate({ description: 'A line under the label.' })),
}).annotate({ title: 'Questionnaire Choice', description: 'One answer an item offers.' })

/** One question: one screen. */
export const QuestionnaireItemSchema = Schema.Struct({
  name: nonEmpty('Field Name', 'The field of the `formRef` form this answer is stored in.'),
  prompt: nonEmpty('Prompt', 'The question, as the reader reads it.'),
  description: Schema.optional(
    Schema.String.annotate({ description: 'A line under the question.' })
  ),
  choices: Schema.optional(
    Schema.Array(QuestionnaireChoiceSchema)
      .annotate({
        description: 'The answers offered. Required unless the item takes a typed `input`.',
      })
      .pipe(Schema.check(Schema.isMinLength(1)))
  ),
  multiple: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'false',
      description:
        'Several choices may be kept; the reader moves on with Next instead of by choosing.',
    })
  ),
  required: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'true',
      description: 'false offers Skip, and a skipped answer is stored empty.',
    })
  ),
  input: Schema.optional(
    Schema.Struct({
      label: nonEmpty('Input Label', 'The name of the text box.'),
      placeholder: Schema.optional(
        Schema.String.annotate({ description: 'A hint shown in the empty box.' })
      ),
    }).annotate({
      description: 'A typed answer instead of choices: a text box with its label.',
    })
  ),
  shortcuts: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'false',
      description: 'The number keys pick the choices in order: 1 for the first, 2 for the second.',
    })
  ),
}).annotate({ title: 'Questionnaire Item', description: 'One question, on one screen.' })

export const questionnaireFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  formRef: FormNameSchema.annotate({
    description:
      'The top-level form (app.forms[].name) the answers are submitted through, once, at the end. Required: the form owns the validation, the storage and the permissions.',
  }),
  items: Schema.Array(QuestionnaireItemSchema)
    .annotate({ description: 'The questions, in order: one per screen.' })
    .pipe(Schema.check(Schema.isMinLength(1))),
  showProgress: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'true',
      description: 'Prints "Question N of M" above each question.',
    })
  ),
  submitLabel: Schema.optional(
    Schema.String.annotate({ defaultNote: 'Submit', description: 'The words on the last button.' })
  ),
  nextLabel: Schema.optional(
    Schema.String.annotate({ defaultNote: 'Next', description: 'The words on the Next button.' })
  ),
  previousLabel: Schema.optional(
    Schema.String.annotate({
      defaultNote: 'Previous',
      description: 'The words on the Previous button.',
    })
  ),
  skipLabel: Schema.optional(
    Schema.String.annotate({ defaultNote: 'Skip', description: 'The words on the Skip button.' })
  ),
} as const
