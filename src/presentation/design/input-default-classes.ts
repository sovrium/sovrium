/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the `input` component.
 *
 * Schema authors who write the bare `{ type: 'input', placeholder: 'Email' }`
 * now get a complete, opinionated text input — rounded border, surface fill,
 * muted placeholder color, focus ring with offset, error/disabled/readonly
 * visual states — with zero theme-layer dependency.
 *
 * The recipe mirrors the `uiKitInput` fixture in
 * `[internal ref]` (which the fixture used to
 * paint manually onto a `<span>` impersonator). Moving the recipe here makes
 * the default design land in the PRODUCTION renderer — the fixture now emits
 * bare `{ type: 'input' }` schema and the dispatcher composes the className.
 *
 * This module lives in `presentation/utils/design` (NOT `element-renderers`) on
 * purpose — the same reasoning as `form-layout-classes.ts`: `[internal ref]`
 * lets `presentation-component`, `presentation-rendering`, AND `presentation-island`
 * each import `presentation-util`, but an island may NOT import a
 * `presentation-component`. The hand-rolled auth island
 * (`presentation/islands/auth-form-fields.tsx`) needs this recipe to render its
 * native `<input>` consistently with dispatcher-rendered CRUD inputs, so a
 * util-layer home is the one location reachable by all three render contexts with
 * zero boundary friction. The element-renderers `input-default-classes.ts`
 * re-exports these for the existing renderer/registry import sites.
 *
 * Layout / spacing classes (`h-9 px-3 py-2`) stay as raw Tailwind utilities;
 * only color / radius / type-scale / focus-ring classes go through
 * {@link withVarFallback} so `app.design.*` overrides still win at the CSS
 * cascade layer (var lookups resolve `--sv-*` first, fall back to the inline
 * OKLCH literal).
 *
 * The input schema (`form-controls/input.ts`) does not currently expose a
 * `size` or `state` field — `inputType` is the only schema-level discriminator.
 * Visual state is derived by the dispatcher from native HTML attributes carried
 * inside `props` (`disabled`, `readOnly`, `aria-invalid`), matching the way
 * native `<input>` elements expose their interaction state to the browser.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

/**
 * Visual state computed by the dispatcher from `props.disabled`,
 * `props.readOnly`, and `props['aria-invalid']`. Mirrors the fixture's
 * historical state vocabulary.
 */
export type InputState = 'default' | 'error' | 'disabled' | 'readonly'

export interface InputDefaultClassesInput {
  readonly state?: InputState
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-state recipes — flat record keeps the entrypoint's cyclomatic complexity
// at 1 (no branching in `computeInputDefaultClasses`).
// ──────────────────────────────────────────────────────────────────────────────

// A field is RAISED, not ground.
//
// The canvas' base stylesheet draws `.input` on `#fafafa` (the page ground) but
// every per-component drawing overrides it to `#fefefe` — and the drawings are
// what the surface was designed against. Raised is also the argument that
// survives being stated: a field lighter than its page reads as a place to type,
// where a field the same colour as the page reads as a printed label with a box
// around it. `readonly` and `disabled` deliberately do NOT follow it back up:
// dropping to the well is how a field says it is not a place to type.
const STATE_BASE: Record<InputState, string> = {
  default: [
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
    `placeholder:text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
    `hover:border-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  ].join(' '),
  error: [
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-error-solid', T.errorSolid)}]`,
    `placeholder:text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
    `ring-1 ring-[${v('sv-error-solid', T.errorSolid)}]`,
  ].join(' '),
  disabled: [
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    `border-[${v('sv-border', T.border)}]`,
    `placeholder:text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
    'opacity-60 cursor-not-allowed',
  ].join(' '),
  readonly: [
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
    `placeholder:text-[${v('sv-fg-muted', T.fgMuted)}]`,
  ].join(' '),
}

// 36px tall, 8px/12px padding, 13px type — the canvas `.input`, and the height
// `density.controlH` names. `text-base` IS 13px since the platform ladder moved
// into `--text-*`; it was spelled `text-[0.8125rem]` while `text-base` still
// meant Tailwind's 16px.
const LAYOUT = 'block w-full h-9 px-3 py-2 text-base'

const RADIUS = `rounded-[${v('radius-base', T.radiusBase)}]`

const BORDER_BASE = 'border'

const FOCUS = [
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-offset-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-visible:ring-offset-[${v('sv-bg', T.bg)}]`,
].join(' ')

const MOTION = 'transition-[box-shadow,border-color] duration-150'

/**
 * Compute the full default className for an input.
 *
 * Composition order: layout → radius → border → state colors → motion →
 * focus. The input paints FLAT (no shadow): it sits in the content flow rather
 * than floating above it, so its border carries the affordance on its own.
 * Author-supplied `props.className` is appended later by the
 * dispatcher via `resolveClasses` and wins same-property conflicts because
 * tailwind-merge drops the loser, NOT because Tailwind v4 emits utilities in
 * source order.
 */
export const computeInputDefaultClasses = (input: InputDefaultClassesInput = {}): string => {
  const state = input.state ?? 'default'
  return [LAYOUT, RADIUS, BORDER_BASE, STATE_BASE[state], MOTION, FOCUS].join(' ')
}
