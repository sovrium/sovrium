/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The component-type rules the schema cannot hold, gathered behind ONE entry
 * so the decode boundary (`decodeAppConfigObject` → `runSemanticChecks`) calls
 * one function for all of them: what a restricted container may hold, what a
 * `label` may name, what an image `attachment` must carry, what a
 * `questionnaire` submits through, which field a choice control's
 * `optionsFrom` may name, which form a grid's answer columns come from, and that a grid starts with a
 * column drawn.
 * Each rule keeps its own module and its own test;
 * this file only orders them. Pure: no I/O.
 */

import { validateComponentChildren } from './component-children-validation'
import { validateAttachmentMedia } from './content/attachment-validation'
import { validateQuestionnaires } from './data/questionnaire-validation'
import { validateColumnVisibility } from './data/table/column-visibility-validation'
import { validateFormColumnSources } from './data/table/columns-from-form-validation'
import { validateDayCalendarDefaults } from './form-controls/day-calendar-validation'
import { validateLabelTargets } from './form-controls/label-for-validation'
import { validateSelectOptionsFrom } from './form-controls/select-options-from-validation'
import { validateIconButtons } from './interactive/button-size-validation'

/**
 * Every component-type rule the config breaks, as finished messages.
 *
 * @param config - The parsed config object, before or after decoding.
 */
export const validateComponentSemantics = (config: unknown): readonly string[] => [
  ...validateComponentChildren(config),
  ...validateLabelTargets(config),
  ...validateAttachmentMedia(config),
  ...validateQuestionnaires(config),
  ...validateFormColumnSources(config),
  ...validateColumnVisibility(config),
  ...validateDayCalendarDefaults(config),
  ...validateIconButtons(config),
  ...validateSelectOptionsFrom(config),
]
