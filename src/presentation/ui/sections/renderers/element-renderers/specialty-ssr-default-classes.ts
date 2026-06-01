/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


const TIME_PICKER_WRAPPER_LAYOUT = 'inline-flex items-center gap-2 px-3 py-1.5'

const TIME_PICKER_WRAPPER_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  'focus-within:ring-2',
  `focus-within:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `transition-[border-color,box-shadow] duration-[${v('sv-duration-fast', T.durationFast)}] ease-[${v('sv-ease-default', T.easeDefault)}]`,
].join(' ')

export const computeTimePickerWrapperClasses = (): string =>
  [TIME_PICKER_WRAPPER_LAYOUT, TIME_PICKER_WRAPPER_SURFACE].join(' ')

const TIME_PICKER_FIELD_LAYOUT = 'border-0 bg-transparent px-0 py-0'

const TIME_PICKER_FIELD_SURFACE = [
  `text-[${v('sv-fg', T.fg)}]`,
  `font-[${v('sv-font-sans', T.fontSans)}]`,
  `text-[${v('sv-font-size-base', T.fontSizeBase)}]`,
  'focus:outline-none',
]
  .filter(Boolean)
  .join(' ')

export const computeTimePickerFieldClasses = (): string =>
  [TIME_PICKER_FIELD_LAYOUT, TIME_PICKER_FIELD_SURFACE].join(' ')

const TIME_PICKER_AMPM_LAYOUT = 'text-xs select-none shrink-0'

const TIME_PICKER_AMPM_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

export const computeTimePickerAmPmClasses = (): string =>
  [TIME_PICKER_AMPM_LAYOUT, TIME_PICKER_AMPM_SURFACE].join(' ')


const LANGUAGE_SWITCHER_TRIGGER_LAYOUT =
  'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium leading-none'

const LANGUAGE_SWITCHER_TRIGGER_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `hover:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  'focus-visible:outline-none focus-visible:ring-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `transition-[background-color,border-color,box-shadow] duration-[${v('sv-duration-fast', T.durationFast)}] ease-[${v('sv-ease-default', T.easeDefault)}]`,
].join(' ')

export const computeLanguageSwitcherTriggerClasses = (): string =>
  [LANGUAGE_SWITCHER_TRIGGER_LAYOUT, LANGUAGE_SWITCHER_TRIGGER_SURFACE].join(' ')

const LANGUAGE_SWITCHER_DROPDOWN_LAYOUT = 'absolute top-full left-0 z-10 mt-1 min-w-[10rem] py-1'

const LANGUAGE_SWITCHER_DROPDOWN_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-overlay', T.bgOverlay)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `shadow-[${v('sv-shadow-md', T.shadowMd)}]`,
].join(' ')

export const computeLanguageSwitcherDropdownClasses = (): string =>
  [LANGUAGE_SWITCHER_DROPDOWN_LAYOUT, LANGUAGE_SWITCHER_DROPDOWN_SURFACE].join(' ')


const REORDERABLE_LIST_LAYOUT = 'flex flex-col gap-2 list-none p-0 m-0'

export const computeReorderableListClasses = (): string => REORDERABLE_LIST_LAYOUT

const REORDERABLE_HANDLE_LAYOUT =
  'inline-flex items-center justify-center w-6 h-6 mr-2 select-none cursor-grab'

const REORDERABLE_HANDLE_SURFACE = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `rounded-[${v('sv-radius-sm', T.radiusSm)}]`,
  `hover:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `hover:text-[${v('sv-fg', T.fg)}]`,
  'focus-visible:outline-none focus-visible:ring-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  'active:cursor-grabbing',
  `aria-[pressed=true]:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `aria-[pressed=true]:text-[${v('sv-fg', T.fg)}]`,
].join(' ')

export const computeReorderableHandleClasses = (): string =>
  [REORDERABLE_HANDLE_LAYOUT, REORDERABLE_HANDLE_SURFACE].join(' ')
