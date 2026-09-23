/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// API keys — the third page of the operator's own account cluster, beside My
// profile (identity) and My data (GDPR). A long-lived credential is something
// you HOLD, not something you configure, so it belongs with the other things
// about you rather than under Developers → API.
//
// ─── ITS OWN SURFACE, NOT A CARD ON `/api` (D6) ────────────────────────────
//
// `/api` is a config-REFLECTION surface: every block it prints is derived from
// the administered app's config, and it has never carried a write. Giving it one
// would need an [internal ref] amendment, because "read-only operational data console"
// is the whole shape of that page.
//
// ─── WHY THE BODY IS AN ISLAND RATHER THAN A `table` ──────────────────
//
// The shared confirm gate renders INLINE in the clicked row, which places it
// before every row below it, and the list has to re-render the moment a revealed
// key is acknowledged. Both are DOM-ordering and shared-state concerns that one
// island settles and two components cannot.
//
// ─── SELF-SERVICE ONLY (D4) ────────────────────────────────────────────────
//
// Every endpoint the island calls is `/api/auth/api-key/*`, which the plugin
// scopes to the calling session. There is no admin-manages-others path because
// there is none to expose — an operator sees their own keys and nobody else's.
//
// ─── `requires` REPLACES A HAND-WRITTEN GATE ───────────────────────────────
//
// Without `auth.apiKeys` the plugin is not mounted and every endpoint this page
// calls answers 404, so the PAGE must 404 too rather than render controls whose
// own backend is absent. That used to be an `if` in the surface builder; it is
// now `requires`, which is strictly stronger: an unmet page is DROPPED at boot,
// so it 404s AND appears in no sitemap, no palette page list and no derived
// navigation — the state of a page nobody wrote, rather than a URL the app
// advertises and then refuses.

import { ACCOUNT_COLUMN, CARD_CLASS } from '../components/card'
import { withShell } from '../components/shell'
import type { Page as PageConfig } from '@/domain/models/app'

export default withShell(
  {
    id: 'dashboard-api-keys',
    name: 'dashboard-api-keys',
    path: '/api-keys',
    meta: { title: '$t:admin.meta.apiKeys', lang: 'en-US' },
    requires: ['auth.apiKeys'],
    components: [
      {
        type: 'container',
        element: 'div',
        props: { className: ACCOUNT_COLUMN },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-2' },
            children: [
              {
                type: 'text',
                element: 'h2',
                props: { className: 'text-foreground text-3xl font-semibold' },
                content: '$t:admin.apiKeys.heading',
              },
              {
                type: 'text',
                element: 'p',
                props: { className: 'text-foreground-subtle text-md' },
                content: '$t:admin.locked.audit.apiKeys.scopeNotice',
              },
            ],
          },
          // The island host. `data-island` on a config `props` bag is the
          // sanctioned marker shape: `hasDataIslandProp` is what makes the page
          // emit the hydration script, and `check-island-drift.ts` reads
          // object-literal `'data-island'` properties as structural emitters, so
          // the registry and this host cannot silently drift apart.
          //
          // The SSR child is a plain sentence rather than a skeleton: this list
          // is one fetch deep, and the honest placeholder for "we are asking" is
          // saying so.
          {
            type: 'container',
            element: 'section',
            props: {
              className: CARD_CLASS,
              'aria-label': '$t:admin.apiKeys.region',
              'data-island': 'api-key-manager',
              'data-island-props': '{}',
            },
            children: [
              {
                type: 'text',
                element: 'p',
                props: { className: 'text-foreground-subtle text-md' },
                content: '$t:admin.apiKeys.loading',
              },
            ],
          },
        ],
      },
    ],
  } as PageConfig,
  { breadcrumb: { 'api-keys': '$t:admin.crumb.apiKeys' } }
) satisfies PageConfig
