/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import conceptsBody from '@/docs/get-started/concepts.md' with { type: 'file' }
import desktopAppBody from '@/docs/get-started/desktop-app.md' with { type: 'file' }
import installationBody from '@/docs/get-started/installation.md' with { type: 'file' }
import introductionBody from '@/docs/get-started/introduction.md' with { type: 'file' }
import quickStartBody from '@/docs/get-started/quick-start.md' with { type: 'file' }
import troubleshootingDesktopBody from '@/docs/get-started/troubleshooting-desktop.md' with { type: 'file' }
import troubleshootingRuntimeBody from '@/docs/get-started/troubleshooting-runtime.md' with { type: 'file' }
import troubleshootingBody from '@/docs/get-started/troubleshooting.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Get started — the section manifest.
 *
 * Eight articles that span every feature at once, so by the placement rule they
 * belong to none of them: an installation walkthrough is not about `tables`,
 * and a troubleshooting page is about whatever failed. They sit in the thin
 * cross-cutting tree under `src/docs/`, as plain `.md` rather than
 * `*.docs.md` — the filename is what every documentation gate uses to tell a
 * cross-cutting article from a co-located fragment.
 *
 * NO ARTICLE HERE CARRIES A DIRECTIVE, and that is a rule rather than an
 * accident. An option table inside a walkthrough is the same option documented
 * twice, which is the duplication the placement rule exists to prevent; where
 * one of these articles needs an option's values it names the feature article
 * instead. `docs-structure.test.ts` asserts the absence.
 */
export const section = defineSection({
  slug: 'get-started',
  title: 'Get Started',
  order: 1000,
  tab: 'learn',
  articles: [
    defineArticle({
      slug: 'introduction',
      title: 'Welcome to Sovrium',
      description:
        'What Sovrium is, why it exists, and how one configuration file becomes a complete web application.',
      keywords: [
        'sovrium',
        'documentation',
        'getting started',
        'configuration-driven',
        'self-hosted',
        'application platform',
      ],
      order: 1000,
      sidebarLabel: 'Welcome to Sovrium',
      body: introductionBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'installation',
      title: 'Installation',
      description:
        'Install Sovrium on your machine or run it on a managed host, then create your first configuration file.',
      keywords: [
        'sovrium',
        'installation',
        'setup',
        'binary',
        'docker',
        'cloud',
        'scalingo',
        'database',
        'PostgreSQL',
        'getting started',
      ],
      order: 1010,
      sidebarLabel: 'Installation',
      body: installationBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'desktop-app',
      title: 'The Sovrium App',
      description:
        'A window around the engine — installing it, what the first run asks, where the project folder and its data live, what the settings page does and does not hold, and the one request the app makes.',
      keywords: [
        'sovrium',
        'desktop app',
        'download',
        'macOS',
        'Windows',
        'Linux',
        'AppImage',
        'project folder',
        'app settings',
        'updates',
      ],
      order: 1015,
      sidebarLabel: 'The Sovrium App',
      body: desktopAppBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'quick-start',
      title: 'Quick Start',
      description:
        'From an empty file to a running app — in YAML driven by the CLI, or in TypeScript with full type safety.',
      keywords: [
        'sovrium',
        'quick start',
        'tutorial',
        'YAML',
        'JSON',
        'first app',
        'configuration example',
      ],
      order: 1020,
      sidebarLabel: 'Quick Start',
      body: quickStartBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'concepts',
      title: 'Core Concepts',
      description:
        'The anatomy of a Sovrium app — the configuration object, its root sections, and the philosophy that turns one file into a full-stack application.',
      keywords: [
        'sovrium',
        'concepts',
        'app schema',
        'configuration-driven',
        'anatomy',
        'root properties',
        'tables',
        'pages',
        'forms',
        'automations',
        'auth',
        'layer model',
      ],
      order: 1030,
      sidebarLabel: 'Core Concepts',
      body: conceptsBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'troubleshooting',
      title: 'Troubleshooting: Startup & Config',
      description:
        'The errors Sovrium prints when it will not start — port conflicts, a stale lock, an unusable DATABASE_URL, validation failures and unreadable config files.',
      keywords: [
        'sovrium',
        'troubleshooting',
        'port in use',
        'server already running',
        'DATABASE_URL',
        'validation failed',
        'SOVRIUM_ENCRYPTION_KEY',
        'encryption key',
        'data directory',
        'file not found',
        'failed to parse',
      ],
      order: 1040,
      sidebarLabel: 'Troubleshooting: Startup',
      body: troubleshootingBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'troubleshooting-runtime',
      title: 'Troubleshooting: Auth, Email & MCP',
      description:
        'The warnings and errors that appear once Sovrium is running — signing keys, email and AI disabled when the config needs them, and MCP refusing to start.',
      keywords: [
        'sovrium',
        'troubleshooting',
        'AUTH_SECRET',
        'SOVRIUM_ENCRYPTION_KEY',
        'JWT signing keys',
        'stored connection tokens',
        'must reconnect',
        'SMTP not configured',
        'email disabled',
        'AI disabled',
        'AI_PROVIDER not set',
        'MCP_TOKEN_ADMIN',
        'MCP_AUTH_STRATEGY',
        'MCP static tokens removed',
        'MCP_ENABLED requires app.auth',
      ],
      order: 1044,
      sidebarLabel: 'Troubleshooting: Runtime',
      body: troubleshootingRuntimeBody,
      documents: [],
      stories: [
        'US-CLI-SERVER-LOGGING-JOURNAL',
        'US-CLI-SERVER-LOGGING-RUNTIME',
        'US-CLI-SERVER-LOGGING-WARNINGS',
      ],
    }),
    defineArticle({
      slug: 'troubleshooting-desktop',
      title: 'Troubleshooting: the Sovrium App',
      description:
        'The warnings an operating system shows on a fresh download, a window that opens on nothing, and the two places to look when a change does not appear.',
      keywords: [
        'sovrium',
        'troubleshooting',
        'Gatekeeper',
        'developer cannot be verified',
        'SmartScreen',
        'AppImage',
        'libfuse2',
        'WebKitGTK',
        'blank window',
        'open in browser',
        'version mismatch',
      ],
      order: 1048,
      sidebarLabel: 'Troubleshooting: the App',
      body: troubleshootingDesktopBody,
      documents: [],
      stories: [],
    }),
  ],
})
