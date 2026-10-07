/**
 * The TypeScript twin of `app.yaml` — the same app, the same page, the other
 * syntax. The two files are kept in sync: they exist to show that the format
 * is a choice, not a difference in capability.
 *
 *   sovrium start app.ts --watch
 *   sovrium validate app.ts
 *
 * For autocompletion and compile-time checking, run `sovrium types` in this
 * directory. It writes `sovrium.d.ts` and `tsconfig.json` out of the binary —
 * no package.json, no node_modules, no install step — and that declaration is
 * what makes the `import type` below resolve. Re-run it after upgrading.
 *
 * The import stays type-only: it is erased before the app runs, so the binary
 * never has to resolve `sovrium`. A value import would type-check and then
 * fail to boot with "Cannot find module".
 *
 * `satisfies` checks the object against the schema while keeping its literal
 * types, so `type` and `element` need no `as const`.
 */

import type { AppConfig } from 'sovrium'

export default {
  name: 'my-app',
  version: '2.0.0',
  description: 'The one-page starter — the first page after sovrium init.',
  // The design system. Twelve colour roles per scheme, every one read by the
  // page; see app.yaml for why each block is shaped the way it is.
  design: {
    colorScheme: 'system',
    colors: {
      primary: '#1e3a5f',
      'primary-hover': '#15293f',
      'primary-active': '#10213a',
      'primary-foreground': '#ffffff',
      ring: '#3b6ea5',
      background: '#ffffff',
      'background-subtle': '#f6f7f9',
      'background-raised': '#ffffff',
      foreground: '#15181c',
      'foreground-muted': '#4f555d',
      'foreground-subtle': '#6b727b',
      border: '#e3e5e9',
    },
    darkColors: {
      primary: '#3b6ea5',
      'primary-hover': '#4b82bd',
      'primary-active': '#5b93cf',
      'primary-foreground': '#ffffff',
      ring: '#5b93cf',
      background: '#101215',
      'background-subtle': '#181b1f',
      'background-raised': '#181b1f',
      foreground: '#e9ebee',
      'foreground-muted': '#a3a9b1',
      'foreground-subtle': '#8a9099',
      border: '#282c32',
    },
    codeBlock: {
      theme: 'github-dark',
    },
    radius: {
      sm: '0.25rem',
      md: '0.5rem',
      lg: '0.75rem',
      full: '9999px',
    },
    voice: {
      personality: ['welcoming', 'plain', 'brief'],
      pronoun: 'you',
      prefer: [
        'Say that it runs, then name the one file to open.',
        'One link to the documentation, one to the next step — never a menu.',
      ],
      avoid: [
        'No exclamation marks, not even in "Hello, world".',
        'No claim about the product; the page proves it runs, nothing more.',
      ],
      tone: {
        empty: 'Not used — the page is the empty state of the app.',
        loading: 'Not used — the page is static.',
        error: 'Name the route that is missing and link back to the start.',
        success: 'Confirm the change landed — the page shows the new heading after a save.',
        destructive: 'Not used.',
      },
    },
    // The three rules every page of this app keeps.
    principles: [
      'The first page says it works, names the file to edit, and gets out of the way.',
      'It disappears when the first real page is written at /.',
      'One accent, used once.',
    ],
  },
  // The page at `/`. Replace it with your own and this one is gone.
  pages: [
    {
      name: 'home',
      path: '/',
      meta: {
        title: 'Your app is running',
        description: 'A Sovrium app, running. Open app.yaml to change this page.',
      },
      components: [
        {
          type: 'container',
          element: 'main',
          props: {
            className:
              'flex min-h-screen items-center justify-center p-10 max-md:items-start max-md:px-[18px] max-md:py-6',
          },
          children: [
            {
              type: 'container',
              props: {
                className: 'flex w-full max-w-[600px] flex-col gap-[18px]',
              },
              children: [
                {
                  type: 'container',
                  props: {
                    className:
                      'inline-flex items-center gap-2 font-mono text-[12.5px] font-medium text-foreground-muted',
                  },
                  children: [
                    {
                      type: 'text',
                      element: 'span',
                      props: {
                        className: 'size-2 rounded-full bg-foreground-subtle',
                        'aria-hidden': 'true',
                      },
                      content: '',
                    },
                    {
                      type: 'text',
                      element: 'span',
                      content: 'Running on $app.origin',
                    },
                  ],
                },
                {
                  type: 'text',
                  element: 'h1',
                  props: {
                    className:
                      'text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] text-foreground max-md:text-[30px]',
                  },
                  content: 'Your app is running.',
                },
                {
                  type: 'text',
                  element: 'p',
                  props: {
                    format: 'markdown',
                  },
                  classes: {
                    parts: {
                      paragraph: '!text-foreground-muted text-[17px] leading-[1.6]',
                      inlineCode: 'font-mono text-[1em]',
                    },
                  },
                  content:
                    'This page is `app.yaml`. Change the heading there and save — the page reloads on its own.',
                },
                {
                  type: 'container',
                  children: [
                    {
                      type: 'code',
                      props: {
                        language: 'yaml',
                        className: '!bg-[#0d1117] !px-3.5 !py-3 !text-[13px] !leading-[1.65]',
                      },
                      classes: {
                        parts: {
                          frame: 'border-[#30363d]',
                          caption:
                            'h-[34px] border-[#30363d] bg-[#0d1117] px-3 py-0 text-[12px] !text-[#9da7b3]',
                        },
                      },
                      filename: 'app.yaml',
                      copy: false,
                      content:
                        'pages:\n  - name: home\n    path: /\n    components:\n      - type: text\n        element: h1\n        content: Your app is running.   # edit me',
                    },
                  ],
                },
                {
                  type: 'container',
                  element: 'nav',
                  props: {
                    'aria-label': 'Next steps',
                    className:
                      'flex flex-col overflow-hidden rounded-lg border border-border bg-background-raised',
                  },
                  children: [
                    {
                      type: 'link',
                      props: {
                        href: 'https://sovrium.com/en/docs',
                        className:
                          'flex items-center gap-3 border-b border-border px-4 py-3.5 text-[15px] font-medium text-foreground shadow-[inset_3px_0_0_var(--color-primary)] hover:bg-background-subtle',
                      },
                      children: [
                        {
                          type: 'icon',
                          props: {
                            name: 'book',
                            size: 18,
                            className: 'shrink-0 text-primary',
                          },
                        },
                        {
                          type: 'text',
                          element: 'span',
                          props: {
                            className: 'grow',
                          },
                          content: 'Read the documentation',
                        },
                        {
                          type: 'icon',
                          props: {
                            name: 'arrow-right',
                            size: 16,
                            className: 'shrink-0 text-foreground-muted',
                          },
                        },
                      ],
                    },
                    {
                      type: 'link',
                      props: {
                        href: 'https://sovrium.com/apps',
                        className:
                          'flex items-center gap-3 px-4 py-3.5 text-[15px] text-foreground hover:bg-background-subtle',
                      },
                      children: [
                        {
                          type: 'icon',
                          props: {
                            name: 'layers',
                            size: 18,
                            className: 'shrink-0 text-foreground-muted',
                          },
                        },
                        {
                          type: 'text',
                          element: 'span',
                          props: {
                            className: 'grow',
                          },
                          content:
                            'Start from a template — a CRM, a blog, a helpdesk and fifteen more',
                        },
                        {
                          type: 'icon',
                          props: {
                            name: 'arrow-right',
                            size: 16,
                            className: 'shrink-0 text-foreground-muted',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  type: 'text',
                  element: 'p',
                  props: {
                    format: 'markdown',
                  },
                  classes: {
                    parts: {
                      paragraph: '!text-foreground-subtle text-[13.5px]',
                      inlineCode: 'font-mono',
                    },
                  },
                  content: 'This page goes away as soon as you write your own page at `/`.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      // Any address that answers nothing renders this page, with a 404 status.
      name: 'not-found',
      path: '/404',
      meta: {
        title: 'Nothing here yet',
        description: 'No page answers this address yet.',
      },
      components: [
        {
          type: 'container',
          element: 'main',
          props: {
            className:
              'flex min-h-screen items-center justify-center p-10 max-md:items-start max-md:px-[18px] max-md:py-6',
          },
          children: [
            {
              type: 'container',
              props: {
                className: 'flex w-full max-w-[600px] flex-col gap-[18px]',
              },
              children: [
                {
                  type: 'text',
                  element: 'p',
                  props: {
                    className: 'font-mono text-[12.5px] font-medium text-foreground-muted',
                  },
                  content: '404',
                },
                {
                  type: 'text',
                  element: 'h1',
                  props: {
                    className:
                      'text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] text-foreground max-md:text-[30px]',
                  },
                  // `$app.path` is the address the visitor asked for, printed as text.
                  content: 'Nothing at $app.path yet.',
                },
                {
                  type: 'text',
                  element: 'p',
                  props: {
                    format: 'markdown',
                  },
                  classes: {
                    parts: {
                      paragraph: '!text-foreground-muted text-[17px] leading-[1.6]',
                      inlineCode: 'font-mono text-[1em]',
                    },
                  },
                  content:
                    'Add a page with its `path:` set to this address in `app.yaml`, or go back to the start.',
                },
                {
                  type: 'container',
                  props: {
                    className: 'flex',
                  },
                  children: [
                    {
                      type: 'link',
                      props: {
                        href: '/',
                        className:
                          'inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background-raised px-3 text-[14px] font-medium text-foreground hover:bg-background-subtle',
                      },
                      children: [
                        {
                          type: 'icon',
                          props: {
                            name: 'house',
                            size: 14,
                          },
                        },
                        {
                          type: 'text',
                          element: 'span',
                          content: 'Back to the start',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  // "Built with Sovrium" once, as a small line after the page.
  badge: {
    placement: 'footer',
  },
} satisfies AppConfig
