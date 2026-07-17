/**
 * Example: TypeScript configuration file for Sovrium
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
            style: { background: 'linear-gradient(to bottom, #f8fafc, #ffffff)' },
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
                    style: { color: '#0f172a' },
                  },
                  content: 'Hello, World!',
                },
                {
                  type: 'text' as const,
                  element: 'p' as const,
                  props: {
                    className: 'text-xl mb-8',
                    style: { color: '#475569' },
                  },
                  content: 'Built with Sovrium',
                },
                {
                  type: 'button' as const,
                  props: {
                    className: 'px-6 py-3 rounded-lg font-semibold transition-colors',
                    style: { backgroundColor: '#3b82f6', color: '#ffffff' },
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
