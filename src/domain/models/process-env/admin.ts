/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SOVRIUM_ADMIN` — the operator console's environment kill switch.
 *
 * ─── WHY THIS IS AN ENV VAR AND NOT A CONFIG KEY ───────────────────────────
 *
 * `admin: false` already takes the console away, so a second way to do it earns
 * its place only by being reachable by a DIFFERENT person. It is: the config
 * file is the application, versioned and reviewed, while the environment
 * belongs to whoever operates the deployment. An operator responding to an
 * incident — a leaked admin session, a host that must expose nothing but its
 * public pages — should not have to edit, review and redeploy an application to
 * close a door.
 *
 * That is also why the env WINS over the config rather than conflicting with
 * it. An app declaring `admin: true` under `SOVRIUM_ADMIN=off` boots green and
 * serves no console: the two are not a contradiction to refuse, they are a
 * general rule and a local override, and refusing the boot would turn a safety
 * switch into an outage.
 *
 * ─── WHY AN UNKNOWN VALUE THROWS ───────────────────────────────────────────
 *
 * The failure this refuses is `SOVRIUM_ADMIN=false`, or `0`, or `disabled` —
 * every one of which an operator would reasonably expect to switch the console
 * OFF, and every one of which a lenient parser would silently read as "not
 * `off`, so on". A kill switch that quietly declines to kill is worse than no
 * kill switch, because it is believed. Naming the variable and its vocabulary
 * at startup costs one restart and removes the whole class.
 */

import { parseEcoEnum } from './eco/eco-env-parsing'

/** The console's two postures. */
export type SovriumAdminMode = 'on' | 'off'

/** The variable's name, so a caller can quote it without spelling it again. */
export const SOVRIUM_ADMIN_VAR = 'SOVRIUM_ADMIN'

/**
 * Resolve `SOVRIUM_ADMIN`.
 *
 * Unset, empty or whitespace-only resolves to `on`: the console is a default
 * capability of every Sovrium instance, and an operator who has never heard of
 * this variable must still get one.
 *
 * @param env - the environment to read (defaults to the process environment).
 * @throws Error when set to anything other than `on` or `off`.
 */
export const parseSovriumAdmin = (
  env: Readonly<Record<string, string | undefined>> = process.env
): SovriumAdminMode =>
  parseEcoEnum(SOVRIUM_ADMIN_VAR, env[SOVRIUM_ADMIN_VAR], {
    allowed: ['on', 'off'] as const,
    fallback: 'on',
  })
