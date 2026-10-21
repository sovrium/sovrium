/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for the two report reads of the operator console:
 *
 *   - `GET /api/admin/reports/requests/:requestId` — the prefilled bug report
 *     for an internal error this server answered under that request id,
 *   - `GET /api/admin/reports/runs/:runId` — the prefilled bug report for an
 *     automation run the engine closed because it stopped with an internal
 *     error.
 *
 * Source stories:
 *
 * ─── AN ADDRESS, NEVER A SUBMISSION ─────────────────────────────────────────
 *
 * Both reads answer the same thing `sovrium report --request-id` prints: a
 * `https://github.com/sovrium/sovrium/issues/new?template=bug.yml&…` address
 * the operator opens themselves. The server builds it from what it already
 * keeps — the error class and signature of the kept failure, the installation
 * facts — and opens no network connection to do so. There is no request body
 * and no write: nothing is filed until a person presses GitHub's own button.
 *
 * ─── WHAT THE ADDRESS MAY CARRY ─────────────────────────────────────────────
 *
 * The title is `<surface>: <error class>` followed by the bracketed eight-hex
 * signature, where the surface is `request` for an internal error the server
 * answered and `automation` for a run it closed. `logs` names the request id
 * or the run id, the error class and the in-repository frames the failure was
 * kept with. It never carries the error MESSAGE (driver text, schema names), a
 * secret value, the run's trigger payload, any record data or a name the
 * operator chose (automation, action, table, app) — the address leaves the
 * machine the moment it is opened, so it holds only what was scrubbed when the
 * failure was kept.
 *
 * ─── A FIX, NOT A REPORT, FOR WHAT THE OPERATOR CAN FIX ─────────────────────
 *
 * An internal error is either an engine defect or the operator's to fix (their
 * environment, their database). The request read answers `{ url }` for a
 * defect and `{ fix }` — a closed code — for the other kind, never both: a
 * report would send the operator to a public tracker and hide what to do. A
 * run that died on a cause the operator can fix records no defect, so the run
 * read answers 404 for it.
 *
 * ─── AUTHORISATION ──────────────────────────────────────────────────────────
 *
 * Admin tier only, gated upstream by the console's `requireAdminTier()` on
 * `/api/admin/*`. Every refusal is the anti-enumeration 404 — a member, an
 * anonymous caller, an id no failure is kept under, a run that finished, or a
 * run that failed on its own step all answer the same three digits, so a
 * caller cannot learn which request ids or runs exist.
 */

import { Schema } from 'effect'
import { uri, uuid } from '@/domain/models/api/combinators/formats'

/**
 * The shape a request id takes on this server: the one `X-Request-Id` admits
 * (word characters, `-` and `=`, at most 255), so every id the server could
 * have answered with decodes and nothing else does.
 */
const REQUEST_ID_PATTERN = /^[\w\-=]{1,255}$/

/** Path parameters of `GET /api/admin/reports/requests/:requestId`. */
export const reportRequestParamsSchema = Schema.Struct({
  requestId: Schema.String.annotate({
    description:
      'The request id an internal error was answered under — the `requestId` of its error body and its `X-Request-Id` header',
  }).pipe(
    Schema.check(
      Schema.makeFilter((value: string) =>
        REQUEST_ID_PATTERN.test(value) ? undefined : 'a request id'
      )
    )
  ),
}).annotate({ identifier: 'AdminReportRequestParams' })

/** @public */
export type AdminReportRequestParams = typeof reportRequestParamsSchema.Type

/** Path parameters of `GET /api/admin/reports/runs/:runId`. */
export const reportRunParamsSchema = Schema.Struct({
  runId: uuid({ description: 'Run id (UUID) of an automation run' }),
}).annotate({ identifier: 'AdminReportRunParams' })

/** @public */
export type AdminReportRunParams = typeof reportRunParamsSchema.Type

/**
 * The answer of both reads: the prefilled bug report's address, flat so the
 * console can bind it as a link target directly.
 */
export const reportAddressResponseSchema = Schema.Struct({
  url: uri({
    description:
      'The prefilled new-issue address for the bug form, ready to open; opening it files nothing',
  }),
}).annotate({
  identifier: 'AdminReportAddressResponse',
  title: 'Report Address Response',
  description:
    'A prefilled bug report address for a failure that is the engine’s fault, built offline from what the server kept',
})

/** @public */
export type AdminReportAddressResponse = typeof reportAddressResponseSchema.Type

/**
 * The request read's answer for an internal error the operator can fix: the
 * code of the fix, and no address. The codes are the closed `OperatorFix`
 * vocabulary of `src/domain/errors/`, spelled here because a wire contract does
 * not import the error tree; the report read builds this body from an
 * `OperatorFix`, so a code added there and not here fails to compile.
 */
export const reportFixResponseSchema = Schema.Struct({
  fix: Schema.Literals([
    'missing-env',
    'invalid-env',
    'database-schema-drift',
    'database-unreachable',
    'database-resources',
  ]).annotate({
    description:
      'What the operator is to fix: `missing-env` (set the variable the error names), ' +
      '`invalid-env` (correct it), `database-schema-drift` (a table the app declares is missing ' +
      'from its database: restore it, or restart Sovrium so it migrates the schema), ' +
      '`database-unreachable` (check the database is running and DATABASE_URL is right) or ' +
      '`database-resources` (free disk space or connections, or fix the database file permissions)',
  }),
}).annotate({
  identifier: 'AdminReportFixResponse',
  title: 'Report Fix Response',
  description:
    'The fix for an internal error that is the operator’s to fix rather than the engine’s; no bug report is offered for it',
})

/** @public */
export type AdminReportFixResponse = typeof reportFixResponseSchema.Type

/**
 * The answer of the request read: the report address for an engine defect, or
 * the fix for a failure the operator can fix — never both keys.
 */
export const reportRequestResponseSchema = Schema.Union([
  reportAddressResponseSchema,
  reportFixResponseSchema,
]).annotate({
  identifier: 'AdminReportRequestResponse',
  title: 'Request Report Response',
  description:
    'The bug report address of an engine defect the server answered under the request id, or the fix of a failure the operator can fix',
})

/** @public */
export type AdminReportRequestResponse = typeof reportRequestResponseSchema.Type
