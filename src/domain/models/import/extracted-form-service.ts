/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A form the page converter found on a migrated page, read as the ONE form
 * mapper reads every form: an `ExtractedForm` in, a `CanonicalForm` out.
 *
 * A form drawn on a site page is a Webflow form: the Webflow site export is the
 * one page source whose table turns a form into an extracted form (Retool
 * classic forms post to a query, Notion pages hold none). So its fields are
 * read through Webflow's question table, under the field type Webflow's own
 * Forms API gives the same input — `Plain`, `Email`, `Phone`, `Number` — and
 * an input that type list does not hold keeps its HTML name, which the mapper
 * reports and keeps as text. Nothing is approximated here.
 *
 * - The field's `name` is the question title, so the responses columns carry
 *   the names the page's inputs submitted under, as a Webflow submission does.
 * - A `hidden` input is a hidden field, filled from the form link.
 * - A `password` input is never imported, and the report says so.
 * - The success message and the redirect become the thank-you screen.
 * - The form's `name` is its title, so the forms entry is written under the
 *   name the page's `formRef` already holds.
 * - A site export holds no submission, so there is no response.
 */

import type { CanonicalForm } from './canonical-form'
import type { ExtractedForm, ExtractedFormField } from './extracted-form'

type Question = CanonicalForm['questions'][number]

/** Each HTML input type Webflow's Forms API names, under that name. */
const WEBFLOW_FIELD_TYPES: Readonly<Partial<Record<ExtractedFormField['inputType'], string>>> = {
  text: 'Plain',
  email: 'Email',
  tel: 'Phone',
  number: 'Number',
}

/** The report line for a form that held a password input. */
export const EXTRACTED_PASSWORD_DROPPED =
  'A password input is never imported: neither the field nor anything typed into it.'

/** The choices of a select, a radio group or a checkbox group. */
const choicesOf = (field: ExtractedFormField): Pick<Question, 'choices' | 'allowMultiple'> =>
  field.options === undefined || field.options.length === 0
    ? {}
    : {
        choices: field.options.map((option) => ({ sourceId: option.value, label: option.label })),
        ...(field.inputType === 'checkbox' ? { allowMultiple: true } : {}),
      }

/** One visible input as a question of the form. */
const questionOf = (field: ExtractedFormField, index: number): Question => ({
  sourceId: `${index}:${field.name}`,
  title: field.name,
  sourceType: WEBFLOW_FIELD_TYPES[field.inputType] ?? field.inputType,
  required: field.required,
  ...choicesOf(field),
})

/** The thank-you screen: the success message and the redirect, when the page states them. */
const thankYouOf = (form: ExtractedForm): Pick<CanonicalForm, 'thankYou'> => {
  const message = form.successMessage?.trim()
  const redirectUrl = form.redirect?.trim()
  const screen = {
    ...(message === undefined || message === '' ? {} : { message }),
    ...(redirectUrl === undefined || redirectUrl === '' ? {} : { redirectUrl }),
  }
  return Object.keys(screen).length === 0 ? {} : { thankYou: screen }
}

/** An extracted form as the form mapper reads it. */
export const canonicalFormOfExtracted = (form: ExtractedForm): CanonicalForm => {
  const visible = form.fields.filter(
    (field) => field.inputType !== 'hidden' && field.inputType !== 'password'
  )
  const dropsPassword = form.fields.some((field) => field.inputType === 'password')
  return {
    tool: 'webflow',
    sourceId: form.sourceId,
    title: form.title ?? form.name,
    questions: visible.map(questionOf),
    pages: [],
    rules: [],
    hiddenFields: form.fields
      .filter((field) => field.inputType === 'hidden')
      .map((field) => field.name),
    ...(dropsPassword ? { notExposed: [EXTRACTED_PASSWORD_DROPPED] } : {}),
    ...thankYouOf(form),
    definitionInferred: false,
    responses: [],
  }
}
