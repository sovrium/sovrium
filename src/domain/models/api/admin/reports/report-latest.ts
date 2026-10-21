/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for the two report reads that take no id — reporting a problem
 * when nothing failed on screen:
 *
 *   - `GET /api/admin/reports/installation` — the blank bug form, prefilled
 *     with this installation's facts and nothing else. Answers
 *     {@link reportAddressResponseSchema}, the `{ url }` of the id reads.
 *   - `GET /api/admin/reports/latest` — the prefilled bug report of the most
 *     recent internal error this server kept that is Sovrium's to fix, with the
 *     request id it was answered under. Answers {@link reportLatestResponseSchema}.
 *
 * Source stories:
 *
 * ─── STILL AN ADDRESS, NEVER A SUBMISSION ──────────────────────────────────
 *
 * Both reads build a `https://github.com/sovrium/sovrium/issues/new?template=bug.yml&…`
 * address offline and file nothing, exactly as the id reads do. The
 * installation address carries the version, the install channel, the database
 * and the operating system — in their fields and in the `Environment:` block at
 * the head of `steps` — and no title, no logs, nothing about the app. The latest
 * address is the very address the request read answers for that request id.
 *
 * ─── AUTHORISATION ──────────────────────────────────────────────────────────
 *
 * Admin tier only, as every `/api/admin/reports/*` read. A member and an
 * anonymous caller get the anti-enumeration `404`. The latest read also answers
 * `404` when the server kept no internal error, or kept only failures the
 * operator can fix: a caller cannot tell "nothing kept" from "not allowed".
 */

import { Schema } from 'effect'
import { uri } from '@/domain/models/api/combinators/formats'
import { reportAddressResponseSchema } from './report-address'

/**
 * The answer of the latest read: the address, and the request it is about, so
 * a console can say which failure the report describes before it is opened.
 */
export const reportLatestResponseSchema = Schema.Struct({
  url: uri({
    description:
      'The prefilled new-issue address for the most recent internal error kept that is Sovrium’s to fix — the address the request report read answers for `requestId`; opening it files nothing',
  }),
  requestId: Schema.String.annotate({
    description:
      'The request id that failure was answered under, as its error body’s `requestId` and its `X-Request-Id` header named it',
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({
  identifier: 'AdminReportLatestResponse',
  title: 'Latest Report Response',
  description:
    'The prefilled bug report of the most recent engine defect this server kept, and the request it was answered under',
})

/** @public */
export type AdminReportLatestResponse = typeof reportLatestResponseSchema.Type

/** The installation read answers the same flat `{ url }` as the id reads. */
export const reportInstallationResponseSchema = reportAddressResponseSchema.annotate({
  identifier: 'AdminReportInstallationResponse',
  title: 'Installation Report Response',
  description:
    'The blank bug form address, prefilled with this installation’s version, install channel, database and operating system and nothing else',
})

/** @public */
export type AdminReportInstallationResponse = typeof reportInstallationResponseSchema.Type
