/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a host app declares that its stylesheet must ALSO carry someone else's
 * design system, scoped to a subtree.
 *
 * Exactly one host does: Sovrium's own `/_admin` console, whose design-system
 * section draws the operator's system FLAT in the console document ([internal ref]
 * A2). Until 2026-09-02 that was an `<iframe>` — two documents, two
 * stylesheets, no shared cascade — and the console's stylesheet identity could
 * therefore be a CONSTANT. Flattening makes the console's CSS depend on the
 * operator's theme, so the identity has to move with it.
 *
 * ─── WHAT THIS STOPPED MEANING, AND WHY IT IS STILL HERE ──────────────────
 *
 * It was, until `[internal ref]`, the ONE channel by which the operator's tokens
 * reached the console document at all — everything outside a
 * `[data-design-app-scope]` subtree was Sovrium's. That is no longer true: the
 * operator's `design` now cascades onto the console chrome itself, so `:root`
 * carries those same tokens and the scoped block largely RESTATES them.
 *
 * It is deliberately not deleted in that change. It is still what the
 * design-system specimens address (`[internal ref]`, `-002`), it still
 * carries the operator's own `components[]` classes into the candidate corpus —
 * which the chrome cascade does not, since the chrome draws none of them — and
 * it is still an input to the console's stylesheet identity and to
 * `canServePrecompiledFile`. Collapsing it into the chrome cascade is a real
 * simplification and a separate change, owned by the design-system console,
 * with its own proof that the specimens still distinguish the two subtrees.
 *
 * ─── THE SCOPE IS AN `App`, NOT A `Theme` ──────────────────────────────────
 *
 * Because the scoped subtree needs two things from the operator, not one: the
 * theme it resolves, AND the utility classes its own `components[]` paint with
 * — a class the build-time scan never saw is silently dropped from the compiled
 * CSS, with no error and no visible cause. Carrying the whole (filtered) app
 * means `resolveNativeFreeCandidates` walks it for free, because that walk is a
 * recursive `className` sweep over the entire object.
 *
 * The app stored here is ALWAYS the confidentiality-filtered one built by
 * `buildDesignSystemScopeApp` — never the live operator app. `tables`, `env`
 * and `auth` never enter this channel, so A2's bound holds by construction
 * rather than by a redaction pass somebody has to remember to extend.
 */

import { getCSSCacheKey } from '@/infrastructure/css/cache/css-cache-service'
import { resolveNativeFreeCandidates } from '@/infrastructure/css/native-free-compiler'
import type { App } from '@/domain/models/app'

/**
 * An app that additionally carries a scoped design system.
 *
 * Declared as an intersection rather than added to `AppSchema`: this is a
 * RENDERING concern of one synthesized surface, not a configuration option an
 * operator may write. Nothing decodes it, and no config file can set it.
 */
export type ScopedApp = App & { readonly designSystemScope?: App }

/** The scoped design system this app carries, if any. */
export const getDesignSystemScope = (app?: App): App | undefined =>
  (app as ScopedApp | undefined)?.designSystemScope

/** Attach a scoped design system to a host app. */
export const withDesignSystemScope = (host: App, scope: App): App =>
  ({ ...host, designSystemScope: scope }) as ScopedApp

/**
 * The compile identity of a scoped design system — empty when there is none.
 *
 * Both halves of the CSS contract read this, and they must agree exactly:
 * `getVersionedCssHash` mints the URL the rendered HTML links, and
 * `resolveCssApp` recognises that URL on the way back in. It is derived from
 * the same two inputs the compiled CSS depends on (design + candidates), through
 * the same `getCSSCacheKey` the cache uses, so a scope that changes the
 * stylesheet always changes the URL.
 */
export const designSystemScopeKey = (app?: App): string => {
  const scope = getDesignSystemScope(app)
  if (scope === undefined) return ''
  return `::ds-scope::${getCSSCacheKey(scope.design, resolveNativeFreeCandidates(scope))}`
}
