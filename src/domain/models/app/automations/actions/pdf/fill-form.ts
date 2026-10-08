/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { DocumentOutputSchema, FileRefSchema } from '../document/shared'

/**
 * The value of one form field: text for a text field, `true`/`false` for a
 * checkbox, the chosen option for a radio group or a dropdown, a list of
 * options for a multiple-choice list. A number is written as text.
 */
const FormFieldValueSchema = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Array(Schema.String),
]).pipe(
  Schema.annotate({
    description:
      'Text for a text field (a number is written as text), true or false for a checkbox, the option to choose for a radio group or a dropdown, a list of options for a multiple-choice list',
  })
)

/**
 * PDF Fill Form Action (type: pdf, operator: fillForm)
 *
 * Write values into the form fields of a PDF, by field name. A name the form
 * does not have fails the step naming it, so a renamed field never fails
 * silently; fields not named keep their values. With `flatten`, the values
 * become part of the page and the form is gone.
 */
export const PdfFillFormActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('pdf').pipe(
    Schema.annotate({
      description: "Constant value 'pdf' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('fillForm').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'pdf' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    file: FileRefSchema,
    fields: Schema.Union([
      Schema.Record(Schema.String, FormFieldValueSchema).pipe(
        Schema.annotate({
          description:
            "Values by field name, as the form names its fields (e.g. { client_name: '{{trigger.data.name}}', accepts_terms: true })",
        })
      ),
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            "One template resolving to the whole name → value map at run time (e.g. '{{steps.buildAnswers.result}}')",
        })
      ),
    ]).pipe(
      Schema.annotate({
        description:
          'The values to write, by field name: a map written in the config, or one template resolving to such a map at run time',
      })
    ),
    flatten: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          defaultNote: 'false',
          description:
            'Turn the filled fields into page content: the values stay visible and printable, and nobody can edit them any more',
        })
      )
    ),
    output: DocumentOutputSchema,
  }).pipe(
    Schema.annotate({
      description:
        'The PDF form, the values to write by field name, whether to flatten it, and where the result is written.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'PdfFillFormAction',
    title: 'PDF Fill Form Action',
    description: 'Fill the form fields of a PDF from data, optionally flattening them',
  })
)

/** @public */
export type PdfFillFormAction = Schema.Schema.Type<typeof PdfFillFormActionSchema>
