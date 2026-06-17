/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


const TRIGGER_LAYOUT = 'flex w-full items-center justify-between px-3 py-2 text-sm'

const TRIGGER_RADIUS = `rounded-[${v('sv-radius-md', T.radiusMd)}]`

const TRIGGER_BORDER_BASE = 'border'

const TRIGGER_SURFACE = [
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

const TRIGGER_SHADOW = `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`

const TRIGGER_OPEN = [
  `data-[open]:border-[${v('sv-focus-ring', T.focusRing)}]`,
  `data-[open]:ring-1`,
  `data-[open]:ring-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

const TRIGGER_DISABLED = 'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60'

const TRIGGER_FOCUS = [
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-offset-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-visible:ring-offset-[${v('sv-bg', T.bg)}]`,
].join(' ')

const TRIGGER_MOTION = 'transition-[box-shadow,border-color] duration-150'

export const computeSelectTriggerClasses = (): string =>
  [
    TRIGGER_LAYOUT,
    TRIGGER_RADIUS,
    TRIGGER_BORDER_BASE,
    TRIGGER_SURFACE,
    TRIGGER_SHADOW,
    TRIGGER_MOTION,
    TRIGGER_FOCUS,
    TRIGGER_OPEN,
    TRIGGER_DISABLED,
  ].join(' ')


const POPUP_LAYOUT = 'max-h-60 overflow-auto py-1'

const POPUP_RADIUS = `rounded-[${v('sv-radius-md', T.radiusMd)}]`

const POPUP_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-overlay', T.bgOverlay)}]`,
].join(' ')

const POPUP_SHADOW = `shadow-[${v('sv-shadow-lg', T.shadowLg)}]`

export const computeSelectPopupClasses = (): string =>
  [POPUP_LAYOUT, POPUP_RADIUS, POPUP_SURFACE, POPUP_SHADOW].join(' ')

export const computeSelectListClasses = (): string =>
  [POPUP_LAYOUT, POPUP_RADIUS, POPUP_SURFACE, POPUP_SHADOW].join(' ')


const ITEM_LAYOUT = 'flex cursor-pointer items-center px-3 py-2 text-sm outline-none'

const ITEM_BASE = `text-[${v('sv-fg', T.fg)}]`

const ITEM_HIGHLIGHTED = [
  `data-[highlighted]:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `data-[highlighted]:text-[${v('sv-primary-subtle-fg', T.primarySubtleFg)}]`,
].join(' ')

const ITEM_SELECTED = 'data-[selected]:font-medium'

const ITEM_DISABLED = [
  'data-[disabled]:cursor-not-allowed',
  `data-[disabled]:text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
].join(' ')

export const computeSelectItemClasses = (): string =>
  [ITEM_LAYOUT, ITEM_BASE, ITEM_HIGHLIGHTED, ITEM_SELECTED, ITEM_DISABLED].join(' ')


export const computeSelectIconClasses = (): string =>
  ['ml-2', `text-[${v('sv-fg-subtle', T.fgSubtle)}]`].join(' ')

export const computeSelectItemIndicatorClasses = (): string => ['ml-auto', 'text-primary'].join(' ')


export const computeSelectLabelClasses = (): string =>
  ['mb-1 block text-sm font-medium', `text-[${v('sv-fg', T.fg)}]`].join(' ')


export const computeComboboxInputGroupClasses = (): string =>
  [
    'flex w-full items-center',
    TRIGGER_RADIUS,
    TRIGGER_BORDER_BASE,
    TRIGGER_SURFACE,
    TRIGGER_SHADOW,
    TRIGGER_MOTION,
    `focus-within:border-[${v('sv-focus-ring', T.focusRing)}]`,
    `focus-within:ring-1`,
    `focus-within:ring-[${v('sv-focus-ring', T.focusRing)}]`,
    TRIGGER_DISABLED,
  ].join(' ')

export const computeComboboxInputClasses = (): string =>
  ['flex-1 bg-transparent px-3 py-2 text-sm outline-none', `text-[${v('sv-fg', T.fg)}]`].join(' ')

export const computeComboboxEmptyClasses = (): string =>
  ['px-3 py-2 text-sm', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')
