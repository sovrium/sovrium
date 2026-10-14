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
export const withRecorderLabel = (
  field: ResolvedFormField,
  lang: string,
  languages: Languages | undefined
): ResolvedFormField =>
  field.recordAudioMaxSeconds === undefined
    ? field
    : { ...field, recordAudioLabel: resolveInterpreterString('form.recordAudio', lang, languages) }
