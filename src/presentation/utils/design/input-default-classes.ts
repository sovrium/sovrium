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
 * only color / radius / shadow / focus-ring classes go through
 * {@link withVarFallback} so `app.theme.*` overrides still win at the CSS
 * cascade layer (var lookups resolve `--sv-*` first, fall back to the inline
 * OKLCH literal).
 *
 * The input schema (`form-controls/input.ts`) does not currently expose a
 * `size` or `state` field — `inputType` is the only schema-level discriminator.
 * Visual state is derived by the dispatcher from native HTML attributes carried
 * inside `props` (`disabled`, `readOnly`, `aria-invalid`), matching the way
 * native `<input>` elements expose their interaction state to the browser.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'

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

const STATE_BASE: Record<InputState, string> = {
  default: [
    `bg-[${v('sv-bg', T.bg)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border', T.border)}]`,
    `placeholder:text-[${v('sv-fg-muted', T.fgMuted)}]`,
  ].join(' '),
  error: [
    `bg-[${v('sv-bg', T.bg)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-error-solid', T.errorSolid)}]`,
    `placeholder:text-[${v('sv-fg-muted', T.fgMuted)}]`,
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
    `border-[${v('sv-border', T.border)}]`,
    `placeholder:text-[${v('sv-fg-muted', T.fgMuted)}]`,
  ].join(' '),
}

const LAYOUT = 'block w-full h-9 px-3 py-2 text-sm'

const RADIUS = `rounded-[${v('sv-radius-md', T.radiusMd)}]`

const BORDER_BASE = 'border'

const SHADOW = `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`

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
 * Composition order: layout → radius → border → state colors → elevation →
 * motion → focus. Author-supplied `props.className` is appended later by the
 * dispatcher and wins at the cascade because Tailwind v4 emits utilities in
 * source order.
 */
export const computeInputDefaultClasses = (input: InputDefaultClassesInput = {}): string => {
  const state = input.state ?? 'default'
  return [LAYOUT, RADIUS, BORDER_BASE, STATE_BASE[state], SHADOW, MOTION, FOCUS].join(' ')
}
