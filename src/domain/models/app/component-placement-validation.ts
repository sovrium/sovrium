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
import { validateAllFillTargets } from './pages/fill-target-validation'

/**
 * The page-component checks of the AppSchema final filter, as one branch: the
 * design console's plotted tokens, every bare `$ref` placement against
 * `app.components`, every `fill` target against its page's component ids,
 * every template slot against the placements that fill it, then every page
 * form's `sections` against the fields that form draws. One helper because
 * that filter is at its complexity budget, and
 * each extra branch there fails the lint gate.
 */
export const validateComponentPlacements = (
  app: Parameters<typeof validateAllDesignConsoleComponents>[0] &
    Parameters<typeof validateAllComponentReferences>[0] &
    Parameters<typeof validateAllComponentSlots>[0] &
    Parameters<typeof validateAllFormSections>[0]
): true | string => {
  const designConsoleError = validateAllDesignConsoleComponents(app)
  if (designConsoleError !== true) return designConsoleError
  const referenceError = validateAllComponentReferences(app)
  if (referenceError !== true) return referenceError
  const fillError = validateAllFillTargets(app)
  if (fillError !== true) return fillError
  const slotError = validateAllComponentSlots(app)
  if (slotError !== true) return slotError
  return validateAllFormSections(app)
}
