/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { Form } from '@/domain/models/app/forms'
import type { Languages } from '@/domain/models/app/languages'

/** The words the save-for-later control is drawn and answers with, in the page language. */
export interface SaveForLaterLabels {
  readonly action: string
  readonly email: string
  readonly send: string
  readonly sent: string
  readonly failed: string
}

/** Resolve the control's words for the document language. */
export const saveForLaterLabels = (
  lang: string | undefined,
  languages: Languages | undefined
): SaveForLaterLabels => ({
  action: resolveInterpreterString('form.saveForLater', lang, languages),
  email: resolveInterpreterString('form.saveForLaterEmail', lang, languages),
  send: resolveInterpreterString('form.saveForLaterSend', lang, languages),
  sent: resolveInterpreterString('form.saveForLaterSent', lang, languages),
  failed: resolveInterpreterString('form.saveForLaterFailed', lang, languages),
})

/**
 * Whether a form body offers "save and continue later", worded: only a form
 * declaring `saveAndResume.enabled`, on its own page (not embedded in another
 * page or a third-party iframe), and never on the page of an edit link.
 */
export const saveForLaterOffer = (
  form: Readonly<Form>,
  where: {
    readonly standalone: boolean
    readonly editing: boolean
    readonly lang: string | undefined
    readonly languages: Languages | undefined
  }
): { readonly saveForLater?: SaveForLaterLabels } =>
  form.saveAndResume?.enabled === true && where.standalone && !where.editing
    ? { saveForLater: saveForLaterLabels(where.lang, where.languages) }
    : {}
