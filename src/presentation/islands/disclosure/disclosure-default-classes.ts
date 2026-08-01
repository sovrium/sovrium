/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { FOCUS_VISIBLE_RING } from '@/presentation/islands/recipes/shared-tokens-default-classes'
import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'


type TabsOrientation = 'horizontal' | 'vertical'
type TabState = 'default' | 'active' | 'disabled'
type TriggerState = 'default' | 'open' | 'disabled'

const RADIUS_LG = `rounded-[${v('sv-radius-lg', T.radiusLg)}]`

const DISABLED_INLINE = 'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'


const TABS_ROOT_VERTICAL =
  'grid grid-cols-1 gap-6 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start'

export const computeTabsRootClasses = ({
  orientation = 'horizontal',
}: {
  orientation?: TabsOrientation
} = {}): string => (orientation === 'vertical' ? TABS_ROOT_VERTICAL : '')


const TABS_LIST_LAYOUT = 'relative flex'

const TABS_LIST_BORDER_HORIZONTAL = [
  'overflow-x-auto',
  'border-b',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

const TABS_LIST_BORDER_VERTICAL = [
  'flex-col',
  'border-b md:border-b-0 md:border-r',
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

const TAB_LAYOUT_VERTICAL = 'text-left'

const TAB_DEFAULT_SURFACE = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `hover:text-[${v('sv-fg', T.fg)}]`,
].join(' ')

const TAB_ACCENT_RESERVED_HORIZONTAL = 'border-b-2 border-transparent'

const TAB_ACCENT_RESERVED_VERTICAL = 'border-l-2 border-transparent'

const TAB_ACTIVE_SURFACE_HORIZONTAL = [
  'data-[active]:border-primary',
  'data-[active]:text-primary',
].join(' ')

const TAB_ACTIVE_SURFACE_VERTICAL = [
  'data-[active]:border-primary',
  'data-[active]:bg-background-subtle',
  'data-[active]:text-primary',
].join(' ')

export const computeTabClasses = ({
  state: _state = 'default',
  orientation = 'horizontal',
}: {
  state?: TabState
  orientation?: TabsOrientation
} = {}): string =>
  [
    TAB_LAYOUT,
    ...(orientation === 'vertical' ? [TAB_LAYOUT_VERTICAL] : []),
    TAB_DEFAULT_SURFACE,
    orientation === 'vertical' ? TAB_ACCENT_RESERVED_VERTICAL : TAB_ACCENT_RESERVED_HORIZONTAL,
    orientation === 'vertical' ? TAB_ACTIVE_SURFACE_VERTICAL : TAB_ACTIVE_SURFACE_HORIZONTAL,
    FOCUS_VISIBLE_RING,
    DISABLED_INLINE,
  ].join(' ')


const TAB_LABEL_LAYOUT = 'block'

const TAB_DESCRIPTION_LAYOUT = 'mt-0.5 block text-xs font-normal'

const TAB_DESCRIPTION_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

export const computeTabLabelClasses = (): string => TAB_LABEL_LAYOUT

export const computeTabDescriptionClasses = (): string =>
  [TAB_DESCRIPTION_LAYOUT, TAB_DESCRIPTION_SURFACE].join(' ')


const TAB_INDICATOR_LAYOUT = 'absolute bottom-0 h-0.5 transition-all duration-200'

const TAB_INDICATOR_SURFACE = 'bg-primary'

export const computeTabIndicatorClasses = (): string =>
  [TAB_INDICATOR_LAYOUT, TAB_INDICATOR_SURFACE].join(' ')


const TAB_PANEL_LAYOUT = 'p-4 text-sm'

const TAB_PANEL_LAYOUT_VERTICAL = 'min-w-0'

const TAB_PANEL_SURFACE = `text-[${v('sv-fg', T.fg)}]`

export const computeTabPanelClasses = ({
  orientation = 'horizontal',
}: {
  orientation?: TabsOrientation
} = {}): string =>
  [
    TAB_PANEL_LAYOUT,
    ...(orientation === 'vertical' ? [TAB_PANEL_LAYOUT_VERTICAL] : []),
    TAB_PANEL_SURFACE,
  ].join(' ')


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
