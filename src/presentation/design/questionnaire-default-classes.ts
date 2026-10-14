/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `questionnaire` screen, in shadcn's utilities: a column holding the
 * count, the question as the legend of its fieldset, the choices as bordered
 * rows that light up when chosen, and a row of actions. The action
 * buttons take shadcn's own Button variants (`default`, `outline`, `ghost`). shadcn/ui's Questionnaire ships its behaviour
 * as an unstyled primitive and leaves the drawing to the author.
 */
const BUTTON =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'

const BUTTON_VARIANTS = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/80',
  outline: 'border border-border bg-background hover:bg-muted',
  ghost: 'hover:bg-muted',
} as const

/** One action button, in one of shadcn's Button variants. */
export const computeQuestionnaireButtonClasses = (variant: keyof typeof BUTTON_VARIANTS): string =>
  `${BUTTON} ${BUTTON_VARIANTS[variant]}`

/** The screen. */
export const computeQuestionnaireClasses = (): string => 'flex w-full max-w-lg flex-col gap-4'

/** The question, as the legend of its fieldset. */
export const computeQuestionnairePromptClasses = (): string => 'text-base font-medium'

/** One choice: a bordered row, lit when its control is checked. */
export const computeQuestionnaireChoiceClasses = (): string =>
  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-primary/5'

/** The typed answer's box. */
export const computeQuestionnaireInputClasses = (): string =>
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/** The actions row. */
export const computeQuestionnaireActionsClasses = (): string =>
  'flex items-center justify-end gap-2'
