/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `input` — the single-line text control, in every shape its `inputType` names.
 *
 * Beside `input-group` in its own module rather than inline in the interactive
 * dispatch table, because the type stopped being a one-liner: `one-time-code`
 * is an `inputType` that does NOT name a native HTML input type, so the
 * renderer now has a decision to make rather than a prop to forward.
 *
 * Source: src/domain/models/app/pages/components/form-controls.ts → InputTypeSchema
 * Specs: [internal ref]
 */

import {
  computeInputDefaultClasses,
  type InputState,
} from '@/presentation/design/input-default-classes'
import * as Renderers from '../elements'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'

/**
 * Derive an input's visual state from native HTML attributes carried in
 * `elementProps`. The input schema does not currently expose a `state` field
 * ([internal ref] keeps the schema vocabulary frozen — see plan-piped-locket), so the
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
 * Build the merged className for an input ([internal ref], prestyled-by-default).
 *
 * Defaults come from {@link computeInputDefaultClasses} — a Tailwind recipe
 * with inline OKLCH var-fallbacks so a schema author who writes the bare
 * `{ type: 'input', placeholder: 'Email' }` gets a complete, opinionated text
 * input with rounded border, surface fill, focus ring, and state styling.
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

export const inputComponent: ComponentRenderer = ({
  elementProps,
  designStyles,
  component,
  rawProps,
}) => {
  const mergedClassName = buildInputClassName(
    elementProps,
    elementProps.className as string | undefined,
    designStyles?.replace
  )
  const props = { ...elementProps, className: mergedClassName }
  // `one-time-code` is the one `inputType` that is NOT an HTML input type: it
  // names an autofill contract (`autocomplete` plus a numeric `inputmode`)
  // rather than a native control, so it is TRANSLATED here instead of being
  // forwarded as `type`. Forwarding it would leave the browser falling back to
  // `text` while dropping the numeric keypad the type exists to obtain.
  if ((component as { inputType?: string } | undefined)?.inputType === 'one-time-code') {
    return Renderers.renderOneTimeCodeInput({
      props,
      ...(typeof rawProps?.['label'] === 'string' && { label: rawProps['label'] }),
    })
  }
  return Renderers.renderInput(props)
}
