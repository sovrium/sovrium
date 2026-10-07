/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `stepper` SSR renderer — one task split into ordered steps.
 *
 * Every step body is rendered server-side, in the document, as the index-aligned
 * entry of `children` (the `tabs` alignment). Only the first is shown; the
 * others carry `hidden`. Rendering them all, rather than serialising markup
 * into island props the way the tab island does, keeps the bodies ordinary
 * server-rendered components: a form, a picker or an island inside a later
 * step is mounted once, by the page, and keeps what the reader typed when the
 * step is left and re-entered.
 *
 * The movement between steps is progressive enhancement: an EMPTY sibling
 * `data-island="stepper"` marker (it renders nothing, in the `split-pane`
 * mould) wires Back / Skip / Continue, the `?step=` address and the
 * validation gate onto THIS markup.
 *
 * The last step's button is an ordinary `button` rendered with `onFinish` as
 * its action, so a finish runs exactly what the same action does on any button
 * — the island only holds it back while the step is invalid.
 */

import { cn } from '@/presentation/design/class-merge'
import {
  STEPPER_LABEL,
  STEPPER_MARKER,
  STEPPER_RAIL_ITEM,
} from '@/presentation/design/stepper-default-classes'
import { renderButton } from '@/presentation/render/elements/button-renderer'
import { omitInternalMarkers } from '@/presentation/render/props/internal-marker-props'
import { localizeChildLabel } from './island-child-label'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

/** One authored step, read loosely off the component root. */
interface StepperStep {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly optional?: boolean
}

/** The stepper's own root keys, narrowed off the ~60-branch component union. */
interface StepperRoot {
  readonly steps?: readonly StepperStep[]
  readonly orientation?: 'horizontal' | 'vertical'
  readonly linear?: boolean
  readonly finishLabel?: string
  readonly onFinish?: { readonly type?: string; readonly path?: string }
}

/** Past this many steps the rail compacts to "Step n of m" at every width. */
const COMPACT_ABOVE = 5

const HIDDEN_STYLE = { display: 'none' } as const

const BUTTON_SECONDARY =
  'inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted'
const BUTTON_PRIMARY =
  'inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90'

/** The button that runs `onFinish`, drawn by the button renderer itself. */
function finishButton(root: StepperRoot, label: string): ReactElement {
  const action = root.onFinish
  const interactions =
    action?.type === 'navigate' && typeof action.path === 'string'
      ? { click: { navigate: action.path } }
      : undefined
  return renderButton({
    props: { type: 'button', className: BUTTON_PRIMARY, 'data-stepper-finish': '', hidden: true },
    content: label,
    children: [],
    interactions,
    action: action?.type === 'navigate' ? undefined : (action as Component['action']),
  })
}

/** One position of the rail: its number, its name and its one-line ask. */
function railItem(
  step: StepperStep,
  index: number,
  ctx: { readonly linear: boolean; readonly part?: string }
): ReactElement {
  const number = (
    <span
      aria-hidden="true"
      data-stepper-number=""
      className={STEPPER_MARKER}
    >
      {index + 1}
    </span>
  )
  const words = (
    <span className="flex flex-col">
      <span className={STEPPER_LABEL}>{step.label}</span>
      {step.description !== undefined && (
        <span className="text-muted-foreground text-xs">{step.description}</span>
      )}
    </span>
  )
  return (
    <li
      key={step.id}
      data-stepper-step={step.id}
      data-state={index === 0 ? 'current' : 'todo'}
      {...(index === 0 && { 'aria-current': 'step' })}
      className={cn(STEPPER_RAIL_ITEM, ctx.part)}
    >
      {ctx.linear ? (
        <>
          {number}
          {words}
        </>
      ) : (
        <button
          type="button"
          data-stepper-goto={step.id}
          className="flex items-start gap-2 text-left"
        >
          {number}
          {words}
        </button>
      )}
    </li>
  )
}

/** Localize one step's label and description to the page language. */
function localizeStep(
  step: StepperStep,
  lang: string | undefined,
  languages: Parameters<typeof localizeChildLabel>[2]
): StepperStep {
  return {
    ...step,
    label: localizeChildLabel(step.label, lang, languages),
    ...(step.description !== undefined && {
      description: localizeChildLabel(step.description, lang, languages),
    }),
  }
}

/** "Step n of m" over a bar: the rail past five steps, and on a phone. */
function compactProgress({
  total,
  compactOnly,
}: {
  readonly total: number
  readonly compactOnly: boolean
}): ReactElement {
  return (
    <div
      data-stepper-compact=""
      className={cn('flex flex-col gap-2', !compactOnly && 'sm:hidden')}
    >
      <p
        data-stepper-count=""
        className="text-muted-foreground font-mono text-xs"
      >
        {`Step 1 of ${total}`}
      </p>
      <div
        aria-hidden="true"
        className="bg-muted h-1 w-full overflow-hidden rounded-full"
      >
        <div
          data-stepper-bar=""
          className="bg-foreground h-full"
          style={{ width: `${Math.round(100 / Math.max(total, 1))}%` }}
        />
      </div>
    </div>
  )
}

/** One step body under its focusable heading; every one but the first starts hidden. */
function stepPanel(
  step: StepperStep,
  index: number,
  body: ReactElement | undefined,
  part: string | undefined
): ReactElement {
  return (
    <section
      key={step.id}
      data-stepper-panel={step.id}
      data-optional={step.optional === true ? 'true' : 'false'}
      hidden={index !== 0}
      className={cn('flex flex-col gap-4', part)}
    >
      <h2
        tabIndex={-1}
        data-stepper-heading=""
        className="text-lg font-semibold outline-none"
      >
        {step.label}
      </h2>
      {body}
    </section>
  )
}

/** Back, Skip, Continue and the finish button, fitted to the first step. */
function stepperFooter({
  root,
  steps,
  finishLabel,
  part,
}: {
  readonly root: StepperRoot
  readonly steps: readonly StepperStep[]
  readonly finishLabel: string
  readonly part?: string
}): ReactElement {
  return (
    <div
      data-stepper-footer=""
      className={cn('flex items-center gap-2', part)}
    >
      <button
        type="button"
        data-stepper-back=""
        hidden
        className={BUTTON_SECONDARY}
      >
        Back
      </button>
      <span className="flex-1" />
      <button
        type="button"
        data-stepper-skip=""
        hidden={steps[0]?.optional !== true}
        className={BUTTON_SECONDARY}
      >
        Skip
      </button>
      <button
        type="button"
        data-stepper-next=""
        className={BUTTON_PRIMARY}
      >
        Continue
      </button>
      {finishButton(root, finishLabel)}
    </div>
  )
}

/** The ordered rail of steps, hidden on a phone and past five steps. */
function stepRail(ctx: {
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
      data-stepper-rail=""
      className={cn(
        compactOnly ? 'hidden' : 'hidden gap-4 sm:flex',
        vertical ? 'sm:flex-col md:w-56 md:shrink-0' : 'sm:flex-row sm:flex-wrap',
        parts['rail']
      )}
    >
      {steps.map((step, index) => railItem(step, index, { linear, part: parts['step'] }))}
    </ol>
  )
}

/** The host id the enhancement island finds this stepper by. */
function stepperHostId(authored: unknown, steps: readonly StepperStep[]): string {
  return typeof authored === 'string' && authored.length > 0
    ? authored
    : `sv-stepper-${steps.map((step) => step.id).join('-')}`
}

export const stepperComponent: ComponentRenderer = ({
  component,
  elementProps,
  renderedChildren,
  currentLang,
  languages,
  designStyles,
}) => {
  const root = (component ?? {}) as StepperRoot
  const steps = (root.steps ?? []).map((step) => localizeStep(step, currentLang, languages))
  const linear = root.linear !== false
  const vertical = root.orientation === 'vertical'
  const compactOnly = steps.length > COMPACT_ABOVE
  const parts = designStyles?.parts ?? {}
  const { 'aria-label': ariaLabel, ...hostProps } = omitInternalMarkers(elementProps)
  const hostId = stepperHostId(hostProps['id'], steps)

  return (
    <div
      {...hostProps}
      id={hostId}
      data-stepper={hostId}
      data-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cn(
        'flex flex-col gap-6',
        vertical && 'md:flex-row',
        hostProps['className'] as string | undefined
      )}
    >
      {stepRail({ steps, ariaLabel, linear, vertical, compactOnly, parts })}
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {compactProgress({ total: steps.length, compactOnly })}
        {steps.map((step, index) =>
          stepPanel(step, index, renderedChildren[index], parts['panel'])
        )}
        {stepperFooter({
          root,
          steps,
          finishLabel: localizeChildLabel(root.finishLabel ?? 'Finish', currentLang, languages),
          part: parts['footer'],
        })}
      </div>
      <div
        data-island="stepper"
        data-island-props={JSON.stringify({ hostId, linear })}
        style={HIDDEN_STYLE}
      />
    </div>
  )
}
