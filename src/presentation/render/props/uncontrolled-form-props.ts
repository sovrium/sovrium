/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { omitInternalMarkers } from './internal-marker-props'
import type { ElementProps } from '../elements/html-element-renderer'

/**
 * The `type` values for which React does NOT treat a `value` prop as a
 * controlled-component declaration — `hasReadOnlyValue` in
 * `react-dom-server`. On these, `value` is a LABEL (`submit`, `reset`,
 * `button`) or a constant the form submits (`hidden`, `checkbox`, `radio`,
 * `image`); it is not the field's editable content, so renaming it to
 * `defaultValue` would be semantically wrong even though the emitted HTML
 * matches. React exempts them for exactly that reason, and so do we.
 */
const HAS_READ_ONLY_VALUE: ReadonlySet<string> = new Set([
  'button',
  'checkbox',
  'hidden',
  'image',
  'radio',
  'reset',
  'submit',
])

/**
 * Restate an author's `value` / `checked` as `defaultValue` / `defaultChecked`
 * before they reach a native `<input>`, `<select>` or `<textarea>`.
 *
 * WHY THIS EXISTS. `value` and `checked` are in `RESERVED_PROPS`
 * (`prop-conversion.ts`), so a config author writing
 * `{ type: 'input', props: { value: 'Analyst' } }` — a perfectly reasonable
 * thing to write — has that `value` spread onto the DOM element as a real
 * React `value` prop. React reads that as "this is a CONTROLLED component",
 * finds no `onChange`, and prints "You provided a `value` prop to a form field
 * without an `onChange` handler" on every server render. The warning is false:
 * the SSR tree ships no handlers by design, nothing hydrates over these
 * controls, and the emitted HTML is already correct.
 *
 * WHY AT THE DOM BOUNDARY rather than per renderer or upstream in
 * `prop-conversion.ts`. Per-type patches close one type and leave the rest
 * open — the same argument `renderHTMLElement` already makes for the marker
 * strip it owns. Upstream is worse: `value` is legitimate and NOT a
 * controlled-component declaration on `<option>`, `<li>`, `<progress>` and
 * `<meter>`, so a blanket rewrite in the props builder would corrupt those.
 * The native form controls are the only elements React applies
 * `checkControlledValueProps` to, so they are the right boundary.
 *
 * HTML-IDENTICAL, measured rather than assumed. React serialises
 * `defaultValue` and `value` to the same `value="…"` attribute, and
 * `defaultChecked` and `checked` to the same `checked=""`; both were verified
 * against `renderToStaticMarkup` for string, numeric and `type`-exempt cases.
 *
 * THE PRECEDENCE RULE IS REACT'S, NOT OURS. When an author supplies BOTH
 * `value` and `defaultValue`, React warns twice and emits the CONTROLLED one.
 * So the controlled value is what survives here — it overwrites any existing
 * `defaultValue` — because keeping the uncontrolled one instead would silence
 * the warning while silently changing the rendered attribute. Same for
 * `checked` over `defaultChecked`.
 *
 * Left untouched, in both cases because React is already silent and the
 * smallest diff wins:
 *   - anything carrying `onChange` / `onInput` — a genuinely controlled
 *     element must not be rewritten (`field-specimen-renderer.ts` passes a
 *     deliberate no-op handler for precisely this reason);
 *   - anything `readOnly` or `disabled` — a read-only control with a `value`
 *     is a legitimate display-only field.
 */
export function toUncontrolledFormProps(props: ElementProps): ElementProps {
  // The internal data-source markers are stripped here for the same reason the
  // value/checked fold happens here: this is the DOM boundary every native form
  // control passes through, and a control inside a data-bound container carries
  // the markers exactly as its container does. Folding both concerns into one
  // pass keeps callers from having to remember two helpers in the right order.
  // See `internal-marker-props.ts`.
  const domProps = omitInternalMarkers(props)
  if (isSupplied(domProps['onChange']) || isSupplied(domProps['onInput'])) return domProps
  if (domProps['readOnly'] === true || domProps['disabled'] === true) return domProps
  return foldValue(foldChecked(domProps))
}

/**
 * React's own `null != x` guard, spelled without the `null` literal the lint
 * config bans. Deliberately NOT a truthiness test: `0` and `''` are values a
 * field legitimately carries, and React warns on both.
 */
function isSupplied(candidate: unknown): boolean {
  return (candidate ?? undefined) !== undefined
}

function foldChecked(props: ElementProps): ElementProps {
  const controlledChecked = props['checked']
  if (!isSupplied(controlledChecked)) return props
  const { checked: _controlled, defaultChecked: _overwritten, ...rest } = props
  return { ...rest, defaultChecked: controlledChecked }
}

function foldValue(props: ElementProps): ElementProps {
  const controlledValue = props['value']
  if (!isSupplied(controlledValue)) return props
  const elementType = props['type']
  if (typeof elementType === 'string' && HAS_READ_ONLY_VALUE.has(elementType)) return props
  const { value: _controlled, defaultValue: _overwritten, ...rest } = props
  return { ...rest, defaultValue: controlledValue }
}

/**
 * The `<textarea>` variant: {@link toUncontrolledFormProps} plus the sibling
 * warning that only a textarea can produce.
 *
 * A textarea's content is a PROP, not children. `children` is in
 * `RESERVED_PROPS` and `ComponentPropsSchema` accepts a string for any
 * camelCase key, so `{ type: 'textarea', props: { children: 'Notes' } }`
 * reaches the element as JSX children and React answers "Use the
 * `defaultValue` or `value` props instead of setting children on
 * `<textarea>`". Folding a string or numeric child into `defaultValue` emits
 * the identical `<textarea>Notes</textarea>` and silences it.
 *
 * This is deliberately NOT part of the generic helper. On a `<select>`,
 * children are the `<option>` elements and folding them would destroy the
 * control; on a void `<input>` they are a different error entirely. Only a
 * textarea has content that is expressible either way, so only a textarea
 * gets this.
 *
 * A non-string child is left alone — it has no faithful `defaultValue`
 * spelling. So is a child arriving ALONGSIDE a value: React throws
 * "If you supply `defaultValue` on a <textarea>, do not pass children" on
 * that combination today, and turning an existing throw into a render would
 * be a behaviour change rather than a silenced warning.
 */
export function toUncontrolledTextareaProps(props: ElementProps): ElementProps {
  const folded = toUncontrolledFormProps(props)
  const childContent = folded['children']
  if (typeof childContent !== 'string' && typeof childContent !== 'number') return folded
  if (isSupplied(folded['value']) || isSupplied(folded['defaultValue'])) return folded
  const { children: _moved, ...rest } = folded
  return { ...rest, defaultValue: childContent }
}
