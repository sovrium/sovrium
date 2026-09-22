/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure connection-status derivation for the admin App Connections read endpoint
 * (`GET /api/admin/connections` + `.../:id`).
 *
 * Mirrors + extends `deriveAdminStatus` in
 * `src/presentation/api/routes/connections/users-handler.ts` (which derives
 * `connected | expired` for the runtime per-user roster) by adding the
 * `expiring-soon` band and the no-token → `active` graceful degradation. Lives
 * in the domain layer because it is pure, branch-dense, and the natural
 * unit-test target — the application use-case + UI badge logic both consume it
 * so the derivation has a single source of truth.
 *
 * Status semantics (documented contract — see
 * `src/domain/models/api/admin/connections/connections.ts`):
 *   - `active`        — no expiry recorded (null/undefined: apiKey / basic /
 *     bearer connections generate zero token rows, OR a long-lived token), OR
 *     an expiry comfortably in the future.
 *   - `expiring-soon` — an expiry in the future but within
 *     `CONNECTION_EXPIRING_SOON_WINDOW_MS` (7 days).
 *   - `expired`       — an expiry already in the past.
 */

import {
  CONNECTION_EXPIRING_SOON_WINDOW_MS,
  type ConnectionRowAction,
  type ConnectionStatus,
} from '@/domain/models/api/admin/connections/connections'

/* eslint-disable unicorn/no-null -- `null` is the contractual "no expiry recorded" sentinel here (matching the nullable `expiresAt` Zod contract and the use-case's null envelope); `toEpochMs` / `soonestExpiryMs` return `null` to mean "no expiry", distinct from a `0` epoch */

/**
 * Normalize a dialect-native `expiresAt` (a `Date`, an ISO string, `null`, or
 * `undefined`) to an epoch-millisecond timestamp, or `null` when no expiry was
 * recorded. An unparseable string is treated as "no expiry" (degrades to
 * `active`) rather than throwing — the derivation is a read-only health badge,
 * not a validation gate.
 */
const toEpochMs = (
  expiresAt: Readonly<Date> | string | number | null | undefined
): number | null => {
  if (expiresAt === null || expiresAt === undefined) return null
  if (typeof expiresAt === 'number') return Number.isNaN(expiresAt) ? null : expiresAt
  const ms = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Derive the connection (or per-user token) health badge from an `expiresAt`.
 *
 * @param expiresAt the soonest token expiry for a connection, or a single
 *   token row's expiry; accepts a `Date`, an ISO string, or pre-computed epoch
 *   millis. `null`/`undefined` means "no expiry recorded".
 * @param now the reference instant in epoch millis (defaults to `Date.now()`;
 *   injectable so unit tests are deterministic).
 */
export const deriveConnectionStatus = (
  expiresAt: Readonly<Date> | string | number | null | undefined,
  now: number = Date.now()
): ConnectionStatus => {
  const expiry = toEpochMs(expiresAt)
  // No expiry recorded (no token rows OR a long-lived token) ⇒ active, never
  // expired (graceful degradation for apiKey/basic/bearer connections).
  if (expiry === null) return 'active'
  if (expiry <= now) return 'expired'
  if (expiry - now <= CONNECTION_EXPIRING_SOON_WINDOW_MS) return 'expiring-soon'
  return 'active'
}

/**
 * Compute the SOONEST expiry across a connection's token rows as an epoch-
 * millisecond timestamp, or `null` when there are no token rows OR no token
 * recorded an expiry (long-lived tokens). This is the value the connection-level
 * `expiresAt` field serializes (back to ISO) and the connection-level `status`
 * derives from.
 */
export const soonestExpiryMs = (
  expiries: readonly (Readonly<Date> | string | null | undefined)[]
): number | null => {
  const defined = expiries.map((e) => toEpochMs(e)).filter((ms): ms is number => ms !== null)
  if (defined.length === 0) return null
  return Math.min(...defined)
}

/**
 * Derive the per-row connect/disconnect affordance from a connection's `type`,
 * its `tokenCount`, and its already-derived `status`. The single server-side home
 * of the compound rule (the config `visibleWhen` predicate tests ONE field, so
 * the dashboard data-table gates its action buttons on this derived `rowAction`
 * rather than smuggling multi-field logic into config). Mirrors the bespoke
 * connections-directory island's `deriveRowAction` it replaces:
 *
 *   - non-oauth2 (apiKey / basic / bearer) → `none` (a static secret has nothing
 *     to connect);
 *   - oauth2 with no tokens (`tokenCount === 0`)        → `connect`;
 *   - oauth2 with `expiring-soon` / `expired` tokens    → `reconnect`;
 *   - oauth2 with healthy (`active`) tokens             → `disconnect`.
 */
export const deriveConnectionRowAction = (
  type: string,
  tokenCount: number,
  status: ConnectionStatus
): ConnectionRowAction => {
  if (type !== 'oauth2') return 'none'
  if (tokenCount === 0) return 'connect'
  if (status === 'expired' || status === 'expiring-soon') return 'reconnect'
  return 'disconnect'
}
