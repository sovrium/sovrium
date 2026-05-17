/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Wizard step schema (used by wizard component)
// ---------------------------------------------------------------------------

/**
 * A single step in a wizard / stepped container
 *
 * @example
 * ```yaml
 * steps:
 *   - id: account
 *     label: Account Details
 *     icon: user
 *     description: Set up your account information
 *   - id: preferences
 *     label: Preferences
 *     icon: settings
 *   - id: review
 *     label: Review & Submit
 *     icon: check-circle
 * ```
 */
export const WizardStepSchema = Schema.Struct({
  /** Unique step identifier */
  id: Schema.String.annotations({
    description: 'Unique identifier for the step (used for navigation and initialStep)',
  }),
  /** Step label displayed in the progress indicator */
  label: Schema.String.annotations({
    description: 'Display text for the step in the progress indicator',
  }),
  /** Lucide icon name */
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name displayed in the step indicator',
    })
  ),
  /** Step description shown below the label */
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Short description displayed below the step label',
    })
  ),
}).annotations({
  title: 'Wizard Step',
  description: 'A single step definition in a wizard / stepped container',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

/** @public */
export type WizardStep = Schema.Schema.Type<typeof WizardStepSchema>
