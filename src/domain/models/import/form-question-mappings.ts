/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The question tables: one per form source, question type → the column a
 * table-bound form writes it to.
 *
 * Every imported form is table-bound. Its questions become columns of a
 * generated `<form>_responses` table (an Airtable form view binds to its own,
 * already imported table) and the form's fields are `table-field` entries
 * naming those columns. So a question maps to a Sovrium FIELD TYPE, the same
 * vocabulary as the field-type tables, and validation and storage follow from
 * the column exactly as for a form written by hand.
 *
 * ## Three outcomes
 *
 * - a field type: the question becomes a column and a form field;
 * - `structural`: the question is layout, not an answer — a page break becomes
 *   a step boundary, a statement or a heading becomes a section;
 * - absent from the table: the question becomes a `long-text` column holding
 *   each answer's text, and the report names it. A matrix, a ranking or a
 *   payment is never approximated into a widget that would validate.
 *
 * Typeform, Jotform and Google Forms rows follow their documented APIs; the
 * Tally and Fillout spellings follow the pinned captures and their published
 * enums. A signature becomes a file holding its image (see `SIGNATURE_LOSS`).
 * A Google Forms type is suffixed with what changes its column (`.paragraph`,
 * `.time`). Microsoft Forms exposes no definition: its columns are typed by the
 * shared inference, keyed here by the inferred kind, and the report says the
 * definition was inferred.
 */

import type { ImportSourceTool } from './import-source'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

/**
 * What a migrated signature loses. A seed cannot write a `signature` value
 * (the signer, the instant and the statement are captured by the signature pad
 * itself), so the image the source kept becomes a file of the record.
 */
const SIGNATURE_LOSS =
  'The signature image is kept as a file; the signer, the signing time and the statement agreed to are not in the source export'

/** One row of a question table. */
export interface QuestionMapping {
  /** The question type, in the tool's own spelling. */
  readonly source: string
  /** The column type it becomes, or `structural` for layout. */
  readonly sovrium: FieldType | 'structural'
  /** What the mapping loses; printed as `degraded`. */
  readonly loss?: string
}

/** The tools whose forms become Sovrium forms. */
export type FormSourceTool = Extract<
  ImportSourceTool,
  'typeform' | 'jotform' | 'google-forms' | 'tally' | 'fillout' | 'microsoft-forms' | 'webflow'
>

/** The suffix of the table a migrated form writes to. */
export const RESPONSES_TABLE_SUFFIX = '_responses'

/** The column type an unlisted question becomes; each answer's text is kept. */
export const UNMAPPED_QUESTION_TYPE: FieldType = 'long-text'

const TYPEFORM: readonly QuestionMapping[] = [
  { source: 'short_text', sovrium: 'single-line-text' },
  { source: 'long_text', sovrium: 'long-text' },
  { source: 'email', sovrium: 'email' },
  { source: 'number', sovrium: 'number' },
  { source: 'phone_number', sovrium: 'phone-number' },
  { source: 'website', sovrium: 'url' },
  { source: 'date', sovrium: 'date' },
  {
    source: 'multiple_choice',
    sovrium: 'single-select',
    loss: "With 'allow multiple selection' it becomes a multi-select; an 'other' answer is kept as an extra choice",
  },
  { source: 'dropdown', sovrium: 'single-select' },
  { source: 'picture_choice', sovrium: 'single-select', loss: 'The pictures are not kept' },
  { source: 'yes_no', sovrium: 'checkbox' },
  { source: 'legal', sovrium: 'checkbox' },
  { source: 'opinion_scale', sovrium: 'integer' },
  { source: 'nps', sovrium: 'integer' },
  { source: 'rating', sovrium: 'rating' },
  { source: 'file_upload', sovrium: 'single-attachment' },
  { source: 'statement', sovrium: 'structural' },
  { source: 'group', sovrium: 'structural' },
]

const JOTFORM: readonly QuestionMapping[] = [
  { source: 'control_textbox', sovrium: 'single-line-text' },
  { source: 'control_textarea', sovrium: 'long-text' },
  { source: 'control_email', sovrium: 'email' },
  { source: 'control_number', sovrium: 'number' },
  { source: 'control_spinner', sovrium: 'number' },
  { source: 'control_phone', sovrium: 'phone-number' },
  {
    source: 'control_fullname',
    sovrium: 'single-line-text',
    loss: 'The name parts are joined into one value',
  },
  {
    source: 'control_address',
    sovrium: 'long-text',
    loss: 'The address parts are joined into one value, one part per line',
  },
  { source: 'control_dropdown', sovrium: 'single-select' },
  { source: 'control_radio', sovrium: 'single-select' },
  { source: 'control_checkbox', sovrium: 'multi-select' },
  { source: 'control_datetime', sovrium: 'date' },
  { source: 'control_time', sovrium: 'time' },
  { source: 'control_fileupload', sovrium: 'multiple-attachments' },
  { source: 'control_rating', sovrium: 'rating' },
  { source: 'control_scale', sovrium: 'integer' },
  { source: 'control_signature', sovrium: 'single-attachment', loss: SIGNATURE_LOSS },
  { source: 'control_birthdate', sovrium: 'date' },
  { source: 'control_autocomp', sovrium: 'single-line-text' },
  { source: 'control_head', sovrium: 'structural' },
  { source: 'control_collapse', sovrium: 'structural' },
  { source: 'control_image', sovrium: 'structural' },
  { source: 'control_captcha', sovrium: 'structural' },
  { source: 'control_text', sovrium: 'structural' },
  { source: 'control_pagebreak', sovrium: 'structural' },
  { source: 'control_button', sovrium: 'structural' },
]

const GOOGLE_FORMS: readonly QuestionMapping[] = [
  { source: 'textQuestion', sovrium: 'single-line-text' },
  { source: 'textQuestion.paragraph', sovrium: 'long-text' },
  { source: 'choiceQuestion.RADIO', sovrium: 'single-select' },
  { source: 'choiceQuestion.DROP_DOWN', sovrium: 'single-select' },
  { source: 'choiceQuestion.CHECKBOX', sovrium: 'multi-select' },
  {
    source: 'rowQuestion',
    sovrium: 'single-select',
    loss: 'Each row of the grid becomes a choice question of its own, its choices the grid columns',
  },
  { source: 'scaleQuestion', sovrium: 'integer' },
  { source: 'ratingQuestion', sovrium: 'rating' },
  { source: 'dateQuestion', sovrium: 'date' },
  { source: 'dateQuestion.time', sovrium: 'datetime' },
  {
    source: 'dateQuestion.noYear',
    sovrium: 'single-line-text',
    loss: 'A date asked without its year is kept as its month and day, as text',
  },
  { source: 'timeQuestion', sovrium: 'time' },
  {
    source: 'timeQuestion.duration',
    sovrium: 'single-line-text',
    loss: 'An elapsed time is kept as text',
  },
  {
    source: 'fileUploadQuestion',
    sovrium: 'long-text',
    loss: 'Uploaded files are Google Drive files, read through another API and scope: each answer keeps the file names and their Drive ids, and the files are not copied',
  },
  { source: 'respondentEmail', sovrium: 'email' },
  { source: 'pageBreakItem', sovrium: 'structural' },
  { source: 'textItem', sovrium: 'structural' },
  { source: 'imageItem', sovrium: 'structural' },
  { source: 'videoItem', sovrium: 'structural' },
]

/**
 * Microsoft Forms exposes no question type: each response column's type is
 * the kind the shared inference read from its values (`inferred-types-service`),
 * plus `choices` for a column whose answers are lists closed by `;`.
 */
const MICROSOFT_FORMS: readonly QuestionMapping[] = [
  { source: 'boolean', sovrium: 'checkbox' },
  { source: 'integer', sovrium: 'integer' },
  { source: 'decimal', sovrium: 'decimal' },
  { source: 'percent', sovrium: 'decimal', loss: 'The percent sign is not kept' },
  { source: 'currency', sovrium: 'decimal', loss: 'The currency is not kept' },
  { source: 'date', sovrium: 'date' },
  { source: 'datetime', sovrium: 'datetime' },
  { source: 'time', sovrium: 'time' },
  { source: 'email', sovrium: 'email' },
  { source: 'url', sovrium: 'url' },
  { source: 'choices', sovrium: 'multi-select' },
  { source: 'multiline-text', sovrium: 'long-text' },
  { source: 'text', sovrium: 'single-line-text' },
]

const TALLY: readonly QuestionMapping[] = [
  { source: 'INPUT_TEXT', sovrium: 'single-line-text' },
  { source: 'TEXTAREA', sovrium: 'long-text' },
  { source: 'INPUT_EMAIL', sovrium: 'email' },
  { source: 'INPUT_NUMBER', sovrium: 'number' },
  { source: 'INPUT_PHONE_NUMBER', sovrium: 'phone-number' },
  { source: 'INPUT_LINK', sovrium: 'url' },
  { source: 'INPUT_DATE', sovrium: 'date' },
  { source: 'INPUT_TIME', sovrium: 'time' },
  { source: 'MULTIPLE_CHOICE', sovrium: 'single-select' },
  { source: 'DROPDOWN', sovrium: 'single-select' },
  { source: 'CHECKBOXES', sovrium: 'multi-select' },
  { source: 'MULTI_SELECT', sovrium: 'multi-select' },
  { source: 'LINEAR_SCALE', sovrium: 'integer' },
  { source: 'RATING', sovrium: 'rating' },
  { source: 'FILE_UPLOAD', sovrium: 'multiple-attachments' },
  { source: 'SIGNATURE', sovrium: 'single-attachment', loss: SIGNATURE_LOSS },
  { source: 'PAGE_BREAK', sovrium: 'structural' },
  { source: 'TITLE', sovrium: 'structural' },
  { source: 'TEXT', sovrium: 'structural' },
  { source: 'LABEL', sovrium: 'structural' },
  { source: 'HEADING_1', sovrium: 'structural' },
  { source: 'HEADING_2', sovrium: 'structural' },
  { source: 'HEADING_3', sovrium: 'structural' },
  { source: 'DIVIDER', sovrium: 'structural' },
  { source: 'IMAGE', sovrium: 'structural' },
  { source: 'EMBED', sovrium: 'structural' },
  { source: 'EMBED_VIDEO', sovrium: 'structural' },
  { source: 'EMBED_AUDIO', sovrium: 'structural' },
  { source: 'CAPTCHA', sovrium: 'structural' },
]

const FILLOUT: readonly QuestionMapping[] = [
  { source: 'ShortAnswer', sovrium: 'single-line-text' },
  { source: 'LongAnswer', sovrium: 'long-text' },
  { source: 'EmailInput', sovrium: 'email' },
  { source: 'NumberInput', sovrium: 'number' },
  { source: 'PhoneNumber', sovrium: 'phone-number' },
  { source: 'URLInput', sovrium: 'url' },
  { source: 'DatePicker', sovrium: 'date' },
  { source: 'TimePicker', sovrium: 'time' },
  { source: 'MultipleChoice', sovrium: 'single-select' },
  { source: 'Dropdown', sovrium: 'single-select' },
  { source: 'Checkboxes', sovrium: 'multi-select' },
  { source: 'MultiSelect', sovrium: 'multi-select' },
  { source: 'Checkbox', sovrium: 'checkbox' },
  { source: 'Switch', sovrium: 'checkbox' },
  { source: 'DateTimePicker', sovrium: 'datetime' },
  { source: 'CurrencyInput', sovrium: 'number', loss: 'The currency is not stated by the API' },
  { source: 'OpinionScale', sovrium: 'integer' },
  { source: 'StarRating', sovrium: 'rating' },
  { source: 'FileUpload', sovrium: 'multiple-attachments' },
  { source: 'Signature', sovrium: 'single-attachment', loss: SIGNATURE_LOSS },
]

/**
 * Webflow, as its Forms API types a field (Plain, Email, Phone, Number). The
 * API states no required flag, no options and no validation. A Password
 * field is never read: its answers are left out by the adapter.
 */
const WEBFLOW: readonly QuestionMapping[] = [
  { source: 'Plain', sovrium: 'single-line-text' },
  { source: 'Email', sovrium: 'email' },
  { source: 'Phone', sovrium: 'phone-number' },
  { source: 'Number', sovrium: 'number' },
]

/** Every form source's question table. */
export const QUESTION_MAPPINGS: Readonly<Record<FormSourceTool, readonly QuestionMapping[]>> = {
  typeform: TYPEFORM,
  jotform: JOTFORM,
  'google-forms': GOOGLE_FORMS,
  tally: TALLY,
  fillout: FILLOUT,
  'microsoft-forms': MICROSOFT_FORMS,
  webflow: WEBFLOW,
}

/** The outcome of looking one question type up. */
export type QuestionLookup =
  | { readonly outcome: 'mapped'; readonly sovrium: FieldType }
  | { readonly outcome: 'degraded'; readonly sovrium: FieldType; readonly reason: string }
  | { readonly outcome: 'structural' }
  | { readonly outcome: 'unmapped'; readonly sovrium: FieldType }

/** Look a question type up in its tool's table. */
export const lookupQuestion = (tool: FormSourceTool, sourceType: string): QuestionLookup => {
  const row = QUESTION_MAPPINGS[tool].find((mapping) => mapping.source === sourceType)
  if (row === undefined) return { outcome: 'unmapped', sovrium: UNMAPPED_QUESTION_TYPE }
  if (row.sovrium === 'structural') return { outcome: 'structural' }
  if (row.loss !== undefined) return { outcome: 'degraded', sovrium: row.sovrium, reason: row.loss }
  return { outcome: 'mapped', sovrium: row.sovrium }
}
