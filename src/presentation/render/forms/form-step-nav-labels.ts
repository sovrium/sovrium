/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/** The words of a multi-step form's navigation, in the page language. */
export interface StepNavLabels {
  readonly previous: string
  readonly next: string
  /** `Step {current} of {total}`, filled here for step 1 and by the runtime after. */
  readonly stepOf: string
  /** The progress line's accessible name. */
  readonly stepProgress: string
}

/** The step navigation's words for `lang`, renamed by the app's own translations. */
export const resolveStepNavLabels = (
  lang: string | undefined,
  languages: Languages | undefined
): StepNavLabels => ({
  previous: resolveInterpreterString('form.previous', lang, languages),
  next: resolveInterpreterString('form.next', lang, languages),
  stepOf: resolveInterpreterString('form.stepOf', lang, languages),
  stepProgress: resolveInterpreterString('form.stepProgress', lang, languages),
})
