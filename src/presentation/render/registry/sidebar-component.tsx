/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type CSSProperties, type ReactElement } from 'react'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { cn } from '../../design/class-merge'
import { resolveClasses } from '../../design/resolve-classes'
import {
  computeSidebarBoxClasses,
  computeSidebarDrawerSeparatorClasses,
  computeSidebarRailBoxClasses,
  type SidebarRailBreakpoint,
} from '../../design/sidebar-default-classes'
import {
  computeSidebarFoldControlDrawerClasses,
  computeSidebarFooterClasses,
  computeSidebarHeaderClasses,
  computeSidebarShellBoxClasses,
  computeSidebarShellDrawerBoxClasses,
  computeSidebarShellDrawerTriggerClasses,
  computeSidebarSurfaceClasses,
} from '../../design/sidebar-shell-classes'
import * as Renderers from '../elements'
import { splitSlots } from '../elements/slot-children'
import { resolveChildTranslation } from '../i18n/translation-handler'
import { SIDEBAR_DRAWER_ROOT_ATTRIBUTE, SidebarDrawerFrame } from './sidebar-drawer'
import { renderSidebarGroups } from './sidebar-groups'
import {
  foldsOf,
  isShell,
  renderSidebarRailHandle,
  renderSidebarShellRuntime,
  renderSidebarTrigger,
  sidebarShellAttributes,
  type SidebarShellKeys,
} from './sidebar-shell-parts'
import type { ComponentRenderer } from './component-dispatch-config'
import type { SidebarI18n } from './sidebar-entry'
import type { SidebarGroup } from '@/domain/models/app/pages/components/component-types/layout/sidebar'
import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'

/** The sidebar keys this renderer reads off the component, all optional. */
interface SidebarKeys {
  readonly groups?: readonly SidebarGroup[]
  readonly trackNavigation?: boolean
  readonly rail?: { readonly below?: SidebarRailBreakpoint }
  readonly drawer?: { readonly below?: SidebarRailBreakpoint; readonly label?: string }
  /** This menu button's place along its corner when another shell drawer holds the first. */
  readonly _drawerSlot?: number
}

/**
 * The box's props: the author's, named `data-slot="sidebar"` and painted on the
 * sidebar ground, plus the rail's width and the drawer's root marker when
 * either is declared.
 *
 * The rail's WIDTH is the only rail rule that belongs on the box — everything
 * else it does is a rule on the navigation root inside. The author's
 * `className` is merged last, so it wins every same-property conflict with the
 * ground and the rail. `replace: true` drops the ground and the ink — the
 * box's look — and keeps the rail and shell rules, which are what make the
 * sidebar fold rather than how it looks.
 */
function sidebarBoxProps(
  elementProps: Record<string, unknown>,
  keys: SidebarShellKeys,
  box: {
    readonly rail: SidebarRailBreakpoint | undefined
    readonly drawer: SidebarRailBreakpoint | undefined
    readonly replace: boolean
  }
): Record<string, unknown> {
  const { rail, drawer, replace } = box
  const recipe = [
    replace ? '' : computeSidebarBoxClasses(),
    computeSidebarRailBoxClasses(rail, drawer),
    isShell(keys) ? computeSidebarShellBoxClasses() : '',
    isShell(keys) && drawer !== undefined ? computeSidebarShellDrawerBoxClasses(drawer) : '',
  ]
    .filter((classes) => classes !== '')
    .join(' ')
  const boxed = {
    ...elementProps,
    ...sidebarShellAttributes(keys),
    'data-slot': 'sidebar',
    className: resolveClasses(recipe, undefined, elementProps['className'] as string | undefined),
  }
  return drawer === undefined ? boxed : { ...boxed, [SIDEBAR_DRAWER_ROOT_ATTRIBUTE]: '' }
}

/**
 * The props of a box whose name moved onto its navigation. A folding sidebar's
 * box is what a phone draws as the bar holding the menu button, so it keeps the
 * generic `container` name; any other box is left unnamed.
 */
const namedBoxProps = (
  unnamedProps: Record<string, unknown>,
  drawer: SidebarRailBreakpoint | undefined
): Record<string, unknown> =>
  drawer === undefined ? unnamedProps : { ...unnamedProps, 'data-component-type': 'container' }

/** The language and the author's part classes every row of the navigation reads. */
const sidebarContext = (
  currentLang: string | undefined,
  languages: SidebarI18n['languages'],
  designStyles: ComponentDesignResolution | undefined
): SidebarI18n => ({ currentLang, languages, parts: designStyles?.parts })

/** The author's classes for the `inner` part: the drawn panel. */
const innerPartOf = (designStyles: ComponentDesignResolution | undefined): string | undefined =>
  designStyles?.parts['inner']

/**
 * `sidebar` — a layout box, plus (when declared) the `groups` navigation
 * landmark. The groups render BEFORE any authored children so a sidebar that
 * carries both reads top-down as navigation first, then whatever the author
 * put underneath.
 *
 * A declared `drawer` keeps the sidebar's OWN slot: the menu button renders
 * where the sidebar was, so a page with no header still has somewhere to open
 * it from, and the whole content — groups and authored children alike — is
 * what folds into the drawer.
 */
export const renderSidebarComponent: ComponentRenderer = ({
  elementProps,
  content,
  renderedChildren,
  interactions,
  component,
  currentLang,
  languages,
  designStyles,
}): ReactElement | null => {
  const keys = (component ?? {}) as SidebarKeys & SidebarShellKeys
  const { groups, trackNavigation, rail, drawer } = keys
  const railBelow = rail?.below
  const drawerBelow = drawer?.below
  const hasGroups = groups !== undefined && groups.length > 0
  const slots = splitSlots('sidebar', component, renderedChildren)
  // With `groups`, the sidebar is named on its NAVIGATION root rather than on
  // the box: the box also holds whatever the author put beside the navigation
  // and usually stretches to the page, so a name on it measures the page.
  const { 'data-component-type': componentType, ...unnamedProps } = elementProps
  const body = [
    ...(hasGroups
      ? [
          renderSidebarGroups(groups, sidebarContext(currentLang, languages, designStyles), {
            trackNavigation: trackNavigation === true,
            rail: railBelow,
            drawer: drawerBelow,
            componentType: componentType as string | undefined,
          }),
        ]
      : []),
    ...(slots['$children'] ?? []),
  ]
  const surface = renderSurface(slots['header'], body, slots['footer'], innerPartOf(designStyles))
  const boxProps = hasGroups ? namedBoxProps(unnamedProps, drawerBelow) : elementProps
  const translate = (text: string) => resolveChildTranslation(text, currentLang, languages)
  return Renderers.renderHTMLElement({
    type: 'div',
    props: sidebarBoxProps(boxProps, keys, {
      rail: railBelow,
      drawer: drawerBelow,
      replace: designStyles?.replace === true,
    }),
    content: content,
    children: [
      framed(
        surface,
        drawer,
        {
          translate,
          closeLabel: resolveInterpreterString('sidebar.drawerClose', currentLang, languages),
        },
        isShell(keys) ? keys : undefined
      ),
      ...renderFoldControls(keys, translate),
    ],
    interactions: interactions,
  })
}

/**
 * A shell menu button's offset along its corner: the first sits at the corner
 * (its recipe's `left-2` / `right-2`), each later one a button's width plus the
 * gap further in, so two shell drawers on one page never stack in one spot.
 */
const cornerOffset = (shell: SidebarKeys & SidebarShellKeys): CSSProperties | undefined => {
  const slot = shell._drawerSlot ?? 0
  if (slot === 0) return undefined
  const edge = shell.side === 'right' ? 'right' : 'left'
  return { [edge]: `calc(0.5rem + ${slot} * 2.25rem)` }
}

/** The panel, inside the drawer frame when the sidebar folds into one below a breakpoint. */
const framed = (
  surface: ReactElement,
  drawer: SidebarKeys['drawer'],
  words: { readonly translate: (text: string) => string; readonly closeLabel: string },
  shell: (SidebarKeys & SidebarShellKeys) | undefined
): ReactElement =>
  drawer?.below === undefined ? (
    surface
  ) : (
    <SidebarDrawerFrame
      key="sidebar-drawer"
      below={drawer.below}
      label={words.translate(drawer.label ?? 'Menu')}
      closeLabel={words.closeLabel}
      triggerClassName={shell ? computeSidebarShellDrawerTriggerClasses() : undefined}
      triggerStyle={shell ? cornerOffset(shell) : undefined}
    >
      {surface}
    </SidebarDrawerFrame>
  )

/**
 * The drawn panel: shadcn/ui's inner `data-sidebar="sidebar"` surface, holding
 * the header, the navigation and the author's children, and the footer. The
 * author's `inner` part classes land here, after the recipe.
 */
const renderSurface = (
  header: readonly ReactElement[] | undefined,
  body: readonly ReactElement[],
  footer: readonly ReactElement[] | undefined,
  innerClasses: string | undefined
): ReactElement => (
  <div
    key="sidebar-surface"
    data-sidebar="sidebar"
    data-slot="sidebar-inner"
    className={cn(computeSidebarSurfaceClasses(), innerClasses)}
  >
    {header === undefined || header.length === 0 ? undefined : (
      <div
        data-sidebar="header"
        data-slot="sidebar-header"
        className={computeSidebarHeaderClasses()}
      >
        {header}
      </div>
    )}
    {body}
    {footer === undefined || footer.length === 0 ? undefined : (
      <div
        data-sidebar="footer"
        data-slot="sidebar-footer"
        className={computeSidebarFooterClasses()}
      >
        <div
          role="separator"
          data-slot="sidebar-separator"
          className={computeSidebarDrawerSeparatorClasses()}
        />
        {footer}
      </div>
    )}
  </div>
)

/** The trigger, the rail handle and the fold runtime of a sidebar that folds; nothing otherwise. */
const renderFoldControls = (
  keys: SidebarShellKeys & Pick<SidebarKeys, 'drawer'>,
  translate: (text: string) => string
): readonly ReactElement[] => {
  if (foldsOf(keys) === undefined) return []
  const label = translate(keys.trigger?.label ?? 'Toggle Sidebar')
  const expanded = keys._collapsed !== true
  // On a phone the drawer's menu button takes the trigger's place.
  const below = keys.drawer?.below
  const hidden = below === undefined ? '' : computeSidebarFoldControlDrawerClasses(below)
  return [
    ...(keys.trigger === undefined ? [] : [renderSidebarTrigger(label, expanded, hidden)]),
    ...(keys.railHandle === true ? [renderSidebarRailHandle(label, hidden)] : []),
    renderSidebarShellRuntime(),
  ]
}
