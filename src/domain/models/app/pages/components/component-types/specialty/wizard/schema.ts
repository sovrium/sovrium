/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const WizardStepSchema = Schema.Struct({
  id: Schema.String.annotations({
    description: 'Unique identifier for the step (used for navigation and initialStep)',
  }),
  label: Schema.String.annotations({
    description: 'Display text for the step in the progress indicator',
  }),
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name displayed in the step indicator',
    })
  ),
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Short description displayed below the step label',
    })
  ),
}).annotations({
  title: 'Wizard Step',
  description: 'A single step definition in a wizard / stepped container',
})


export type WizardStep = Schema.Schema.Type<typeof WizardStepSchema>
