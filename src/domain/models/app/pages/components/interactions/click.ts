/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ClickAnimationSchema = Schema.Literal(
  'pulse',
  'bounce',
  'shake',
  'flash',
  'ripple',
  'none'
).annotations({
  description: 'Animation to trigger on click',
})

export const ElementIdSelectorSchema = Schema.String.pipe(
  Schema.pattern(/^#[a-zA-Z][a-zA-Z0-9-]*$/, {
    message: () =>
      'Element ID selector must start with # followed by a letter, then alphanumeric characters and hyphens',
  })
)

export const ClickInteractionSchema = Schema.Struct({
  animation: Schema.optional(ClickAnimationSchema),
  navigate: Schema.optional(
    Schema.String.annotations({
      description: 'Path to navigate to',
      examples: ['/contact', '/pricing', '#section-id'],
    })
  ),
  openUrl: Schema.optional(
    Schema.String.annotations({
      description: 'External URL to open',
    })
  ),
  openInNewTab: Schema.optional(Schema.Boolean),
  scrollTo: Schema.optional(ElementIdSelectorSchema),
  toggleElement: Schema.optional(
    ElementIdSelectorSchema.annotations({
      description: 'Element ID to show/hide',
    })
  ),
  submitForm: Schema.optional(
    ElementIdSelectorSchema.annotations({
      description: 'Form ID to submit',
    })
  ),
  modal: Schema.optional(
    Schema.String.annotations({
      description: 'Modal section ID to open when clicked',
    })
  ),
}).annotations({
  title: 'Click Interaction',
  description: 'Actions triggered when component is clicked',
})

export type ClickAnimation = Schema.Schema.Type<typeof ClickAnimationSchema>
export type ElementIdSelector = Schema.Schema.Type<typeof ElementIdSelectorSchema>
export type ClickInteraction = Schema.Schema.Type<typeof ClickInteractionSchema>
