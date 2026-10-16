/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/**
 * An alert dialog's typed confirmation: the text to type (already substituted
 * by the page pass) and, when there is one, the field's label in the page
 * language — `{text}` filled by the island once the text is known.
 */
export const typedConfirmPrompt = (
  page: { readonly currentLang?: string; readonly languages?: Languages },
  confirmText: unknown
) => {
  if (typeof confirmText !== 'string' || confirmText.trim() === '') return { confirmText }
  const word = (key: string) => resolveInterpreterString(key, page.currentLang, page.languages)
  return {
    confirmText,
    confirmPrompt: {
      named: word('dialog.typeToConfirm'),
      asked: word('dialog.typeToConfirmAsked'),
    },
  }
}
