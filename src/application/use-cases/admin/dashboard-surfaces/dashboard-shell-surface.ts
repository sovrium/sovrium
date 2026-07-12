/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { ADMIN_HOME_PATH, brandLabel } from '@/domain/utils/admin-data-nav'
import type { Component } from '@/domain/models/app/pages/components'

export interface ShellBreadcrumbItem {
  readonly label: string
  readonly href?: string
}

export function homeCrumb(appName: string | undefined): ShellBreadcrumbItem {
  return { label: brandLabel(appName), href: ADMIN_HOME_PATH }
}

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
        content: 'Chargement de la navigation…',
      },
    ],
  } as unknown as Component
}

function commandPaletteHost(): Component {
  return {
    type: 'command-palette',
    props: { adminSearch: true },
  } as unknown as Component
}

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

function burgerToggle(): Component {
  return {
    type: 'button',
    props: {
      type: 'button',
      'aria-label': 'Ouvrir le menu',
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

export interface ShellOptions {
  readonly canEdit: boolean
  readonly appName?: string
  readonly appVersion?: string
  readonly breadcrumb: ReadonlyArray<ShellBreadcrumbItem>
  readonly publishedSnapshot: Readonly<Record<string, unknown>>
}

export function wrapInShell(
  body: ReadonlyArray<Component>,
  options: ShellOptions
): ReadonlyArray<Component> {
  const { canEdit, appName, appVersion, breadcrumb, publishedSnapshot } = options
  return [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex min-h-screen bg-background text-foreground' },
      children: [
        sidebar({ canEdit, appName, appVersion, publishedSnapshot, collapsed: true }),
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
        commandPaletteHost(),
        spaNavHost(),
      ],
    } as unknown as Component,
  ]
}
