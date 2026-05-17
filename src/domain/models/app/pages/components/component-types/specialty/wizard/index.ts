/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { actionFields } from '../../modules/action'
import { coreFields } from '../../modules/core'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { WizardStepSchema } from './schema'

export const WizardTypeLiteral = Schema.Literal('wizard')

export const wizardFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  steps: Schema.optional(
    Schema.Array(WizardStepSchema).pipe(
      Schema.minItems(2),
      Schema.annotations({
        description: 'Step definitions for the wizard (minimum 2 steps)',
      })
    )
  ),
  initialStep: Schema.optional(
    Schema.String.annotations({
      description: 'ID of the step to show initially',
    })
  ),
  showProgress: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Show step progress indicator (default: true)',
    })
  ),
  allowSkip: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Allow users to skip ahead to non-sequential steps',
    })
  ),
} as const
