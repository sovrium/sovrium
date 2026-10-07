/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useId, type ReactElement, type ReactNode } from 'react'
import {
  computeSidebarDrawerBodyClasses,
  computeSidebarDrawerPanelClasses,
  computeSidebarDrawerTriggerClasses,
  type SidebarRailBreakpoint,
} from '@/presentation/design/sidebar-default-classes'
import { cn } from '../../design/class-merge'
import { resolveLucideIcon } from '../elements/lucide-resolver'

/**
 * The attribute naming the element a drawer frame lives in. The island finds
 * its trigger, panel and body from it, so each frame is addressed by its own
 * container and two drawers on one page never reach into each other.
 *
 * Spelled literally on both sides of the SSR boundary — here and in
 * `islands/navigation/sidebar-drawer-controller.ts` — because the render tree
 * and the island tree may not import each other.
 */
export const SIDEBAR_DRAWER_ROOT_ATTRIBUTE = 'data-sidebar-drawer'

interface SidebarDrawerFrameProps {
  /** Breakpoint at and above which the navigation renders inline. */
  readonly below: SidebarRailBreakpoint
  /** Accessible name of the menu button, already translated. */
  readonly label: string
  /** The navigation itself — rendered once, inline, and lifted into the panel on open. */
  readonly children: ReactNode
  /** The author's classes for the menu button, after its recipe (the docs `menuButton` part). */
  readonly triggerClassName?: string
}

/**
 * A navigation that folds into a drawer behind a menu button below `below`.
 *
 * ─── ONE COPY OF THE NAVIGATION ────────────────────────────────────────────
 *
 * The navigation is rendered ONCE, in the inline body. Opening the drawer lifts
 * the body's children into the `<dialog>`, and closing it puts them back. A
 * second server-rendered copy for the drawer would double every island it holds
 * (a fetched group would fetch twice), repeat every id a disclosure derives, and
 * put two identically named landmarks in the document.
 *
 * ─── WHY THE BUTTON STARTS DISABLED ────────────────────────────────────────
 *
 * The panel opens through `showModal()`, which only the island can call. A
 * button the reader can press before that island has mounted would swallow the
 * press and read as a menu that does nothing, so it arrives disabled and the
 * island enables it the moment it can honour a click.
 *
 * `aria-controls` names the dialog from the first paint, so the relationship is
 * true before and after hydration alike.
 *
 * ─── A READER WITHOUT JAVASCRIPT ───────────────────────────────────────────
 *
 * Without scripting the island never mounts, so the button would stay disabled
 * and the body hidden below the breakpoint: the navigation would be unreachable
 * on a phone. A `<noscript>` rule restores the pre-drawer shape for exactly that
 * reader — the body back in the layout, the dead button gone — and costs a
 * scripting reader nothing, since a browser running scripts parses `<noscript>`
 * as inert text. Hiding the body only once the island has mounted would serve
 * the same reader, at the price of every phone visitor watching the navigation
 * paint and then vanish on each page load.
 */
const NO_SCRIPT_FALLBACK_CSS =
  '[data-sidebar-drawer-body]{display:contents}[data-sidebar-drawer-trigger]{display:none}'

export function SidebarDrawerFrame({
  below,
  label,
  children,
  triggerClassName,
}: SidebarDrawerFrameProps): ReactElement {
  // `useId` spells a string that is not a valid CSS identifier in every React
  // version; the id only has to be unique and stable, so it keeps the safe part.
  const id = `sidebar-drawer${useId().replace(/[^A-Za-z0-9_-]/g, '-')}`
  const MenuIcon = resolveLucideIcon('menu')
  return (
    <>
      <span
        data-island="sidebar-drawer"
        data-island-props="{}"
        data-component-type="drawer"
      />
      <button
        type="button"
        disabled
        data-component-type="button"
        data-sidebar-drawer-trigger=""
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-controls={id}
        className={cn(computeSidebarDrawerTriggerClasses(below), triggerClassName)}
      >
        {MenuIcon !== undefined && (
          <MenuIcon
            aria-hidden="true"
            size={16}
            strokeWidth={2}
          />
        )}
        <span>{label}</span>
      </button>
      <dialog
        id={id}
        aria-label={label}
        data-sidebar-drawer-panel=""
        className={computeSidebarDrawerPanelClasses()}
      />
      <div
        data-sidebar-drawer-body=""
        className={computeSidebarDrawerBodyClasses(below)}
      >
        {children}
      </div>
      <noscript>
        <style>{NO_SCRIPT_FALLBACK_CSS}</style>
      </noscript>
    </>
  )
}
