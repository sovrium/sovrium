/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `stepper` drawn in shadcn/ui's colour roles and part names.
 *
 * shadcn/ui has no stepper, so the parts are Sovrium's own, named the way
 * shadcn names a part (`data-slot="stepper-…"`) and painted only with
 * shadcn's role utilities, so an app's `design` repaints them without a
 * `--sv-*` hook:
 *
 *   div[data-slot=stepper]
 *     ol[data-slot=stepper-list]
 *       li[data-slot=stepper-item][data-state=done|current|todo]
 *         span[data-slot=stepper-indicator]  (a check when done, else the number)
 *         span[data-slot=stepper-title] / span[data-slot=stepper-description]
 *         div[data-slot=stepper-separator]   (every step but the last)
 *     section[data-slot=stepper-content]
 *     div[data-slot=stepper-actions]         (Back / Skip outline, Continue default)
 *
 * Every state is read from the step's own `data-state`, the attribute the
 * enhancement island moves from step to step, so the look follows without a
 * re-render. The buttons are base-nova's `buttonVariants`, read from the
 * shared part-button recipe.
 */

import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'

/** The step: the named group its indicator and separator read their state from. */
export const computeStepperItemClasses = (vertical: boolean): string =>
  vertical
    ? 'group/step flex flex-col items-start gap-2'
    : 'group/step flex items-center gap-2 not-last:flex-1'

/** The step's number disc: filled in the primary colour once reached, plain while ahead. */
export const STEPPER_INDICATOR_CLASSES = [
  'flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-medium text-muted-foreground tabular-nums',
  'group-data-[state=done]/step:border-primary group-data-[state=done]/step:bg-primary group-data-[state=done]/step:text-primary-foreground',
  'group-data-[state=current]/step:border-primary group-data-[state=current]/step:bg-primary group-data-[state=current]/step:text-primary-foreground',
].join(' ')

/** The check a done step shows in place of its number. */
export const STEPPER_CHECK_CLASSES = 'hidden size-3.5 group-data-[state=done]/step:block'

/** The number a step shows until it is done. */
export const STEPPER_DIGIT_CLASSES = 'group-data-[state=done]/step:hidden'

/** The step's name. */
export const STEPPER_TITLE_CLASSES = 'text-sm font-medium'

/** The step's one-line ask. */
export const STEPPER_DESCRIPTION_CLASSES = 'text-xs text-muted-foreground'

/** The rule after a step: the border colour ahead, the primary colour once passed. */
export const computeStepperSeparatorClasses = (vertical: boolean): string =>
  [
    vertical ? 'ml-3 h-4 w-px' : 'h-px min-w-4 flex-1',
    'bg-border group-data-[state=done]/step:bg-primary',
  ].join(' ')

/** The row under the step body that holds Back, Skip and Continue. */
export const STEPPER_ACTIONS_CLASSES = 'flex items-center justify-end gap-2'

/** The two button variants the stepper draws. */
export type StepperButtonVariant = 'default' | 'outline'

/** The className of a stepper button of the given variant, at base-nova's default size. */
export const computeStepperButtonClasses = (variant: StepperButtonVariant): string =>
  computePartButtonClasses({ variant, size: 'default' })

/** The attributes a stepper button carries beside its class: shadcn's part name and variant. */
export const stepperButtonAttributes = (
  variant: StepperButtonVariant
): Readonly<Record<'data-slot' | 'data-variant' | 'data-size', string>> => ({
  'data-slot': 'button',
  'data-variant': variant,
  'data-size': 'default',
})
