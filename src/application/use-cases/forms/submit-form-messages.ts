/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The words a refused submission is answered with, in the language the form
 * was served in.
 *
 * A submission names its language with `?lang=` (the page writes it into the
 * form's `action`); without one, the app's default language is read, and an
 * app that declares no languages reads English. A field is named by its label
 * resolved for that language, never by its column, and the sentence around it
 * is the engine's own catalog entry, which an author may override under
 * `sovrium.<key>`.
 */

import { requestedRecordLanguage } from '@/domain/models/app/languages/localized-value-service'
import {
  resolveInterpreterString,
  resolveTranslationPattern,
} from '@/domain/models/app/languages/translation-resolver'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** Who reads a refusal: the app's languages and the one the submission was made in. */
export interface SubmissionReader {
  readonly app: Readonly<App>
  /** The submission's `?lang=`, as posted. */
  readonly lang: string | undefined
}

/** The declared language a submission is answered in, or `undefined` for an app with none. */
const readerLanguage = (reader: SubmissionReader): string | undefined =>
  requestedRecordLanguage(reader.app.languages, reader.lang, undefined)

/** A `$t:` text resolved for the reader; a plain text is returned as written. */
export const translatedForReader = (reader: SubmissionReader, text: string): string =>
  resolveTranslationPattern(text, readerLanguage(reader) ?? '', reader.app.languages)

/**
 * The label of the form field that writes `column` — the column itself, or
 * the field whose mapping targets it — resolved for the reader. The column
 * name only when the field has no label.
 */
export const fieldLabelForReader = (
  reader: SubmissionReader,
  form: Readonly<Form>,
  column: string
): string => {
  const mapping = form.submitTo?.mapping ?? {}
  const field = form.fields.find(
    (candidate) =>
      candidate.kind === 'table-field' &&
      (candidate.column === column || mapping[candidate.column] === column)
  )
  const label = field?.kind === 'table-field' ? field.label : undefined
  return label === undefined || label === '' ? column : translatedForReader(reader, label)
}

/** The engine sentence `key` for the reader, its `{label}` filled with `label`. */
export const engineMessageForReader = (
  reader: SubmissionReader,
  key: string,
  label: string
): string =>
  resolveInterpreterString(key, readerLanguage(reader), reader.app.languages)
    .split('{label}')
    .join(label)
