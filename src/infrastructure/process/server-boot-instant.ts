/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The instant the running server started, as the orphaned-run sweep reads it.
 *
 * Automation queues live in memory, so a run row left `running` or `queued` by
 * a server that has since stopped will never be finished by anything. The one
 * exact test for "left by a previous server" is "started before THIS server
 * started" — which needs that instant.
 *
 * Published by `startServer` at the top of every boot, NOT at module load and
 * NOT by the `--watch` hot swap:
 *
 *   - module load would be wrong under the E2E harness, which boots many
 *     servers inside one process and would otherwise keep the first boot's
 *     instant forever;
 *   - a hot swap replaces the request handler of a server that keeps running,
 *     with its runs still in flight — re-stamping there would make those live
 *     runs look orphaned.
 *
 * Process-local by design, like the bound origin (`server-origin-live.ts`):
 * Sovrium runs one server per process.
 */

let bootInstantMs: number = Date.now()

/** Record that a server is starting now, and return the instant recorded. */
export const publishServerBootInstant = (): Readonly<Date> => {
  bootInstantMs = Date.now()
  return new Date(bootInstantMs)
}

/** The instant the running server started (module load until a server has). */
export const readServerBootInstant = (): Readonly<Date> => new Date(bootInstantMs)
