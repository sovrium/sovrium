/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/console-shell@0.37.0#c9216eb18438
// sovrium-library: block/command@0.37.0#11d80c9163ba

// The operator console shell: the sidebar, the sticky header, the command palette and the
// two hidden hosts, placed once by every console page. The page passes its breadcrumb trail
// (and any topbar fact) to the `trail` slot, its body to `$children`, and the body frame's
// class (`bodyClass`), which is the one thing the page kinds draw differently.
//
// TRANSPARENT: it draws exactly what the same tree drew written inline, attribute for
// attribute, and it is not listed on the Design System pages.

// ── From components/console-shell.ts (the installed block copy) ────────────────
// The console's frame, INSTALLED from the library's `console-shell` block —
// shadcn's sidebar-07 (a sidebar that collapses to icons, the account at its
// foot) with sidebar-16's sticky site header across the content column. It is a
// copy, not an import: the console may not import `src/library/**`, and the
// embedded preset would otherwise freeze library code into every binary's
// console config. `Console Block Parity` holds this literal to the block with
// the bindings dropped; when the block moves, re-install it with
// `sovrium library add block/console-shell --update` and re-register the copy —
// never hand-edit the structure below.
//
// ─── THE BINDINGS ───────────────────────────────────────────────────────────
//
// What this copy fills in, and nothing else: the phone menu's and the fold
// control's names, the sidebar's `trackNavigation` (the SPA swap does not
// re-render the sidebar, so the current row is re-derived on the client) and its
// testid, the identity row (the app, its release, the engine), the operator
// menu (the session's name, email and picture, the console's own items), the
// content column's `id` — `#admin-surface-content` is the SPA nav's swap
// target — the derived breadcrumb, the search control's copy and the scheme
// toggle's testid. The operator's role badges and the read-only notice are
// the block's optional `roleLabel`, `readOnlyRoleLabel` and `readOnlyNotice`.
// Both role badges read `$session.roleLabel` — the caller's role as the app
// calls it, in their language — so an `admin-viewer` reads "Admin (read-only)"
// and an app's own read-only role reads its declared label, never the word of
// another role; the capability gate now only picks the badge's tone. The notice
// is a copy key whose translation names the same session field. Two bindings are left EMPTY here and filled by `withShell`
// (`./shell.ts`): the sidebar's `groups` (`./sidebar-nav.ts`) and the body
// slot after the header, which is each page's own content.
//
// Hrefs are mount-relative: `prefixMountHrefs` moves `/` and `/profile` onto
// the console's base the first time the console is opened.
// ── The sidebar's navigation ───────────────────────────────────────────────────
// Overview, then seven groups named for what the operator does: Activity,
// Data, Audience, People & access, Instance, Developers and Design. Every
// group is open, so each page is one click away; a row with a `source` lists
// its entries (tables, buckets, forms, agents) under it. The SPA nav swaps
// only `#admin-surface-content`, so the sidebar is not re-rendered on an
// in-console navigation and `trackNavigation` re-derives the current row on
// the client. `admin-spa-nav` and the palette sit OUTSIDE that frame, so a swap
// never unmounts them.
// ── The ⌘K palette ──────────────────────────────────────────────────────────────
// INSTALLED from the library's `command` block; its bindings are `search`
// (cross-entity search over `/api/admin/search`) and `groups` (the one
// authored row below). Declared rather than inherited: `app.ts` turns the
// generic record palette off, since two palettes on one ⌘K open two overlays.
// `kindLabels` is absent on purpose — the engine names each kind the search
// returns, and a third copy of that vocabulary could drift silently. It draws
// no markup until the first ⌘K, and stays outside the SPA swap region so the
// listener survives a navigation.
//
// « Ask about this app » takes the words typed so far (`$query`) to the
// Overview's assistant, unsent. Its group carries the composer's own gate — a
// model to answer and a caller allowed to act — so a read-only operator's page
// never carries the row.

import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Template = NonNullable<AppConfig['components']>[number]

// eslint-disable-next-line sovrium/no-double-assertion -- a template that declares inputs writes `$name` where the component type expects a list or an object; each placement is decoded as the page component it produces when the app starts
export const consoleShell = {
  name: 'console-shell',
  type: 'container',
  render: 'transparent',
  inputs: {
    bodyClass: {
      kind: 'text',
      required: true,
    },
    trail: {
      kind: 'slot',
    },
  },
  element: 'div',
  props: {
    'data-admin-base-path': '/',
    className: 'contents',
  },
  children: [
    {
      type: 'flex',
      props: {
        className: 'flex h-svh w-full flex-col items-stretch overflow-hidden md:flex-row',
      },
      children: [
        {
          type: 'sidebar',
          drawer: {
            below: 'md',
            label: '$t:admin.shell.openMenu',
          },
          collapsible: 'icon',
          header: [
            {
              type: 'link',
              props: {
                href: '/',
                className:
                  'flex h-12 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm text-sidebar-foreground no-underline ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline focus-visible:ring-2 group-data-[collapsible=icon]/sidebar:size-8! group-data-[collapsible=icon]/sidebar:p-0! [&_svg]:size-4 [&_svg]:shrink-0',
                'aria-label': '$t:admin.shell.home',
              },
              children: [
                {
                  type: 'container',
                  props: {
                    className:
                      'flex aspect-square size-8 flex-none items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground data-[app-mark=logo]:bg-transparent',
                    'data-app-mark': 'tile',
                  },
                },
                {
                  type: 'flex',
                  props: {
                    className: 'flex min-w-0 flex-1 flex-col gap-0.5 leading-none',
                  },
                  children: [
                    {
                      type: 'flex',
                      props: {
                        className: 'flex min-w-0 items-center gap-1.5',
                      },
                      children: [
                        {
                          type: 'text',
                          element: 'span',
                          props: {
                            className: 'truncate font-medium',
                          },
                          content: '$app.label',
                        },
                        {
                          type: 'text',
                          element: 'span',
                          props: {
                            className:
                              "shrink-0 rounded-sm bg-sidebar-accent px-1 font-mono text-[10px] leading-4 text-sidebar-foreground/70 before:content-['v'] empty:hidden!",
                            'data-testid': 'sidebar-version',
                          },
                          content: '$app.version',
                        },
                      ],
                    },
                    {
                      type: 'text',
                      element: 'span',
                      props: {
                        className: 'truncate text-xs text-sidebar-foreground/70',
                        'data-testid': 'sidebar-engine',
                      },
                      content: 'Sovrium v$app.engineVersion',
                    },
                  ],
                },
              ],
            },
          ],
          footer: [
            {
              type: 'dropdown-menu',
              triggerLabel: '$t:admin.shell.account',
              props: {
                className:
                  'flex h-12 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm text-sidebar-foreground no-underline ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline focus-visible:ring-2 aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground group-data-[collapsible=icon]/sidebar:size-8! group-data-[collapsible=icon]/sidebar:p-0! [&_svg]:size-4 [&_svg]:shrink-0 [&>svg]:hidden',
                'data-testid': 'operator-menu',
              },
              menuItems: [
                {
                  label: '$t:admin.shell.myAccount',
                  icon: 'badge-check',
                  action: {
                    type: 'navigate',
                    path: '/profile',
                  },
                },
                {
                  label: '$t:admin.shell.myData',
                  icon: 'download',
                  action: {
                    type: 'navigate',
                    path: '/gdpr',
                  },
                },
                {
                  separator: true,
                },
                {
                  label: '$t:admin.shell.openApp',
                  icon: 'external-link',
                  action: {
                    type: 'navigate',
                    path: '$app.origin/',
                    openInNewTab: true,
                  },
                },
                {
                  label: '$t:admin.shell.shortcuts',
                  icon: 'keyboard',
                  action: {
                    action: 'openDialog',
                    component: 'admin-shortcuts-dialog',
                  },
                },
                {
                  label: '$t:admin.shell.theme',
                  heading: true,
                },
                {
                  label: '$t:admin.shell.theme.light',
                  action: {
                    type: 'theme',
                    value: 'light',
                  },
                },
                {
                  label: '$t:admin.shell.theme.dark',
                  action: {
                    type: 'theme',
                    value: 'dark',
                  },
                },
                {
                  label: '$t:admin.shell.theme.system',
                  action: {
                    type: 'theme',
                    value: 'system',
                  },
                },
                {
                  separator: true,
                },
                {
                  label: '$t:admin.shell.signOut',
                  icon: 'log-out',
                  variant: 'destructive',
                  action: {
                    type: 'auth',
                    method: 'logout',
                    onSuccess: {
                      navigate: '/login',
                    },
                  },
                },
              ],
              children: [
                {
                  type: 'avatar',
                  label: '$session.name',
                  size: 'default',
                  shape: 'square',
                  src: '$session.image',
                  props: {
                    'data-testid': 'operator-avatar',
                  },
                },
                {
                  type: 'flex',
                  props: {
                    className: 'grid min-w-0 flex-1 gap-0.5 text-left text-sm leading-tight',
                  },
                  children: [
                    {
                      type: 'flex',
                      props: {
                        className: 'flex min-w-0 items-center gap-1.5',
                      },
                      children: [
                        {
                          type: 'text',
                          element: 'span',
                          props: {
                            className: 'min-w-0 truncate font-medium',
                            'data-testid': 'operator-name',
                          },
                          session: 'name',
                        },
                        {
                          type: 'badge',
                          badgeVariant: 'secondary',
                          props: {
                            className: 'h-4 max-w-[60%] shrink truncate px-1.5 text-[10px]',
                          },
                          visibility: {
                            capability: 'edit-operations',
                          },
                          content: '$session.roleLabel',
                        },
                        {
                          type: 'badge',
                          badgeVariant: 'outline',
                          props: {
                            className: 'h-4 max-w-[60%] shrink truncate px-1.5 text-[10px]',
                          },
                          visibility: {
                            unlessCapability: 'edit-operations',
                          },
                          content: '$session.roleLabel',
                        },
                      ],
                    },
                    {
                      type: 'text',
                      element: 'span',
                      props: {
                        className: 'truncate text-xs text-sidebar-foreground/70',
                        'data-testid': 'operator-email',
                      },
                      session: 'email',
                    },
                  ],
                },
                {
                  type: 'icon',
                  props: {
                    name: 'chevrons-up-down',
                    size: 16,
                    className: 'ml-auto shrink-0 group-data-[collapsible=icon]/sidebar:hidden',
                  },
                },
              ],
            },
          ],
          groups: [
            {
              items: [
                {
                  label: '$t:admin.nav.overview',
                  href: '/',
                  icon: 'house',
                  activeMatch: 'exact',
                  props: {
                    'data-testid': 'data-nav-overview',
                  },
                },
              ],
            },
            {
              label: '$t:admin.nav.group.activity',
              landmark: '$t:admin.nav.landmark.console',
              headingLevel: 2,
              items: [
                {
                  label: '$t:admin.crumb.runs',
                  href: '/runs',
                  icon: 'zap',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-runs',
                  },
                  badge: {
                    endpoint: '/api/admin/attention',
                    valuePath: 'failedRuns',
                    variant: 'destructive',
                  },
                },
                {
                  label: '$t:admin.crumb.submissions',
                  href: '/submissions',
                  icon: 'clipboard-list',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-submissions',
                  },
                  childrenProps: {
                    'data-testid': 'submissions-nav-children',
                  },
                  source: {
                    endpoint: '/api/admin/forms',
                    rowsKey: 'items',
                    labelKey: 'label',
                    hrefTemplate: '/submissions/{name}',
                    itemProps: {
                      'data-testid': 'data-nav-submissions-{name}',
                    },
                  },
                },
                {
                  label: '$t:admin.crumb.conversations',
                  href: '/conversations',
                  icon: 'message-square',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-conversations',
                  },
                  childrenProps: {
                    'data-testid': 'conversations-nav-children',
                  },
                  source: {
                    endpoint: '/api/admin/agents',
                    rowsKey: 'items',
                    labelKey: 'label',
                    hrefTemplate: '/conversations/{name}',
                    itemProps: {
                      'data-testid': 'data-nav-conversations-{name}',
                    },
                  },
                },
              ],
            },
            {
              label: '$t:admin.nav.group.data',
              landmark: '$t:admin.nav.landmark.console',
              headingLevel: 2,
              items: [
                {
                  label: '$t:admin.crumb.records',
                  href: '/records',
                  icon: 'table',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-records',
                  },
                  childrenProps: {
                    'data-testid': 'records-nav-children',
                  },
                  source: {
                    endpoint: '/api/admin/tables/overview',
                    rowsKey: 'by_table',
                    labelKey: 'label',
                    hrefTemplate: '/records/{name}',
                    itemProps: {
                      'data-testid': 'data-nav-records-{name}',
                    },
                  },
                },
                {
                  label: '$t:admin.crumb.files',
                  href: '/files',
                  icon: 'folder',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-files',
                  },
                  childrenProps: {
                    'data-testid': 'files-nav-children',
                  },
                  source: {
                    endpoint: '/api/admin/buckets',
                    rowsKey: 'items',
                    labelKey: 'label',
                    hrefTemplate: '/files/{name}',
                    itemProps: {
                      'data-testid': 'data-nav-files-{name}',
                    },
                  },
                },
                {
                  label: '$t:admin.crumb.connections',
                  href: '/connections',
                  icon: 'plug',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-connections',
                  },
                  badge: {
                    endpoint: '/api/admin/attention',
                    valuePath: 'tokensExpired',
                    variant: 'destructive',
                  },
                },
              ],
            },
            {
              label: '$t:admin.nav.group.audience',
              landmark: '$t:admin.nav.landmark.console',
              headingLevel: 2,
              items: [
                {
                  label: '$t:admin.crumb.analytics',
                  href: '/analytics',
                  icon: 'chart-column',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-analytics',
                  },
                  capability: 'administer-accounts',
                },
                {
                  label: '$t:admin.crumb.links',
                  href: '/links',
                  icon: 'link',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-links',
                  },
                },
                {
                  label: '$t:admin.crumb.templates',
                  href: '/templates',
                  icon: 'file-text',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-templates',
                  },
                },
              ],
            },
            {
              label: '$t:admin.nav.group.people',
              landmark: '$t:admin.nav.landmark.console',
              headingLevel: 2,
              items: [
                {
                  label: '$t:admin.crumb.users',
                  href: '/users',
                  icon: 'users',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-users',
                  },
                },
                {
                  label: '$t:admin.crumb.organisation',
                  href: '/organisation',
                  icon: 'network',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-organisation',
                  },
                },
              ],
            },
            {
              label: '$t:admin.nav.group.instance',
              landmark: '$t:admin.nav.landmark.console',
              headingLevel: 2,
              items: [
                {
                  label: '$t:admin.crumb.env',
                  href: '/env',
                  icon: 'braces',
                  props: {
                    'data-testid': 'developer-nav-env',
                  },
                  badge: {
                    endpoint: '/api/admin/attention',
                    valuePath: 'variablesUnset',
                    variant: 'destructive',
                  },
                },
                {
                  label: '$t:admin.crumb.auditLog',
                  href: '/audit-log',
                  icon: 'clipboard-list',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-audit-log',
                  },
                },
                {
                  label: '$t:admin.crumb.changelog',
                  href: '/changelog',
                  icon: 'history',
                  props: {
                    'data-testid': 'developer-nav-changelog',
                  },
                },
                {
                  label: '$t:admin.crumb.decisions',
                  href: '/decisions',
                  icon: 'scroll-text',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-decisions',
                  },
                },
              ],
            },
            {
              label: '$t:admin.nav.group.developers',
              landmark: '$t:admin.nav.landmark.console',
              headingLevel: 2,
              items: [
                {
                  label: '$t:admin.crumb.api',
                  href: '/api',
                  icon: 'code',
                  props: {
                    'data-testid': 'developer-nav-api',
                  },
                },
                {
                  label: '$t:admin.crumb.mcp',
                  href: '/mcp',
                  icon: 'bot',
                  props: {
                    'data-testid': 'developer-nav-mcp',
                  },
                },
                {
                  label: '$t:admin.crumb.apiKeys',
                  href: '/api-keys',
                  icon: 'key-round',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-api-keys',
                  },
                },
              ],
            },
            {
              label: '$t:admin.nav.group.design',
              landmark: '$t:admin.nav.landmark.console',
              headingLevel: 2,
              items: [
                {
                  label: '$t:admin.nav.design.overview',
                  href: '/design-system',
                  icon: 'palette',
                  props: {
                    'data-testid': 'data-nav-design-system-overview',
                  },
                },
                {
                  label: '$t:admin.nav.design.foundations',
                  href: '/design-system/foundations',
                  icon: 'swatch-book',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-design-system-foundations',
                  },
                },
                {
                  label: '$t:admin.nav.design.components',
                  href: '/design-system/components',
                  icon: 'component',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-design-system-components',
                  },
                  badge: {
                    endpoint: '/api/admin/design-system/usage?subject=component',
                    valuePath: 'total',
                  },
                },
                {
                  label: '$t:admin.nav.design.brand',
                  href: '/design-system/brand',
                  icon: 'stamp',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-design-system-brand',
                  },
                },
                {
                  label: '$t:admin.nav.design.voice',
                  href: '/design-system/voice',
                  icon: 'quote',
                  activeMatch: 'prefix',
                  props: {
                    'data-testid': 'data-nav-design-system-voice',
                  },
                },
              ],
            },
          ],
          trigger: {
            label: '$t:admin.shell.toggleSidebar',
          },
          railHandle: true,
          trackNavigation: true,
          props: {
            className: '[--sidebar-trigger-top:0.625rem]',
            'data-testid': 'admin-sidebar',
          },
        },
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-background',
            id: 'admin-surface-content',
            'data-admin-content': 'true',
          },
          children: [
            {
              type: 'container',
              element: 'header',
              props: {
                className:
                  '@container sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background pr-4 pl-11',
                'data-testid': 'design-system-topbar',
              },
              children: '$slots.trail',
            },
            {
              type: 'container',
              element: 'div',
              props: {
                className: '$bodyClass',
              },
              children: '$children',
            },
          ],
        },
      ],
    },
    {
      type: 'command',
      search: {
        endpoint: '/api/admin/search',
      },
      groups: [
        {
          label: '$t:admin.palette.ask.group',
          visibility: {
            runtime: 'ai',
            capability: 'edit-operations',
          },
          items: [
            {
              label: '$t:admin.palette.ask.label',
              emptyLabel: '$t:admin.palette.ask.empty',
              icon: 'message-square',
              href: '/?q=$query',
            },
          ],
        },
        {
          label: '$t:admin.palette.help.group',
          items: [{ label: '$t:admin.palette.help.report', icon: 'life-buoy', href: '/report' }],
        },
      ],
    },
    {
      type: 'container',
      element: 'div',
      props: {
        className: 'hidden',
        'data-island': 'admin-spa-nav',
        'data-island-props': '{}',
      },
      children: [
        {
          type: 'text',
          element: 'span',
          props: {
            className: 'sr-only',
          },
          content: '',
        },
      ],
    },
    {
      type: 'container',
      element: 'div',
      props: {
        className: 'hidden',
        'data-spa-offline-template': 'true',
      },
      children: [
        {
          type: 'container',
          element: 'div',
          props: {
            role: 'status',
            className:
              'border-border bg-muted text-foreground m-4 flex items-center justify-between gap-4 rounded-md border px-4 py-3 text-sm',
          },
          children: [
            {
              type: 'text',
              element: 'p',
              content: '$t:admin.offline.message',
            },
            {
              type: 'button',
              variant: 'outline',
              content: '$t:admin.offline.retry',
              props: {
                type: 'button',
                'data-spa-retry': 'true',
              },
            },
          ],
        },
      ],
    },
  ],
} as unknown as Template
