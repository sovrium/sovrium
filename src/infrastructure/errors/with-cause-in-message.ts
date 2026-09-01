/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Restore a driver's own words to an error whose wrapper hid them.
 *
 * Lifted out of `auth/better-auth/adapter-errors.ts` once a SECOND caller
 * appeared. `sovrium migrate` needs it for exactly the reason Better Auth did —
 * every `catch:` in the migrator stringifies a `DrizzleQueryError` whose text is
 * `Failed query: …`, with the driver's message two `.cause` hops away — and a
 * database command reaching into the auth layer for a generic error utility is a
 * layering smell, not a dependency.
 */

/**
 * Fold a thrown error's `cause` chain into its own `message`.
 *
 * Drizzle raises `DrizzleQueryError`, whose message is only
 * `Failed query: <sql>\nparams: <params>` — the DRIVER's message
 * (`relation "auth.oauth_resource" does not exist`, `duplicate key value
 * violates unique constraint …`) lives exclusively on `.cause`.
 *
 * Better Auth tolerates several expected database conditions by matching a
 * REGEX against `err.message`. Two of those safety nets sit directly on the boot
 * path, both in `@better-auth/oauth-provider`'s `seedResources`:
 *
 *  - `MISSING_TABLE_PATTERN` (`/no such table|relation.*does not exist|…/i`) —
 *    "tables may not exist yet at plugin init; defer the seed to first access".
 *  - the unique-conflict net (`/unique|duplicate|UNIQUE/i`) — "another process
 *    inserted between our findOne and create; treat the conflict as a no-op",
 *    which is upstream's documented race-safety for concurrent seeding.
 *
 * Neither can ever match on this stack, because the string they are handed never
 * contains the driver's words. Both nets are therefore silently INERT, and the
 * conditions they exist to absorb become fatal boot crashes instead — which is
 * how a 42P01 on `auth.oauth_resource` became a total upgrade break in v0.23.0,
 * and how the concurrent-seed 23505 reaches the process at all.
 * Restoring the message re-arms upstream's own handling rather than
 * reimplementing it here.
 *
 * This is also precisely why the defect is Postgres-only: `bun:sqlite` raises
 * `SQLiteError` with `no such table: …` directly on `.message`, so
 * `MISSING_TABLE_PATTERN` has always matched on the SQLite lane and the seed
 * deferred cleanly there. Postgres was the only dialect where upstream's
 * tolerance was unreachable — which is why an always-on SQLite lane could not
 * host the oracle, and a total upgrade break shipped.
 *
 * ── What this does NOT fix ──────────────────────────────────────────────────
 * The boot still QUERIES `auth.oauth_resource` before the migration phase; that
 * query is now tolerated rather than fatal, and the seed lands on first access
 * as upstream intends. The stated invariant — "no application code touches the
 * database before migrations complete" — is therefore NOT restored here.
 *
 * Restoring it means not constructing the Better Auth instance until after
 * migrations, and the obvious lever (deferring `createAuthInstance` to first use
 * in `layer.ts`) was implemented, measured, and REVERTED: it breaks
 * `[internal ref]`. `mcpResourceIdentifier` reads `PORT` /
 * `BASE_URL` at CALL time, so moving construction across the port-binding
 * boundary changes the resource identifier — and with five independent
 * `createAuthInstance` call sites, they stop agreeing on the `aud`
 * every issued token is bound to. Making construction order safe requires the
 * resource identity to stop being time-dependent, or the five instances to
 * collapse into one; both are design changes beyond this fix.
 *
 * The error is augmented in place rather than replaced: `.cause`, the stack, and
 * the driver-specific fields Sovrium reads elsewhere (`errno` carries the
 * SQLSTATE on `bun:sql`) all stay exactly where the rest of the codebase expects
 * them. Appending is skipped when the message is already present, so this is
 * idempotent and never repeats a message two wrappers happen to share.
 *
 * The walk is UNBOUNDED, guarded by identity rather than by depth. A hardcoded
 * depth would silently re-create the very bug this function exists to remove:
 * one extra wrapper between drizzle and the driver and the driver's words are
 * dropped again, upstream's nets go inert again, and nothing fails — no test,
 * no gate, no error. Today's chain is depth 1, which is exactly why a depth cap
 * would never be noticed until it mattered. The `Set` makes a self-referential
 * or cyclic chain terminate, which is the only thing the cap was really buying.
 */
export const withCauseInMessage = (error: unknown): unknown => {
  if (!(error instanceof Error)) return error

  const seen = new Set<unknown>([error])
  const collect = (node: unknown, messages: readonly string[]): readonly string[] => {
    if (!(node instanceof Error) || seen.has(node)) return messages
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- cycle guard; the Set is the walk's own local state, created and discarded inside this call
    seen.add(node)
    const alreadyPresent =
      node.message.length === 0 ||
      error.message.includes(node.message) ||
      messages.includes(node.message)
    return collect(node.cause, alreadyPresent ? messages : [...messages, node.message])
  }

  const causes = collect(error.cause, [])

  if (causes.length > 0) {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- augment the thrown error in place: replacing it would drop `.cause`, the stack, and the driver's `errno`/SQLSTATE that callers downstream read
    error.message = [error.message, ...causes].join('\n')
  }
  return error
}
