/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `input` — the single-line text control, in every shape its `inputType` names.
 *
 * Beside `input-group` and `input-otp` in its own module rather than inline in
 * the interactive dispatch table.
 *
 * Source: src/domain/models/app/pages/components/form-controls.ts → InputTypeSchema
 * Specs: [internal ref]
 */

import {
  computeInputDefaultClasses,
  computeTextareaDefaultClasses,
  type InputState,
} from '@/presentation/design/input-default-classes'
import * as Renderers from '../elements'
import { renderInputOtp } from '../elements/input-otp-renderer'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'

/**
 * Derive an input's visual state from native HTML attributes carried in
 * `elementProps`. The input schema does not currently expose a `state` field
 * (the prestyled-islands rule keeps the schema vocabulary frozen — see plan-piped-locket), so the
 * state is read from props the schema already permits:
 *
 *   - `props.disabled === true`        → `'disabled'`
 *   - `props.readOnly === true` (or `props.readonly`) → `'readonly'`
 *   - `props['aria-invalid'] === true` or `=== 'true'`  → `'error'`
 *
 * Precedence: `disabled` > `error` > `readonly` > `default` — disabled is the
 * most restrictive, so it wins over a concurrently-flagged invalid state.
 */
function deriveInputState(elementProps: Record<string, unknown>): InputState {
  if (elementProps['disabled'] === true) return 'disabled'
  const ariaInvalid = elementProps['aria-invalid']
  if (ariaInvalid === true || ariaInvalid === 'true') return 'error'
  if (elementProps['readOnly'] === true || elementProps['readonly'] === true) return 'readonly'
  return 'default'
}

/**
 * Build the merged className for an input (the prestyled-islands rule, prestyled-by-default).
 *
 * Defaults come from {@link computeInputDefaultClasses}, shadcn/ui's `Input`
 * recipe, so a schema author who writes the bare
 * `{ type: 'input', placeholder: 'Email' }` gets shadcn's text input.
 * Author-supplied `props.className` is merged through {@link mergePrestyle},
 * so it beats the recipe on any same-property conflict.
 */
function buildInputClassName(
  elementProps: Record<string, unknown>,
  authorClassName: string | undefined,
  replaceDefaults = false
): string {
  const state = deriveInputState(elementProps)
  const defaults = computeInputDefaultClasses({ state })
  return mergePrestyle(defaults, authorClassName, replaceDefaults)
}

export const inputComponent: ComponentRenderer = ({ elementProps, designStyles, rawProps }) => {
  const mergedClassName = buildInputClassName(
    elementProps,
    elementProps.className as string | undefined,
    designStyles?.replace
  )
  // A standalone input's authored `label` names it when nothing else does —
  // without it the control is announced as an anonymous "edit text".
  const authoredLabel = rawProps?.['label']
  const props = {
    ...elementProps,
    className: mergedClassName,
    ...(typeof authoredLabel === 'string' &&
      elementProps['aria-label'] === undefined &&
      elementProps['aria-labelledby'] === undefined && { 'aria-label': authoredLabel }),
  }
  // shadcn/ui's anatomy names the control by its slot.
  return Renderers.renderInput({ ...props, 'data-slot': 'input' })
}

/**
 * The `input-otp` component: a mailed verification code typed back one box
 * per character (`renderInputOtp`, mounted by the `input-otp` island).
 */
export const inputOtpComponent: ComponentRenderer = ({ elementProps, rawProps }) =>
  renderInputOtp({
    props: elementProps,
    ...(typeof rawProps?.['label'] === 'string' && { label: rawProps['label'] }),
  })

/**
 * The `textarea` component: shadcn/ui's `Textarea` recipe under the author's
 * className, which wins a same-property conflict; `replace: true` drops it.
 *
 * `rows`, `maxLength` and `autoResize` are top-level schema fields (siblings of
 * `props`). `props.label`, when present, becomes the `aria-label`, so the
 * control is found by `getByRole('textbox', { name })`.
 */
export const textareaComponent: ComponentRenderer = ({
  elementProps,
  component,
  rawProps,
  designStyles,
}) => {
  const c = (component ?? {}) as Record<string, unknown>
  const className = mergePrestyle(
    computeTextareaDefaultClasses(),
    elementProps.className as string | undefined,
    designStyles?.replace
  )
  return Renderers.renderTextarea({
    props: { ...elementProps, className, 'data-slot': 'textarea' },
    rows: c['rows'] as number | undefined,
    maxLength: c['maxLength'] as number | undefined,
    label: rawProps?.['label'] as string | undefined,
    autoResize: c['autoResize'] as boolean | undefined,
    placeholder: rawProps?.['placeholder'] as string | undefined,
    name: rawProps?.['name'] as string | undefined,
  })
}

/** The input family's renderers, keyed by type, for the interactive registry. */
export const inputComponents = {
  input: inputComponent,
  'input-otp': inputOtpComponent,
  textarea: textareaComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
