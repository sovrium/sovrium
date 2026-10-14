/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/console-shell@0.37.0#7487564a20d0

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
// toggle's testid. Two bindings are left EMPTY here and filled by `withShell`
// (`./shell.ts`): the sidebar's `groups` (`./sidebar-nav.ts`) and the body
// slot after the header, which is each page's own content.
//
// Hrefs are mount-relative: `prefixMountHrefs` moves `/` and `/profile` onto
// the console's base at boot.

export const consoleShellCopy = {
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
                  'flex aspect-square size-8 flex-none items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground',
                'aria-hidden': 'true',
              },
              children: [
                {
                  type: 'icon',
                  props: {
                    name: 'layout-dashboard',
                    size: 16,
                  },
                },
              ],
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
              separator: true,
            },
            {
              label: '$t:admin.shell.giveFeedback',
              icon: 'message-square',
              action: {
                type: 'navigate',
                path: 'https://github.com/sovrium/sovrium/issues/new?labels=feedback',
              },
            },
            {
              label: '$t:admin.shell.reportBug',
              icon: 'bug',
              action: {
                type: 'navigate',
                path: 'https://github.com/sovrium/sovrium/issues/new?labels=bug',
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
                className: 'flex min-w-0 flex-1 flex-col gap-0.5 leading-none',
              },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  props: {
                    className: 'truncate font-medium',
                    'data-testid': 'operator-name',
                  },
                  session: 'name',
                },
                {
                  type: 'text',
                  element: 'span',
                  props: {
                    className: 'truncate text-xs',
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
                className: 'ml-auto',
              },
            },
          ],
        },
      ],
      groups: [],
      trigger: {
        label: '$t:admin.shell.toggleSidebar',
      },
      railHandle: true,
      trackNavigation: true,
      props: {
        'data-testid': 'admin-sidebar',
      },
    },
    {
      type: 'container',
      element: 'div',
      props: {
        className: 'flex min-w-0 flex-1 flex-col overflow-y-auto bg-background',
        id: 'admin-surface-content',
        'data-admin-content': 'true',
      },
      children: [
        {
          type: 'container',
          element: 'header',
          props: {
            className:
              'sticky top-0 z-10 flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background pr-4 pl-11',
            'data-testid': 'design-system-topbar',
          },
          children: [
            {
              type: 'breadcrumb',
              separator: '›',
              props: {
                className:
                  'min-w-0 flex-1 overflow-hidden [&_ol]:min-w-0 [&_ol]:flex-nowrap [&_li]:shrink-0 [&_li:first-child]:min-w-0 [&_li:first-child]:shrink [&_li:first-child>*]:block [&_li:first-child>*]:truncate',
                'data-testid': 'breadcrumb',
              },
              derive: 'path',
              home: {
                label: '$app.label',
              },
            },
            {
              type: 'container',
              props: {
                className: 'ml-auto flex items-center gap-2',
                'data-testid': 'chrome-end',
              },
              children: [
                {
                  type: 'button',
                  variant: 'outline',
                  props: {
                    type: 'button',
                    'aria-label': '$t:admin.shell.search',
                    'data-command-palette-trigger': 'true',
                    className:
                      'relative h-8 w-full justify-start gap-2 rounded-md px-2 text-sm font-normal text-muted-foreground shadow-none sm:w-56',
                  },
                  children: [
                    {
                      type: 'icon',
                      props: {
                        name: 'search',
                        size: 16,
                      },
                    },
                    {
                      type: 'text',
                      element: 'span',
                      props: {
                        className: 'flex-1 text-left',
                      },
                      content: '$t:admin.shell.searchPlaceholder',
                    },
                  ],
                },
                {
                  type: 'theme-toggle',
                  variant: 'icon',
                  props: {
                    'data-testid': 'admin-scheme-toggle',
                  },
                },
              ],
            },
          ],
        },
        {
          type: 'container',
          element: 'div',
          children: [],
        },
      ],
    },
  ],
} as const
