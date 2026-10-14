/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Fragment, type ReactElement } from 'react'
import { LucideGlyph } from '@/presentation/design/lucide-glyph'
import { SIDEBAR_SHELL_READY_MARK } from '@/presentation/design/runtime-ready-marks'
import {
  computeSidebarRailHandleClasses,
  computeSidebarTriggerClasses,
} from '@/presentation/design/sidebar-shell-classes'
import { resolveLucideIconNode } from '../elements/lucide-resolver'

/** The cookie a folded sidebar is remembered in, read by the server: shadcn/ui's name. */
export const SIDEBAR_STATE_COOKIE = 'sidebar_state'

/** The shell keys of a sidebar, as the renderer reads them. */
export interface SidebarShellKeys {
  readonly collapsible?: 'none' | 'icon' | 'offcanvas'
  readonly trigger?: { readonly label: string; readonly shortcut?: boolean }
  readonly side?: 'left' | 'right'
  readonly variant?: 'sidebar' | 'floating' | 'inset'
  readonly railHandle?: boolean
  readonly persist?: 'cookie' | 'none'
  /** Stamped by the server from the state cookie: the sidebar is served folded. */
  readonly _collapsed?: boolean
}

/** Whether the sidebar folds at all. */
export const foldsOf = (keys: SidebarShellKeys): 'icon' | 'offcanvas' | undefined =>
  keys.collapsible === 'icon' || keys.collapsible === 'offcanvas' ? keys.collapsible : undefined

/**
 * Whether the sidebar is a SHELL: it folds, stands on the right, or is framed
 * as a panel, so it is laid out beside the content written next to it.
 */
export const isShell = (keys: SidebarShellKeys): boolean =>
  foldsOf(keys) !== undefined ||
  keys.side === 'right' ||
  (keys.variant !== undefined && keys.variant !== 'sidebar')

/** The runtime's switches: what the box folds to, whether the shortcut and the cookie apply. */
function foldSwitches(keys: SidebarShellKeys): Record<string, string> {
  const folds = foldsOf(keys)
  if (folds === undefined) return {}
  return {
    'data-sidebar-folds': folds,
    ...(keys.trigger?.shortcut === false ? {} : { 'data-sidebar-shortcut': '' }),
    ...(keys.persist === 'none' ? {} : { 'data-sidebar-persist': '' }),
  }
}

/** The `data-*` the box carries: shadcn/ui's state, fold, frame and side, and the runtime's switches. */
export function sidebarShellAttributes(keys: SidebarShellKeys): Record<string, string> {
  const folds = foldsOf(keys)
  const collapsed = folds !== undefined && keys._collapsed === true
  return {
    'data-state': collapsed ? 'collapsed' : 'expanded',
    'data-variant': keys.variant ?? 'sidebar',
    'data-side': keys.side ?? 'left',
    ...(collapsed ? { 'data-collapsible': folds } : {}),
    ...(isShell(keys) ? { 'data-sidebar-shell': '' } : {}),
    ...foldSwitches(keys),
  }
}

/** lucide `panel-left`, the trigger's glyph. */
const PANEL_ICON = resolveLucideIconNode('panel-left')

/** shadcn/ui `SidebarTrigger`: the button that folds and unfolds the sidebar. */
export const renderSidebarTrigger = (
  label: string,
  expanded: boolean,
  extraClasses = ''
): ReactElement => (
  <button
    key="sidebar-trigger"
    type="button"
    data-sidebar="trigger"
    data-slot="sidebar-trigger"
    aria-label={label}
    aria-expanded={expanded}
    className={`${computeSidebarTriggerClasses()} ${extraClasses}`.trim()}
  >
    <LucideGlyph
      iconNode={PANEL_ICON}
      name="panel-left"
      aria-hidden="true"
    />
  </button>
)

/**
 * shadcn/ui `SidebarRail`: the handle along the inner edge, out of the tab
 * order like shadcn's. A pointer affordance duplicating the trigger, so it is
 * hidden from assistive technology rather than announced as a second control
 * of the same name; its title still names it under the pointer.
 */
export const renderSidebarRailHandle = (label: string, extraClasses = ''): ReactElement => (
  <button
    key="sidebar-rail"
    type="button"
    data-sidebar="rail"
    data-slot="sidebar-rail"
    aria-hidden="true"
    title={label}
    tabIndex={-1}
    className={`${computeSidebarRailHandleClasses()} ${extraClasses}`.trim()}
  />
)

/**
 * The fold runtime: the trigger, the rail and Control or Command with B flip
 * the sidebar's `data-state` and `data-collapsible`, and a persisting sidebar
 * writes the state cookie the server reads. Bound once per document.
 */
const SIDEBAR_SHELL_RUNTIME = `(function () {
  var root = document.documentElement
  if (root.getAttribute('${SIDEBAR_SHELL_READY_MARK}') === 'true') return
  root.setAttribute('${SIDEBAR_SHELL_READY_MARK}', 'true')
  function toggle(box) {
    var folds = box.getAttribute('data-sidebar-folds')
    if (!folds) return
    var collapse = box.getAttribute('data-state') !== 'collapsed'
    box.setAttribute('data-state', collapse ? 'collapsed' : 'expanded')
    if (collapse) box.setAttribute('data-collapsible', folds)
    else box.removeAttribute('data-collapsible')
    box.querySelectorAll('[data-sidebar="trigger"]').forEach(function (trigger) {
      trigger.setAttribute('aria-expanded', collapse ? 'false' : 'true')
    })
    if (box.hasAttribute('data-sidebar-persist')) {
      document.cookie = '${SIDEBAR_STATE_COOKIE}=' + (collapse ? 'false' : 'true') + '; path=/; max-age=604800; samesite=lax'
    }
  }
  document.addEventListener('click', function (event) {
    var control = event.target && event.target.closest && event.target.closest('[data-sidebar="trigger"], [data-sidebar="rail"]')
    if (!control) return
    var box = control.closest('[data-sidebar-folds]')
    if (box) toggle(box)
  })
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'b' && event.key !== 'B') return
    if (!(event.metaKey || event.ctrlKey)) return
    var boxes = document.querySelectorAll('[data-sidebar-folds][data-sidebar-shortcut]')
    if (boxes.length === 0) return
    event.preventDefault()
    boxes.forEach(toggle)
  })
})()`

/** The fold runtime's script element. */
export const renderSidebarShellRuntime = (): ReactElement => (
  <Fragment key="sidebar-shell-runtime">
    {/* eslint-disable-next-line sovrium/require-sanitized-html -- engine-authored runtime script constant; no config or record value is interpolated into it */}
    <script dangerouslySetInnerHTML={{ __html: SIDEBAR_SHELL_RUNTIME }} />
  </Fragment>
)

/** A named icon control that goes where it says: shadcn/ui's SidebarGroupAction / SidebarMenuAction. */
export const renderSidebarAction = (
  action: { readonly icon: string; readonly label: string; readonly href: string },
  slot: 'sidebar-group-action' | 'sidebar-menu-action',
  className: string
): ReactElement => (
  <a
    key={slot}
    href={action.href}
    aria-label={action.label}
    data-slot={slot}
    className={className}
  >
    <LucideGlyph
      iconNode={resolveLucideIconNode(action.icon)}
      name={action.icon}
      aria-hidden="true"
    />
  </a>
)
