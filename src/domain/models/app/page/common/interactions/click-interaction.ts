/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Click animation types
 *
 * Animations triggered when component is clicked:
 * - pulse: Subtle scale pulse
 * - bounce: Playful bounce effect
 * - shake: Shake horizontally
 * - flash: Quick opacity flash
 * - ripple: Material Design ripple from click point
 * - none: No animation
 */
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

/**
 * Element ID selector pattern (#elementId)
 *
 * Must start with # followed by a letter, then alphanumeric characters and hyphens.
 *
 * @example
 * ```typescript
 * const selectors = ['#hero-section', '#pricing', '#contactForm']
 * ```
 */
export const ElementIdSelectorSchema = Schema.String.pipe(
  Schema.pattern(/^#[a-zA-Z][a-zA-Z0-9-]*$/, {
    message: () =>
      'Element ID selector must start with # followed by a letter, then alphanumeric characters and hyphens',
  })
)

/**
 * Actions triggered when component is clicked
 *
 * Supports multiple action types (all optional):
 * - animation: Visual feedback animation
 * - navigate: Client-side navigation to internal path or anchor
 * - openUrl: Open external URL
 * - openInNewTab: Open link in new tab (used with openUrl)
 * - scrollTo: Smooth scroll to element by ID
 * - toggleElement: Show/hide element by ID
 * - submitForm: Submit form by ID
 *
 * Multiple actions can be combined (e.g., play animation then navigate).
 *
 * @example
 * ```typescript
 * const clickInteraction = {
 *   animation: 'pulse',
 *   navigate: '/contact'
 * }
 *
 * const externalLink = {
 *   animation: 'ripple',
 *   openUrl: 'https://example.com',
 *   openInNewTab: true
 * }
 *
 * const scrollToSection = {
 *   animation: 'ripple',
 *   scrollTo: '#pricing-section'
 * }
 * ```
 *
 * @see specs/app/pages/common/interactions/click-interaction.schema.json
 */
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
}).annotations({
  title: 'Click Interaction',
  description: 'Actions triggered when component is clicked',
})

export type ClickAnimation = Schema.Schema.Type<typeof ClickAnimationSchema>
export type ElementIdSelector = Schema.Schema.Type<typeof ElementIdSelectorSchema>
export type ClickInteraction = Schema.Schema.Type<typeof ClickInteractionSchema>
