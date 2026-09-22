/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * Decide whether a `--watch` save can be swapped into the live listener or
 * needs the full teardown-and-rebind.
 *
 * Most saves change only what the request handler RENDERS — a page's text, a
 * translation string, a theme token — and a Hono app carrying the new config
 * can be swapped into a running `Bun.serve` listener without the socket ever
 * closing. Some saves cannot take that path, because the boot installed
 * something that is not re-runnable in place: the cron scheduler and the AI
 * `LISTEN`/`NOTIFY` clients are not idempotent, Better Auth decides its route
 * table from the plugin set at construction time, and a new table means
 * columns and record routes the running server was built without.
 *
 * THE RESTART SET IS CLOSED; HOT IS THE DEFAULT. The predicate below is
 * written as membership of {@link RESTART_KEYS} and deliberately NOT as
 * membership of a hot list: a key added to `AppSchema` later must swap in
 * place by default, and moving it to the expensive side has to be a
 * deliberate edit here rather than something that happens by omission. That
 * is why the top-level metadata keys (`name`, `version`, `description`,
 * `badge`) are hot without being enumerated anywhere — they install nothing a
 * boot would have to re-install.
 *
 * The verdict is decided by COMPARING THE DECODED APPS, never by looking at
 * which file changed: a split config puts `tables` in `config/tables.ts` on
 * one project and inline in `app.json` on the next, so a filename-based rule
 * would classify the same edit differently in two repositories.
 */

/**
 * The keys whose change forces a full restart, in the order they are probed —
 * which is also the order that decides `reason` when a save touches more than
 * one of them.
 */
const RESTART_KEYS = [
  'tables',
  'automations',
  'auth',
  'agents',
  'connections',
  'env',
  'analytics',
  'buckets',
] as const

/** The verdict, and the key that forced a restart when there is one. */
export type ConfigChangeVerdict =
  { readonly kind: 'hot' } | { readonly kind: 'restart'; readonly reason: string }

/**
 * Classify a config change.
 *
 * RESTART WINS on a mixed save: the hot half would be applied by the restart
 * anyway, whereas hot-swapping a config whose `tables` changed would leave the
 * database schema and the running server disagreeing. `reason` names the key
 * that FORCED the restart — the token the watcher prints in
 * `[watch] Config changed (tables) — full restart…` — rather than the harmless
 * one that came along with it.
 *
 * @param oldApp - The decoded config the running server was built from.
 * @param newApp - The decoded config the save produced.
 */
export const classifyConfigChange = (oldApp: App, newApp: App): ConfigChangeVerdict => {
  // Non-strict `deepEquals`, so an optional key present-but-`undefined` on one
  // side and absent on the other compares equal. Decoding fills optional keys
  // inconsistently depending on whether the raw config mentioned them, and a
  // reload must not restart over that.
  const forcing = RESTART_KEYS.find((key) => !Bun.deepEquals(oldApp[key], newApp[key]))
  return forcing === undefined ? { kind: 'hot' } : { kind: 'restart', reason: forcing }
}
