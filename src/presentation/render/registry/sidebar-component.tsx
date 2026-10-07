/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveClasses } from '../../design/resolve-classes'
import {
  computeSidebarRailBoxClasses,
  type SidebarRailBreakpoint,
} from '../../design/sidebar-default-classes'
import * as Renderers from '../elements'
import { resolveChildTranslation } from '../i18n/translation-handler'
import { SIDEBAR_DRAWER_ROOT_ATTRIBUTE, SidebarDrawerFrame } from './sidebar-drawer'
import { renderSidebarGroups } from './sidebar-groups'
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
}

/**
 * The box's props: the author's, plus the rail's width and the drawer's root
 * marker when either is declared.
 *
 * The rail's WIDTH is the only thing that belongs on the box — everything else
 * it does is a rule on the navigation root inside. The props object is returned
 * untouched when neither a rail nor a drawer is declared, so a sidebar that
 * declares neither renders the attributes it has always rendered, byte for byte.
 */
function sidebarBoxProps(
  elementProps: Record<string, unknown>,
  rail: SidebarRailBreakpoint | undefined,
  drawer: SidebarRailBreakpoint | undefined
): Record<string, unknown> {
  const railBox = computeSidebarRailBoxClasses(rail, drawer)
  const withRail =
    railBox === ''
      ? elementProps
      : {
          ...elementProps,
          className: resolveClasses(
            railBox,
            undefined,
            elementProps['className'] as string | undefined
          ),
        }
  return drawer === undefined ? withRail : { ...withRail, [SIDEBAR_DRAWER_ROOT_ATTRIBUTE]: '' }
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
  const { groups, trackNavigation, rail, drawer } = (component ?? {}) as SidebarKeys
  const railBelow = rail?.below
  const drawerBelow = drawer?.below
  const hasGroups = groups !== undefined && groups.length > 0
  // With `groups`, the sidebar is named on its NAVIGATION root rather than on
  // the box: the box also holds whatever the author put beside the navigation
  // and usually stretches to the page, so a name on it measures the page.
  const { 'data-component-type': componentType, ...unnamedProps } = elementProps
  const children = hasGroups
    ? [
        renderSidebarGroups(groups, sidebarContext(currentLang, languages, designStyles), {
          trackNavigation: trackNavigation === true,
          rail: railBelow,
          drawer: drawerBelow,
          componentType: componentType as string | undefined,
        }),
        ...renderedChildren,
      ]
    : renderedChildren
  const boxProps = hasGroups ? namedBoxProps(unnamedProps, drawerBelow) : elementProps
  return Renderers.renderHTMLElement({
    type: 'div',
    props: sidebarBoxProps(boxProps, railBelow, drawerBelow),
    content: content,
    children:
      drawerBelow === undefined
        ? children
        : [
            <SidebarDrawerFrame
              key="sidebar-drawer"
              below={drawerBelow}
              label={resolveChildTranslation(drawer?.label ?? 'Menu', currentLang, languages)}
            >
              {children}
            </SidebarDrawerFrame>,
          ],
    interactions: interactions,
  })
}
