/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dashboard "API keys" surface (`/_admin/api-keys`).
 *
 * The third page of the operator's own account cluster, beside My profile
 * (identity) and My data (GDPR): a long-lived credential is something you HOLD,
 * not something you configure, so it belongs with the other things about you
 * rather than under Developers → API.
 *
 * ## Its own surface, not a card on `/_admin/api` (D6)
 *
 * `/_admin/api` is a config-REFLECTION surface: `buildApiDocsPage` derives every
 * block it prints from the administered app's config, and it has never carried a
 * write. Giving it one would need an [internal ref] amendment, because "read-only
 * operational data console" is the whole shape of that page. So the API-keys
 * page stands on its own and `/_admin/api` gets a one-line pointer to it.
 *
 * ## Why the body is an island rather than a config `data-table`
 *
 * Recorded in `presentation/islands/api-keys/api-key-list.tsx`: the shared
 * confirm gate renders inline in the clicked row, which puts it BEFORE any row
 * below it, and the list has to re-render the moment a revealed key is
 * acknowledged. Both are DOM-ordering and shared-state concerns that one island
 * settles and two components cannot.
 *
 * ## Self-service only (D4)
 *
 * Every endpoint the island calls is `/api/auth/api-key/*`, which the plugin
 * scopes to the calling session. There is no admin-manages-others path here
 * because there is none to expose — an operator sees their own keys and nobody
 * else's, exactly as a `member` does through the API.
 */

import { homeCrumb, wrapInShell, type ShellBreadcrumbItem } from './dashboard-shell-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** The dashboard sub-path this surface answers on. */
export const API_KEYS_CONSOLE_PATH = '/api-keys'

/** Card chrome, byte-identical to the sibling account surfaces. */
const CARD_CLASS = 'border-border bg-background-raised flex flex-col gap-3 rounded-md border p-5'

/** The page intro: heading plus the one line that sets expectations. */
function intro(): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-foreground text-2xl font-semibold' },
        content: 'API keys',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle text-sm' },
        content:
          'Long-lived credentials for scripts and services that call this instance on your behalf. Present one in the x-api-key header. A key carries your own role — it can never do more than you can.',
      },
    ],
  } as unknown as Component
}

/**
 * The island host.
 *
 * `data-island` on a config `props` bag is the sanctioned marker shape here —
 * `hasDataIslandProp` (`PageIslandDetection.ts`) is what makes the page emit the
 * hydration script tag, and `check-island-drift.ts` reads object-literal
 * `'data-island'` properties as structural emitters, so the registry and this
 * host cannot silently drift apart.
 *
 * The SSR child is a plain sentence rather than a skeleton: this list is one
 * fetch deep and the honest placeholder for "we are asking" is saying so.
 */
function managerHost(): Component {
  return {
    type: 'container',
    element: 'section',
    props: {
      className: CARD_CLASS,
      'aria-label': 'Your API keys',
      'data-island': 'api-key-manager',
      'data-island-props': JSON.stringify({}),
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle text-sm' },
        content: 'Loading your API keys…',
      },
    ],
  } as unknown as Component
}

/** Shell-wrap concerns, mirroring the sibling account surfaces. */
export interface ApiKeysSurfaceOptions {
  /** F6 tier / F5 editing flag; drives the read-only posture + sidebar affordances. */
  readonly canEdit: boolean
  /** Operator slug; seeds the shell sidebar brand label. */
  readonly appName?: string
  /** Operator config version (`app.version`); seeds the sidebar version chip. */
  readonly appVersion?: string
}

/**
 * Build the API-keys page, wrapped in the persistent 3-zone sidebar shell.
 *
 * @param title - the page meta title
 * @param options - tier + shell concerns
 */
export function buildApiKeysPage(title: string, options: ApiKeysSurfaceOptions): Page {
  const { canEdit, appName, appVersion } = options
  const breadcrumb: ReadonlyArray<ShellBreadcrumbItem> = [homeCrumb(appName), { label: 'API keys' }]
  const body: Component = {
    type: 'container',
    element: 'div',
    props: { className: 'flex max-w-3xl flex-col gap-6' },
    children: [intro(), managerHost()],
  } as unknown as Component
  return {
    id: 'dashboard-api-keys',
    name: 'dashboard-api-keys',
    path: API_KEYS_CONSOLE_PATH,
    meta: { title },
    components: wrapInShell([body], {
      canEdit,
      appName,
      appVersion,
      breadcrumb,
    }),
  } as Page
}
