/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { FormLayoutKeys } from './form-layout-keys'
import type { Form } from '@/domain/models/app/forms'
import type { Languages } from '@/domain/models/app/languages'

/** A form's layout keys, with its save bar worded in `lang` when it asks for one. */
export const formLayoutKeys = (
  form: Form,
  lang: string,
  languages: Languages | undefined
): FormLayoutKeys => ({
  labelPlacement: form.labelPlacement,
  stickyActions: form.stickyActions,
  ...(form.stickyActions === true && {
    saveBarWords: {
      none: resolveInterpreterString('form.noUnsavedChanges', lang, languages),
      discard: resolveInterpreterString('form.discard', lang, languages),
    },
  }),
})
