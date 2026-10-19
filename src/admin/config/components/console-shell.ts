/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/console-shell@0.37.0#2a3e313b7cdc

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
              // The app's mark: its `design.logo`, else a monogram of its
              // display name, filled in by the engine (`data-app-mark`).
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
            // shadcn's NavUser: the name over the email, then the chevron at
            // the row's end. The role rides on the name's line as a small
            // badge, so the block stays two lines; the name gives way first,
            // then the badge, and the email truncates on its own line.
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
                      props: { className: 'h-4 max-w-[60%] shrink truncate px-1.5 text-[10px]' },
                      visibility: { capability: 'edit-operations' },
                      content: '$session.roleLabel',
                    },
                    {
                      type: 'badge',
                      badgeVariant: 'outline',
                      props: { className: 'h-4 max-w-[60%] shrink truncate px-1.5 text-[10px]' },
                      visibility: { unlessCapability: 'edit-operations' },
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
      groups: [],
      trigger: {
        label: '$t:admin.shell.toggleSidebar',
      },
      railHandle: true,
      trackNavigation: true,
      props: {
        // The block's own class: the fold controls stand 10px down, on the
        // centre of the 48px site header.
        className: '[--sidebar-trigger-top:0.625rem]',
        'data-testid': 'admin-sidebar',
      },
    },
    {
      type: 'container',
      element: 'div',
      props: {
        // The console's ONE scroll region. `relative` makes it the containing
        // block of every absolutely positioned descendant — an `sr-only`
        // label above all — so none of them resolves against the document and
        // lengthens the window behind the column, which read as a second
        // scroll running far past the page's end.
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
          children: [
            {
              type: 'breadcrumb',
              separator: '›',
              props: {
                // Below `sm` the trail keeps its root and the page being
                // viewed, and drops the crumbs between them with their
                // separators: a phone reads where it is, not the whole path.
                className:
                  'min-w-0 flex-initial overflow-hidden [&_ol]:min-w-0 [&_ol]:flex-nowrap [&_li]:shrink-0 [&_li:first-child]:min-w-0 [&_li:first-child]:shrink [&_li:first-child>*]:block [&_li:first-child>*]:truncate [&_li:last-child]:min-w-0 [&_li:last-child]:shrink [&_li:last-child>*]:block [&_li:last-child>*]:truncate max-sm:[&_li:not(:first-child):not(:nth-last-child(-n+2))]:hidden',
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
                className: 'ml-auto flex shrink-0 items-center gap-2',
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
                    // An icon button in a bar narrower than 42rem (the
                    // header's own width, `@container`), where the breadcrumb
                    // needs the width; the labelled field from there up. The
                    // button's own label names it at every width.
                    className:
                      'relative size-8 shrink-0 justify-center gap-2 rounded-md px-0 text-sm font-normal text-muted-foreground shadow-none @2xl:w-56 @2xl:justify-start @2xl:px-2',
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
                        className: 'hidden flex-1 text-left @2xl:inline',
                      },
                      content: '$t:admin.shell.searchPlaceholder',
                    },
                  ],
                },
                {
                  // Said where every page shows it, to the one reader it is
                  // true for: an operator without the console's write tier.
                  // The sentence from 1440px; two words below, from `md` —
                  // and at every width on a page whose facts stand beside the
                  // trail (the header's third child), which need that room.
                  type: 'text',
                  element: 'span',
                  visibility: { unlessCapability: 'edit-operations' },
                  props: {
                    className:
                      'hidden min-w-0 truncate text-xs text-muted-foreground min-[90rem]:block [header>:nth-child(3)>&]:hidden',
                    'data-testid': 'read-only-notice',
                  },
                  content: '$t:admin.shell.readOnly',
                },
                {
                  type: 'text',
                  element: 'span',
                  visibility: { unlessCapability: 'edit-operations' },
                  props: {
                    className:
                      'hidden shrink-0 text-xs whitespace-nowrap text-muted-foreground md:block min-[90rem]:hidden min-[90rem]:[header>:nth-child(3)>&]:block',
                    'data-testid': 'read-only-notice-short',
                  },
                  content: '$t:admin.shell.readOnlyShort',
                },
                {
                  // shadcn's ghost icon button (size `icon`, 32 px), the
                  // height of the search button beside it: a square box with
                  // its glyph centred, rather than the bare 20×24 the
                  // component draws on its own.
                  type: 'theme-toggle',
                  variant: 'icon',
                  props: {
                    'data-testid': 'admin-scheme-toggle',
                    className:
                      'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4',
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
