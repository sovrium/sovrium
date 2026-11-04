/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useId, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { OverlayCloseGlyph } from '@/presentation/design/overlay-close-glyph'
import {
  computeSidebarDrawerBodyClasses,
  computeSidebarDrawerContentClasses,
  computeSidebarDrawerHeaderClasses,
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
  /** Accessible name of the drawer's close button (`sidebar.drawerClose`), already translated. */
  readonly closeLabel: string
  /** The navigation itself — rendered once, inline, and lifted into the panel on open. */
  readonly children: ReactNode
  /** The author's classes for the menu button, after its recipe (the docs `menuButton` part). */
  readonly triggerClassName?: string
  /** Where a shell menu button sits along its corner, when another holds the first place. */
  readonly triggerStyle?: CSSProperties
  /** The author's classes for the drawer panel, after its recipe (the docs `drawer` part). */
  readonly panelClassName?: string
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
 * ─── A WAY OUT THAT IS NOT A GESTURE ──────────────────────────────────────
 *
 * The dialog carries its own header with a close button, as shadcn/ui's sheet
 * does, above the navigation the island lifts in: Escape and a tap on the
 * backdrop are not discoverable to every reader. The navigation moves into the
 * dialog's content node and back, so the header stays put.
 *
 * ─── A PRESS BEFORE THE SCRIPTS RUN ────────────────────────────────────────
 *
 * The button is pressable from the first paint. It is a native invoker
 * (`commandfor` + `command="show-modal"`), so a press made while the page's
 * scripts are still loading opens the panel through the browser itself; the
 * island, once mounted, finds the panel open and lifts the navigation into it.
 * The close button invokes `close` the same way. After mount the island handles
 * the press itself and cancels the native command, so the panel opens once.
 *
 * `aria-controls` names the dialog from the first paint, so the relationship is
 * true before and after hydration alike.
 *
 * ─── A READER WITHOUT JAVASCRIPT ───────────────────────────────────────────
 *
 * Without scripting the island never mounts, so the button would open an empty
 * panel and the body stay hidden below the breakpoint: the navigation would be
 * unreachable on a phone. A `<noscript>` rule restores the pre-drawer shape for
 * exactly that reader — the body back in the layout, the button gone — and costs a
 * scripting reader nothing, since a browser running scripts parses `<noscript>`
 * as inert text. Hiding the body only once the island has mounted would serve
 * the same reader, at the price of every phone visitor watching the navigation
 * paint and then vanish on each page load.
 */
const NO_SCRIPT_FALLBACK_CSS =
  '[data-sidebar-drawer-body]{display:contents}[data-sidebar-drawer-trigger]{display:none}'

/**
 * The native invoker attributes pointing a button at the panel: React types
 * neither `commandfor` nor `command`, so they are spread as plain attributes.
 */
const invoker = (
  panelId: string,
  command: 'show-modal' | 'close'
): Readonly<Record<string, string>> => ({ commandfor: panelId, command })

/**
 * The `<dialog>` the navigation is lifted into: a header holding its close
 * button, then the empty node the island moves the navigation into and back.
 */
function DrawerPanel({
  id,
  label,
  closeLabel,
  className,
}: {
  readonly id: string
  readonly label: string
  readonly closeLabel: string
  readonly className: string | undefined
}): ReactElement {
  return (
    <dialog
      id={id}
      aria-label={label}
      data-sidebar-drawer-panel=""
      className={
        className === undefined
          ? computeSidebarDrawerPanelClasses()
          : cn(computeSidebarDrawerPanelClasses(), className)
      }
    >
      <div
        data-slot="sheet-header"
        className={computeSidebarDrawerHeaderClasses()}
      >
        <button
          type="button"
          data-slot="button"
          data-sidebar-drawer-close=""
          {...invoker(id, 'close')}
          aria-label={closeLabel}
          className={computePartButtonClasses({ variant: 'ghost', size: 'icon-sm' })}
        >
          <OverlayCloseGlyph />
        </button>
      </div>
      <div
        data-sidebar-drawer-content=""
        className={computeSidebarDrawerContentClasses()}
      />
    </dialog>
  )
}

export function SidebarDrawerFrame({
  below,
  label,
  closeLabel,
  children,
  triggerClassName,
  triggerStyle,
  panelClassName,
}: SidebarDrawerFrameProps): ReactElement {
  // `useId` spells a string that is not a valid CSS identifier in every React
  // version; the id only has to be unique and stable, so it keeps the safe part.
  const id = `sidebar-drawer${useId().replace(/[^A-Za-z0-9_-]/g, '-')}`
  const MenuIcon = resolveLucideIcon('panel-left')
  return (
    <>
      <span
        data-island="sidebar-drawer"
        data-island-props="{}"
        data-component-type="sheet"
      />
      <button
        type="button"
        {...invoker(id, 'show-modal')}
        data-component-type="button"
        data-slot="sidebar-trigger"
        data-sidebar-drawer-trigger=""
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-controls={id}
        className={cn(computeSidebarDrawerTriggerClasses(below), triggerClassName)}
        style={triggerStyle}
      >
        {MenuIcon !== undefined && (
          <MenuIcon
            aria-hidden="true"
            data-icon="inline-start"
            className="rtl:rotate-180"
            size={16}
            strokeWidth={2}
          />
        )}
        <span>{label}</span>
      </button>
      <DrawerPanel
        id={id}
        label={label}
        closeLabel={closeLabel}
        className={panelClassName}
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
