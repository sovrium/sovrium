/**
 * Example: TypeScript configuration file for Sovrium
 *
 * The TypeScript twin of `app.yaml` — same app, same theme, other syntax. Keep
 * the two in sync when either changes; they exist to show that the format is a
 * choice, not a difference in capability.
 *
 * Usage:
 *   sovrium start templates/hello-world/app.ts
 *   sovrium validate templates/hello-world/app.ts
 *
 * For IDE autocompletion and compile-time checking, run `sovrium types` in this
 * directory. It writes `sovrium.d.ts` + `tsconfig.json` out of the binary — no
 * package.json, no node_modules, no install step — and that ambient declaration
 * is what makes the `import type` below resolve. Re-run it after upgrading the
 * binary; the declaration always describes the schema THAT binary accepts.
 *
 * The import has to stay type-only. It is erased at transpile time, so the
 * binary never resolves the `sovrium` specifier; a value import would
 * type-check and then fail to boot with "Cannot find module".
 *
 * `satisfies` checks the object against the schema while keeping its literal
 * types, which is why the component `type` / `element` fields below need no
 * `as const` annotations to land in the right union member.
 */

import type { AppConfig } from 'sovrium'

export default {
  name: 'my-app',
  version: '1.0.0',
  description: 'My Sovrium application',

  // Nine colour keys, every one of them a role key from COLOR_TO_SV_TOKEN
  // (src/infrastructure/css/theme/theme-generators.ts) and every one cited by
  // the page below. A key outside that map emits `--color-*` only and paints
  // nothing until something references it. See app.yaml for the long form of
  // this note, including why the dark accent stays mid-tone.
  theme: {
    colors: {
      primary: '#1e3a5f',
      'primary-hover': '#15293f',
      ring: '#3b6ea5',
      background: '#ffffff',
      'background-subtle': '#f6f7f9',
      foreground: '#15181c',
      'foreground-muted': '#4f555d',
      'foreground-subtle': '#7c838c',
      border: '#e3e5e9',
    },
    darkColors: {
      primary: '#3b6ea5',
      'primary-hover': '#4b82bd',
      ring: '#5b93cf',
      background: '#101215',
      'background-subtle': '#181b1f',
      foreground: '#e9ebee',
      'foreground-muted': '#a3a9b1',
      'foreground-subtle': '#767c85',
      border: '#282c32',
    },
  },

  pages: [
    {
      name: 'home',
      path: '/',
      meta: { title: 'Welcome' },
      components: [
        {
          type: 'container',
          element: 'section',
          props: {
            className: 'min-h-screen flex items-center justify-center',
            style: {
              background:
                'linear-gradient(to bottom, var(--color-background-subtle), var(--color-background))',
            },
          },
          children: [
            {
              type: 'container',
              props: { className: 'text-center max-w-2xl mx-auto px-6' },
              children: [
                {
                  type: 'text',
                  element: 'h1',
                  props: {
                    className: 'text-5xl font-bold mb-6',
                    style: { color: 'var(--color-foreground)' },
                  },
                  content: 'Hello, World!',
                },
                {
                  type: 'text',
                  element: 'p',
                  props: {
                    className: 'text-xl mb-8',
                    style: { color: 'var(--color-foreground-muted)' },
                  },
                  content: 'Built with Sovrium',
                },
                {
                  type: 'button',
                  props: {
                    className: 'px-6 py-3 rounded-lg font-semibold transition-colors',
                    // `#ffffff` stays a literal: text ON a filled button, not a
                    // surface that should follow the background.
                    style: { backgroundColor: 'var(--color-primary)', color: '#ffffff' },
                  },
                  content: 'Get Started',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
} satisfies AppConfig
