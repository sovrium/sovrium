/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'

export type InputState = 'default' | 'error' | 'disabled' | 'readonly'

export interface InputDefaultClassesInput {
  readonly state?: InputState
}


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

export const computeInputDefaultClasses = (input: InputDefaultClassesInput = {}): string => {
  const state = input.state ?? 'default'
  return [LAYOUT, RADIUS, BORDER_BASE, STATE_BASE[state], SHADOW, MOTION, FOCUS].join(' ')
}
