/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { ResolvedFormField } from './form-field-elements'
import type { Languages } from '@/domain/models/app/languages'

/**
 * A field that records audio, with its Record button worded in the page
 * language (`form.recordAudio`); any other field comes back unchanged. The
 * Stop button the runtime draws reads `form.stopRecording` from its strings.
 */
const withRecorderLabel = (
  field: ResolvedFormField,
  lang: string,
  languages: Languages | undefined
): ResolvedFormField =>
  field.recordAudioMaxSeconds === undefined
    ? field
    : { ...field, recordAudioLabel: resolveInterpreterString('form.recordAudio', lang, languages) }

/**
 * A field with the words the page draws around its control in the page
 * language: the Record button (above), a drop zone's prompt (`form.dropFiles`),
 * a user picker's empty choice when the field declares no placeholder
 * (`form.selectUser`), and a date picker's calendar button and calendar
 * (`datePicker.pick`, `datePicker.choose`). Any other field comes back unchanged.
 */
export const withFieldEngineWords = (
  field: ResolvedFormField,
  lang: string,
  languages: Languages | undefined
): ResolvedFormField => {
  const word = (key: string) => resolveInterpreterString(key, lang, languages)
  const recorded = withRecorderLabel(field, lang, languages)
  return {
    ...recorded,
    ...(field.dropZone === true && { dropZoneLabel: word('form.dropFiles') }),
    ...(field.inputElement === 'user' &&
      field.placeholder === '' && { placeholder: word('form.selectUser') }),
    ...(field.inputElement === 'date' && {
      pickDateLabel: word('datePicker.pick'),
      chooseDateLabel: word('datePicker.choose'),
    }),
  }
}
