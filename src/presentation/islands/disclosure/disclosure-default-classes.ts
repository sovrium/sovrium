/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


type TabsOrientation = 'horizontal' | 'vertical'
type TabState = 'default' | 'selected' | 'disabled'
type TriggerState = 'default' | 'open' | 'disabled'

const RADIUS_LG = `rounded-[${v('sv-radius-lg', T.radiusLg)}]`

const DISABLED_INLINE = 'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'


const TABS_LIST_LAYOUT = 'flex'

const TABS_LIST_BORDER_HORIZONTAL = ['border-b', `border-[${v('sv-border', T.border)}]`].join(' ')

const TABS_LIST_BORDER_VERTICAL = [
  'flex-col border-r',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

export const computeTabsListClasses = ({
  orientation = 'horizontal',
}: {
  orientation?: TabsOrientation
} = {}): string =>
  [
    TABS_LIST_LAYOUT,
    orientation === 'vertical' ? TABS_LIST_BORDER_VERTICAL : TABS_LIST_BORDER_HORIZONTAL,
  ].join(' ')


const TAB_LAYOUT = 'px-4 py-2 text-sm font-medium transition-colors'

const TAB_DEFAULT_SURFACE = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `hover:text-[${v('sv-fg', T.fg)}]`,
].join(' ')

const TAB_SELECTED_SURFACE = [
  'data-[selected]:border-b-2',
  `data-[selected]:border-[${v('sv-primary', T.primary)}]`,
  `data-[selected]:text-[${v('sv-primary', T.primary)}]`,
].join(' ')

export const computeTabClasses = ({
  state: _state = 'default',
}: {
  state?: TabState
} = {}): string =>
  [TAB_LAYOUT, TAB_DEFAULT_SURFACE, TAB_SELECTED_SURFACE, DISABLED_INLINE].join(' ')


const TAB_INDICATOR_LAYOUT = 'absolute bottom-0 h-0.5 transition-all duration-200'

const TAB_INDICATOR_SURFACE = 'bg-primary'

export const computeTabIndicatorClasses = (): string =>
  [TAB_INDICATOR_LAYOUT, TAB_INDICATOR_SURFACE].join(' ')


const TAB_PANEL_LAYOUT = 'p-4 text-sm'

const TAB_PANEL_SURFACE = `text-[${v('sv-fg', T.fg)}]`

export const computeTabPanelClasses = (): string => [TAB_PANEL_LAYOUT, TAB_PANEL_SURFACE].join(' ')


const ACCORDION_ROOT_LAYOUT = 'border'

const ACCORDION_ROOT_SURFACE = [
  `border-[${v('sv-border', T.border)}]`,
  'divide-y',
  `divide-[${v('sv-border', T.border)}]`,
].join(' ')

export const computeAccordionRootClasses = (): string =>
  [ACCORDION_ROOT_LAYOUT, RADIUS_LG, ACCORDION_ROOT_SURFACE].join(' ')


const ACCORDION_TRIGGER_LAYOUT =
  'flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors'

const ACCORDION_TRIGGER_SURFACE = [
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `data-[open]:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

export const computeAccordionTriggerClasses = ({
  state: _state = 'default',
}: {
  state?: TriggerState
} = {}): string => [ACCORDION_TRIGGER_LAYOUT, ACCORDION_TRIGGER_SURFACE, DISABLED_INLINE].join(' ')


const ACCORDION_ICON_LAYOUT = 'shrink-0 transition-transform duration-200 data-[open]:rotate-180'

const ACCORDION_ICON_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

export const computeAccordionIconClasses = (): string =>
  [ACCORDION_ICON_LAYOUT, ACCORDION_ICON_SURFACE].join(' ')


const ACCORDION_PANEL_LAYOUT = 'overflow-hidden px-4 pb-3 text-sm'

const ACCORDION_PANEL_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

export const computeAccordionPanelClasses = (): string =>
  [ACCORDION_PANEL_LAYOUT, ACCORDION_PANEL_SURFACE].join(' ')
