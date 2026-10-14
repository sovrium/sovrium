/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `stepper` rail — the ordered list of steps above (or beside) the step
 * bodies, on shadcn/ui's part names: `stepper-list` > `stepper-item` >
 * `stepper-indicator` + `stepper-title` / `stepper-description`, with a
 * `stepper-separator` after every step but the last.
 *
 * Every step is rendered with the first one current; the enhancement island
 * moves `data-state` and `aria-current` from there, and every state colour is
 * read from that `data-state` (`stepper-anatomy-classes.ts`).
 */

import { Check } from 'lucide-react'
import { cn } from '@/presentation/design/class-merge'
import {
  computeStepperItemClasses,
  computeStepperSeparatorClasses,
  STEPPER_CHECK_CLASSES,
  STEPPER_DESCRIPTION_CLASSES,
  STEPPER_DIGIT_CLASSES,
  STEPPER_INDICATOR_CLASSES,
  STEPPER_TITLE_CLASSES,
} from '@/presentation/design/stepper-anatomy-classes'
import type { ReactElement } from 'react'

/** One authored step, read loosely off the component root. */
export interface StepperStep {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly optional?: boolean
}

/** The step's disc: a check (shown once done) and its number (shown until then). */
function stepIndicator(index: number): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-slot="stepper-indicator"
      data-stepper-number=""
      className={STEPPER_INDICATOR_CLASSES}
    >
      <Check className={STEPPER_CHECK_CLASSES} />
      <span
        data-stepper-digit=""
        className={STEPPER_DIGIT_CLASSES}
      >
        {index + 1}
      </span>
    </span>
  )
}

/** The step's name and its one-line ask. */
function stepWords(step: StepperStep): ReactElement {
  return (
    <span className="flex flex-col">
      <span
        data-slot="stepper-title"
        className={STEPPER_TITLE_CLASSES}
      >
        {step.label}
      </span>
      {step.description !== undefined && (
        <span
          data-slot="stepper-description"
          className={STEPPER_DESCRIPTION_CLASSES}
        >
          {step.description}
        </span>
      )}
    </span>
  )
}

/** One position of the rail: its indicator, its words and the rule after it. */
function railItem(
  step: StepperStep,
  index: number,
  ctx: {
    readonly linear: boolean
    readonly vertical: boolean
    readonly last: boolean
    readonly part?: string
  }
): ReactElement {
  const face = (
    <>
      {stepIndicator(index)}
      {stepWords(step)}
    </>
  )
  return (
    <li
      key={step.id}
      data-slot="stepper-item"
      data-stepper-step={step.id}
      data-state={index === 0 ? 'current' : 'todo'}
      {...(index === 0 && { 'aria-current': 'step' })}
      className={cn(computeStepperItemClasses(ctx.vertical), ctx.part)}
    >
      {ctx.linear ? (
        <span className="flex items-center gap-2">{face}</span>
      ) : (
        <button
          type="button"
          data-stepper-goto={step.id}
          className="focus-visible:ring-ring/50 flex items-center gap-2 rounded-md text-left outline-none focus-visible:ring-3"
        >
          {face}
        </button>
      )}
      {!ctx.last && (
        <div
          aria-hidden="true"
          data-slot="stepper-separator"
          className={computeStepperSeparatorClasses(ctx.vertical)}
        />
      )}
    </li>
  )
}

/** The ordered rail of steps, hidden on a phone and past five steps. */
export function stepRail(ctx: {
  readonly steps: readonly StepperStep[]
  readonly ariaLabel: unknown
  readonly linear: boolean
  readonly vertical: boolean
  readonly compactOnly: boolean
  readonly parts: Readonly<Record<string, string>>
}): ReactElement {
  const { steps, ariaLabel, linear, vertical, compactOnly, parts } = ctx
  return (
    <ol
      aria-label={typeof ariaLabel === 'string' ? ariaLabel : 'Steps'}
      data-slot="stepper-list"
      data-stepper-rail=""
      className={cn(
        compactOnly ? 'hidden' : 'hidden gap-2 sm:flex',
        vertical ? 'sm:flex-col md:w-56 md:shrink-0' : 'sm:flex-row sm:items-center',
        parts['rail']
      )}
    >
      {steps.map((step, index) =>
        railItem(step, index, {
          linear,
          vertical,
          last: index === steps.length - 1,
          part: parts['step'],
        })
      )}
    </ol>
  )
}
