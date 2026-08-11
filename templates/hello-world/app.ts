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
 * For IDE autocompletion, install @sovrium/types:
 *   bun add -d @sovrium/types
 *
 * Then use defineConfig:
 *   import { defineConfig } from '@sovrium/types'
 *   export default defineConfig({ ... })
 */

const config = {
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
          type: 'container' as const,
          element: 'section' as const,
          props: {
            className: 'min-h-screen flex items-center justify-center',
            style: {
              background:
                'linear-gradient(to bottom, var(--color-background-subtle), var(--color-background))',
            },
          },
          children: [
            {
              type: 'container' as const,
              props: { className: 'text-center max-w-2xl mx-auto px-6' },
              children: [
                {
                  type: 'text' as const,
                  element: 'h1' as const,
                  props: {
                    className: 'text-5xl font-bold mb-6',
                    style: { color: 'var(--color-foreground)' },
                  },
                  content: 'Hello, World!',
                },
                {
                  type: 'text' as const,
                  element: 'p' as const,
                  props: {
                    className: 'text-xl mb-8',
                    style: { color: 'var(--color-foreground-muted)' },
                  },
                  content: 'Built with Sovrium',
                },
                {
                  type: 'button' as const,
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
}

export default config
