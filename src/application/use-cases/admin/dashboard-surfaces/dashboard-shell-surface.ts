/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared dashboard SHELL chrome.
 *
 * The dashboard is a pure operational DATA console (config code-only, [internal ref]).
 * Every Data surface renders INSIDE the same persistent shell: the Data-nav
 * `admin-sidebar`, a top chrome bar with a breadcrumb (`navigation`
 * "Breadcrumb"), and the ⌘K command palette host.
 *
 * The home shell composes its own welcome body inside this frame; the Data
 * surfaces wrap their body components with {@link wrapInShell} so the shell
 * chrome persists around them rather than rendering as a bare standalone page.
 */

import { ADMIN_HOME_PATH, brandLabel } from '@/domain/utils/admin-data-nav'
import type { Component } from '@/domain/models/app/pages/components'

/** A breadcrumb item: a label with an optional link target. */
export interface ShellBreadcrumbItem {
  readonly label: string
  readonly href?: string
}

/**
 * The home breadcrumb crumb every dashboard surface anchors under: the
 * administered app's brand name (title-cased from its slug, matching the sidebar
 * brand label) linking to the dashboard home `/_admin`. Replaces the former
 * fixed `Console` crumb — the app name reads as a more honest "you are
 * administering THIS app" anchor, and stays clickable so deep pages remain
 * navigable back to home.
 */
export function homeCrumb(appName: string | undefined): ShellBreadcrumbItem {
  return { label: brandLabel(appName), href: ADMIN_HOME_PATH }
}

/**
 * Sidebar host: a `data-island="admin-sidebar"` marker the island hydrates into.
 * The Data-only sidebar is navigation-only, so the host props are inert beyond
 * the brand `appName`; they are retained for shell-host signature compatibility.
 */
/** The `admin-sidebar` island host props (serialized into `data-island-props`). */
interface SidebarHostProps {
  readonly canEdit: boolean
  readonly appName: string | undefined
  readonly appVersion: string | undefined
  readonly publishedSnapshot: Readonly<Record<string, unknown>>
  readonly collapsed: boolean
}

function sidebar(props: SidebarHostProps): Component {
  return {
    type: 'container',
    element: 'aside',
    props: {
      // Responsive posture: at desktop (md) the
      // sidebar is a static left column; at mobile it is `hidden` and revealed as
      // a fixed drawer when the burger toggle sets `data-mobile-open` (the inline
      // `SidebarDrawerToggle` script flips the classes). `data-dashboard-aside`
      // is the toggle script's hook.
      className:
        'hidden md:flex w-64 shrink-0 border-r border-border bg-background-raised p-4 flex-col gap-6 overflow-y-auto',
      'data-dashboard-aside': 'true',
      'data-island': 'admin-sidebar',
      'data-island-props': JSON.stringify(props),
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle text-xs' },
        content: 'Loading navigation…',
      },
    ],
  } as unknown as Component
}

/**
 * The ⌘K command-palette host.
 *
 * Consoles-as-Config (batch C3): the shell now expresses its ⌘K palette through
 * the config-native `command-palette` component (admin mode) rather than a
 * bespoke island host. The component emits the canonical
 * `data-command-palette-config` marker AND hosts the `admin-search-palette`
 * island that provides the admin cross-entity search affordance
 * (`/api/admin/search`, grouped results, French operator microcopy). Present in
 * the shell on EVERY surface so `⌘K` opens the palette anywhere; the island
 * renders null until opened, so the host is an invisible enhancement marker.
 */
function commandPaletteHost(): Component {
  return {
    type: 'command-palette',
    props: { adminSearch: true },
  } as unknown as Component
}

/**
 * The SPA client-nav host: a
 * `data-island="admin-spa-nav"` marker the nav island hydrates into. Present on
 * EVERY surface, kept OUTSIDE the `#admin-surface-content` swap region so the
 * global click interceptor + popstate handler stay mounted across content swaps.
 * The island renders nothing (it only wires document-level listeners), so the
 * host is an invisible enhancement marker.
 */
function spaNavHost(): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      className: 'hidden',
      'data-island': 'admin-spa-nav',
      'data-island-props': JSON.stringify({}),
    },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'sr-only' },
        content: '',
      },
    ],
  } as unknown as Component
}

/**
 * The mobile burger toggle: shown only at mobile
 * (`md:hidden`); the inline `SidebarDrawerToggle` script reveals the sidebar
 * drawer on click. `data-dashboard-burger` is the script's hook.
 */
function burgerToggle(): Component {
  return {
    type: 'button',
    props: {
      type: 'button',
      'aria-label': 'Open menu',
      'data-dashboard-burger': 'true',
      className:
        'md:hidden inline-flex items-center justify-center rounded-md border border-border p-2 text-foreground-subtle hover:text-foreground',
    },
    content: '☰',
  } as unknown as Component
}

function chrome(breadcrumb: ReadonlyArray<ShellBreadcrumbItem>): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-4' },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex items-center gap-3' },
        children: [burgerToggle(), { type: 'breadcrumb', breadcrumbItems: breadcrumb }],
      },
    ],
  } as unknown as Component
}

/** Options for composing the persistent dashboard shell around a body. */
export interface ShellOptions {
  /**
   * Retained for shell-host signature compatibility; inert in the Data-only
   * console (there is no config editing to gate).
   */
  readonly canEdit: boolean
  /** Operator app name (slug); seeds the sidebar brand label. */
  readonly appName?: string
  /**
   * The administered app's config version (`app.version`); shown in the sidebar
   * brand header in place of the old fixed `dev` chip. When the operator app
   * declares no version, the sidebar island falls back to the running Sovrium
   * build version (fetched from `GET /api/admin/config/version`).
   */
  readonly appVersion?: string
  /** Breadcrumb trail for the top chrome bar. */
  readonly breadcrumb: ReadonlyArray<ShellBreadcrumbItem>
  /**
   * Retained for shell-host signature compatibility; inert in the Data-only
   * console (the navigation-only sidebar renders no config count badges).
   */
  readonly publishedSnapshot: Readonly<Record<string, unknown>>
}

/**
 * Wrap a surface's body components in the persistent Data-console shell.
 *
 * Returns a single root `container` mirroring the home shell layout: the
 * Data-nav `admin-sidebar` island on the left, and a content column on the right
 * holding the top chrome bar (breadcrumb) followed by the supplied `body`. Used
 * by the per-domain Data surfaces so the shell persists around them.
 *
 * @param body - the surface's content components (rendered in the content column)
 * @param options - the shell concerns (breadcrumb; appName for the brand label)
 */
export function wrapInShell(
  body: ReadonlyArray<Component>,
  options: ShellOptions
): ReadonlyArray<Component> {
  const { canEdit, appName, appVersion, breadcrumb, publishedSnapshot } = options
  // The sidebar is ALWAYS collapsed (navigation-only) on EVERY surface, home
  // included: it is pure Data navigation.
  return [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex min-h-screen bg-background text-foreground' },
      children: [
        sidebar({ canEdit, appName, appVersion, publishedSnapshot, collapsed: true }),
        // Content column. The page renderer wraps every page in a single
        // `<main id="main-content">` (PageMain), so this uses a plain `div`
        // — a second `element: main` would duplicate the `main` landmark.
        //
        // `id="admin-surface-content"` is the stable swap target for SPA
        // content-only navigation ([internal ref] SPA): the client nav
        // module fetches a surface's partial HTML and replaces ONLY this column's
        // contents, leaving the sidebar + ⌘K host (which live OUTSIDE this region)
        // mounted. The chrome breadcrumb lives inside the region so it repaints
        // with the surface; the persistent sidebar + palette do not.
        {
          type: 'container',
          element: 'div',
          props: {
            id: 'admin-surface-content',
            'data-admin-content': 'true',
            className: 'flex flex-1 flex-col gap-6 p-8 overflow-y-auto',
          },
          children: [chrome(breadcrumb), ...body],
        },
        // ⌘K command-palette host — a SHELL-level enhancement marker, kept OUTSIDE
        // the swap region (`#admin-surface-content`) so it stays mounted across
        // SPA content swaps and `⌘K` keeps working on every surface. It is
        // `display: none` and portals its dialog to `document.body`, so its
        // position here has no layout effect.
        commandPaletteHost(),
        // SPA client-nav host — also kept OUTSIDE the swap region so its global
        // click interceptor + popstate handler survive content swaps. Renders
        // nothing; wires document-level navigation listeners.
        spaNavHost(),
      ],
    } as unknown as Component,
  ]
}
