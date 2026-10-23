/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * `install` — the app installs to a phone's home screen and opens without the
 * browser's chrome.
 *
 * Opt-in. Declared, it makes the engine serve `/manifest.webmanifest`
 * generated from the app itself so it cannot drift from it, and a static build
 * (`sovrium build`) writes the same file into its output: the name is the
 * app's `displayName` (else `name`), the description its `description`, the
 * icons the 192 and 512 pixel entries of the home page's favicon set (an SVG
 * icon is accepted), `start_url` and `scope` `/`, and the theme colour the
 * app's design primary. An app that declares no favicon on any page lists
 * the engine's neutral default icon (`/favicon.ico`, 32 pixels); a favicon set
 * with none of those icons gives an empty icon list. Every page links the manifest; a page
 * whose own favicon set already links a hand-written one keeps it.
 *
 * `offline: true` also registers a service worker. It caches the built static
 * assets and one offline page, a fixed engine page in this version, and nothing
 * else: never an API answer and never a page's HTML, so nothing a signed-in
 * reader saw stays on a shared device, and erasing an account is not undone by
 * a cache. It passes `/api/`, `/_admin` and the sign-in routes straight
 * through. Its cache is named after the engine release and the app's
 * `version` (`sovrium-shell-<engine>+<version>`, `sovrium-shell-<engine>` when
 * the app declares none): changing `version` replaces the previous caches on
 * the next visit, and an engine upgrade alone replaces them too, so no asset
 * copy an earlier release cached is served offline.
 *
 * Turning `offline` off while `install` stays declared unregisters the worker
 * and deletes its caches on the next visit. Removing `install` entirely does
 * not: its pages carry no install tag at all, so a worker already registered
 * stays in place on the readers' devices.
 *
 * The routes are files the pages router can never shadow: a page path holds no
 * `.`, so no page — not even a catch-all `/:slug` — answers
 * `/manifest.webmanifest` or `/service-worker.js`.
 */
export const InstallSchema = Schema.Struct({
  /**
   * The short name a home screen shows under the icon, where the full name
   * would be cut. Falls back to the manifest's name.
   */
  shortName: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Name shown under the icon on a home screen, where the full name would be cut (falls back to the app’s displayName, else its name)',
        examples: ['Studio', 'Atelier'],
      }),
      Schema.check(Schema.isMinLength(1), Schema.isMaxLength(30))
    )
  ),
  /** How the installed app opens. */
  display: Schema.optional(
    Schema.Literals(['standalone', 'minimal-ui', 'browser']).annotate({
      description:
        "How the installed app opens: 'standalone' (default) without the browser's address bar, 'minimal-ui' with a reduced one, 'browser' in an ordinary tab",
      defaultNote: 'standalone',
    })
  ),
  /**
   * Register the offline shell: a service worker caching the built static
   * assets and one offline page, never an API answer or a page's HTML.
   */
  offline: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Register a service worker that caches the built static assets and an offline page, so the installed app opens and says it is offline when the network is gone. It never caches an API answer or a page’s HTML and passes /api/, /_admin and the sign-in routes straight through. Its cache is named after the engine release and the app’s version, so changing version replaces it on the next visit; an engine upgrade alone replaces it on the next visit too. Turning offline off while install stays declared unregisters the worker on the next visit; removing install entirely leaves an already-registered worker in place.',
      defaultNote: 'false',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'Install',
    title: 'Installable App',
    description:
      'Make the app installable: serve /manifest.webmanifest generated from the app’s name, description, favicon set and design, link it from every page, and, with offline: true, register a service worker for an offline shell.',
    examples: [{ shortName: 'Studio', display: 'standalone', offline: true }, {}],
  })
)

/** @public */
export type Install = Schema.Schema.Type<typeof InstallSchema>

/** @public */
export type InstallEncoded = Schema.Codec.Encoded<typeof InstallSchema>
