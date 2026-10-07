/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The step rail — "you are here, in a sequence of named positions".
 *
 * `progress` with `progressVariant: 'steps'` declares it over a sequence — an
 * onboarding, a checkout, anything paged. It emits `data-wizard-progress` /
 * `data-wizard-step-label`, and `aria-current="step"` marks exactly one
 * position.
 *
 * `current` is a ZERO-BASED index. The
 * `progress` component's `progressValue` is a 1-based POSITION, which is what a
 * config author counts in, so the translation happens at that call site rather
 * than here.
 */

import type { ReactElement } from 'react'

/** One position in the sequence. Only its name is drawn. */
export interface StepRailStep {
  readonly label: string
}

/**
 * An ordered list of named positions, with the current one marked.
 *
 * A list rather than a row of divs: a row looks identical and tells a screen
 * reader neither how many positions there are nor which one this is.
 */
export function StepRail({
  steps,
  current,
}: {
  readonly steps: readonly StepRailStep[]
  readonly current: number
}): ReactElement {
  return (
    <ol data-wizard-progress>
      {steps.map((step, index) => (
        <li
          key={step.label}
          {...(index === current && { 'aria-current': 'step' })}
          data-wizard-step-label
        >
          {step.label}
        </li>
      ))}
    </ol>
  )
}
