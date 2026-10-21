/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateAllDesignConsoleComponents } from './design/design-console-component-validation'
import { validateAllComponentReferences } from './pages/component-reference-validation'
import { validateAllComponentSlots } from './pages/component-slot-validation'
import { validateAllFormSections } from './pages/components/component-types/data/form/sections-validation'
import { validateDisabledControls } from './pages/disabled-control-validation'
import { validateAllFillTargets } from './pages/fill-target-validation'
import { validateAllPageNodeKeys } from './pages/node-key-validation'
import { validateAllSeekTargets } from './pages/seek-target-validation'
import { validateAllTemplateInputs } from './pages/template-input-validation'

/**
 * The page-component checks of the AppSchema final filter, as one branch: the
 * design console's plotted tokens, every bare `$ref` placement against
 * `app.components`, every `fill` target against its page's component ids,
 * every `seek` target against its page's video and audio players, every
 * `disabledWhen` / `disabledReason` pair against what it can explain,
 * every template slot against the placements that fill it, every template
 * input against what each page placement passes, every page
 * form's `sections` against the fields that form draws, then every node `key`
 * against the other nodes of its page. One helper because
 * that filter is at its complexity budget, and
 * each extra branch there fails the lint gate.
 */
export const validateComponentPlacements = (
  app: Parameters<typeof validateAllDesignConsoleComponents>[0] &
    Parameters<typeof validateAllComponentReferences>[0] &
    Parameters<typeof validateAllComponentSlots>[0] &
    Parameters<typeof validateAllFormSections>[0] &
    Parameters<typeof validateDisabledControls>[0] &
    Parameters<typeof validateAllPageNodeKeys>[0]
): true | string => {
  const designConsoleError = validateAllDesignConsoleComponents(app)
  if (designConsoleError !== true) return designConsoleError
  const referenceError = validateAllComponentReferences(app)
  if (referenceError !== true) return referenceError
  const fillError = validateAllFillTargets(app)
  if (fillError !== true) return fillError
  const seekError = validateAllSeekTargets(app)
  if (seekError !== true) return seekError
  const disabledError = validateDisabledControls(app)
  if (disabledError !== true) return disabledError
  const slotError = validateAllComponentSlots(app)
  if (slotError !== true) return slotError
  const inputError = validateAllTemplateInputs(app)
  if (inputError !== true) return inputError
  const formSectionError = validateAllFormSections(app)
  if (formSectionError !== true) return formSectionError
  return validateAllPageNodeKeys(app)
}
