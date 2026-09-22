/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether the operator console is served at all.
 *
 * The console is UNPLUGGABLE in the sense that matters: an operator never
 * configures what it IS. It ships inside the binary, version-locked to the
 * release, and no config key can reach its pages, its navigation or its
 * backend. The single thing `admin` decides is whether it is served.
 *
 * ─── THE TWO STATES ────────────────────────────────────────────────────────
 *
 * | config            | result              |
 * |-------------------|---------------------|
 * | absent, or `true` | served at `/_admin` |
 * | `false`           | not served          |
 *
 * The base path is FIXED at `/_admin` and is not configurable. Making it
 * movable made "is this request inside the console?" a question the public
 * carve-out, the stylesheet cache key and the subtree collision check each had
 * to re-answer from config — and an operator who wants the console on another
 * address already has a reverse proxy, which is where that decision belongs.
 *
 * A boolean rather than `{ enabled: boolean }` because there is exactly one
 * decision to record. An object would be a field on a config that carries
 * nothing else, and would immediately look like it configured the console's
 * contents — which nothing may.
 *
 * There is a third way to take the console away, and it is deliberately NOT
 * here: `SOVRIUM_ADMIN=off` in the environment. Whether an app HAS a console is
 * an application fact and belongs in the config; an emergency kill switch is a
 * deployment fact and belongs to whoever holds the environment — which may not
 * be whoever holds the config file. The env WINS over `admin: true`, and it
 * never fails boot for disagreeing with it. Keeping it out of the schema is
 * also what stops a config becoming valid or invalid depending on the
 * deployment that reads it.
 *
 * ─── WHAT THE MOUNT OWNS ───────────────────────────────────────────────────
 *
 * Its whole subtree. `/_admin` answers `/_admin` and every `/_admin/**` path,
 * so an operator page, form or redirect underneath it is a NAMED boot failure
 * rather than a silently shadowed route (founder decision D4 — see
 * `admin-mount-validation.ts`). Shadowing quietly is the failure that refuses:
 * the operator would ship a page that never renders, or displace part of the
 * console they need in order to diagnose it.
 */

import { Schema } from 'effect'

export const AdminConfigSchema = Schema.Boolean.annotate({
  identifier: 'AdminConfig',
  title: 'Admin Console',
  description:
    'Whether Sovrium\'s built-in operator console is served at "/_admin". Omit the key or set `true` to serve it; set `false` to serve it nowhere. The console itself ships inside the binary and is not configurable. The SOVRIUM_ADMIN=off environment variable switches it off whatever this key says.',
  examples: [false],
})
