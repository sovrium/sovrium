/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * Whether the operator declared a LIVE `analytics` block.
 *
 * `BuiltInAnalyticsSchema` is `Boolean | Struct`, so `analytics: false` is a
 * config an operator can write — and `api-routes.ts` reads it exactly as it
 * reads an absent block: every `/api/analytics/*` endpoint is left
 * unregistered. So "declared" and "enabled" are different questions, and only
 * the second one is worth asking.
 *
 * ─── ONE PREDICATE, TWO CONSUMERS ────────────────────────────────
 *
 * It lived in `data-links-panels.ts` while the links surface was its only
 * caller. The page-capability gate needs the same question answered, and it is
 * DOMAIN code that cannot import an application use-case — so the choice was a
 * shared home or a third copy of the same test.
 *
 * The copy that already existed was wrong: `PAGE_CAPABILITIES` tested
 * `!== undefined`, so a page declaring `requires: ['analytics']` was registered,
 * served and listed in the sitemap on an instance where every panel on it reads
 * a 404 — and a `declares: analytics` body rendered in place of the
 * `unlessDeclares` empty state written to say the instance has none. Its two
 * `false`-admitting siblings, `auth.apiKeys` and `auth.twoFactor`, already
 * excluded the literal for this exact reason.
 */
export function analyticsIsEnabled(app: App): boolean {
  return app.analytics !== undefined && app.analytics !== false
}
