/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The report reads of the operator console, as registry entries: the
 * prefilled bug report address for an internal error the server answered under
 * a request id, and for a run the engine closed because it stopped on one —
 * and the two that take no id: the blank form of this installation, and the
 * report of the most recent internal error kept.
 *
 * Each address is built offline from what the server already KEPT (the error
 * class, its signature, the scrubbed frames) plus the installation facts — and
 * a request kept as the operator's to fix answers its fix instead — by
 * the same builders `sovrium report --request-id` uses, so the console and the
 * terminal give the same address for the same failure. Nothing is sent and
 * nothing is written: the operator opens the address and files it, or not.
 *
 * Every refusal is `NotFound` — a malformed id, an id nothing is kept under, a
 * run that finished or failed on its own step — so an id's shape or existence
 * reveals nothing (S1). Neither read writes an audit event: there is nothing
 * to audit in building an address.
 */

import { Effect, Option, Schema } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { AdminReadHost } from '@/application/ports/services/admin-read-host'
import {
  answerWithSchema,
  defineAdminRead,
  type AdminReadDecode,
  type AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'
import {
  installationReportUrl,
  runDefectReportUrl,
  serverFailureReportUrl,
} from '@/domain/kernel/url/issue-report-address'
import {
  reportAddressResponseSchema,
  reportRequestParamsSchema,
  reportRequestResponseSchema,
  reportRunParamsSchema,
  type AdminReportFixResponse,
} from '@/domain/models/api/admin/reports/report-address'
import {
  reportInstallationResponseSchema,
  reportLatestResponseSchema,
} from '@/domain/models/api/admin/reports/report-latest'
import type { OperatorFix } from '@/domain/errors/operator-fixable-error'

/** Decode one path parameter through its params schema; anything refused is `NotFound`. */
const decodeParam =
  <S extends Schema.Codec<Record<K, string>, unknown, never, never>, K extends string>(
    schema: S,
    name: K
  ) =>
  (raw: Readonly<Record<string, unknown>>): AdminReadDecode<string> =>
    Option.match(Schema.decodeOption(schema)({ [name]: raw[name] }), {
      onNone: () => ({ _tag: 'NotFound' }) as const,
      onSome: (params) => ({ _tag: 'Ok', input: params[name] }) as const,
    })

/**
 * The answer for a failure the operator can fix. Typed against the wire
 * contract, so a fix code the contract does not list fails to compile.
 */
const fixBody = (fix: OperatorFix): AdminReportFixResponse => ({ fix })

const requestReport = defineAdminRead<string>({
  id: 'reports.requests.read',
  method: 'get',
  path: '/api/admin/reports/requests/:requestId',
  pathParams: ['requestId'],
  queryParams: [],
  tool: {
    suffix: 'report_request_read',
    description:
      'The prefilled bug report address for an internal error this server answered under a request id, or the fix when the failure is the operator’s to fix, as GET /api/admin/reports/requests/:requestId answers it (admin-only, read-only; opening it files nothing).',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: {
          type: 'string',
          description: 'The requestId an internal error was answered with.',
        },
      },
      required: ['requestId'],
    },
  },
  openapi: {
    summary: 'Read the bug report address of a failed request',
    description:
      'The prefilled new-issue address for an internal error this server answered under the ' +
      'request id, built offline from what the server kept: the error class and signature, the ' +
      'in-repository frames and the installation facts, never the error message. A failure the ' +
      'operator can fix (their environment, their database) is answered `{ fix }` with the code ' +
      'of the fix instead, and no address. An id nothing is kept under and a malformed one are ' +
      'both answered 404. Admin only.',
    operationIdBase: 'getAdminRequestReport',
    paramsSchema: reportRequestParamsSchema,
    responseSchema: reportRequestResponseSchema,
    responseDescription: 'The report address, or the fix',
  },
  subject: 'request report',
  decode: decodeParam(reportRequestParamsSchema, 'requestId'),
  read: (_app, requestId) =>
    Effect.gen(function* () {
      const host = yield* AdminReadHost
      const kept = yield* host.findServerFailure(requestId)
      if (kept === undefined) return { _tag: 'NotFound' } as const
      if (kept.fix !== undefined) {
        return answerWithSchema(reportRequestResponseSchema, fixBody(kept.fix))
      }
      const facts = yield* host.issueReportFacts
      return answerWithSchema(reportRequestResponseSchema, {
        url: serverFailureReportUrl(kept, facts),
      })
    }),
})

const runReport = defineAdminRead<string>({
  id: 'reports.runs.read',
  method: 'get',
  path: '/api/admin/reports/runs/:runId',
  pathParams: ['runId'],
  queryParams: [],
  tool: {
    suffix: 'report_run_read',
    description:
      'The prefilled bug report address for an automation run the engine closed because it stopped on an internal error, as GET /api/admin/reports/runs/:runId answers it (admin-only, read-only; opening it files nothing).',
    inputSchema: {
      type: 'object',
      properties: { runId: { type: 'string', description: 'The run id.' } },
      required: ['runId'],
    },
  },
  openapi: {
    summary: 'Read the bug report address of a run that stopped on an internal error',
    description:
      'The prefilled new-issue address for a run the engine closed because it stopped on an ' +
      'internal error, naming the run and titled with the error class and signature — never ' +
      'the error message, the trigger payload or record data. An unknown or malformed run id, ' +
      'and a run that did not stop on an internal error, are all answered 404. Admin only.',
    operationIdBase: 'getAdminRunReport',
    paramsSchema: reportRunParamsSchema,
    responseSchema: reportAddressResponseSchema,
    responseDescription: 'The report address',
  },
  subject: 'run report',
  decode: decodeParam(reportRunParamsSchema, 'runId'),
  read: (_app, runId) =>
    Effect.gen(function* () {
      const run = yield* AutomationRunRepository.use((repo) => repo.findById(runId))
      if (run?.defect === undefined) return { _tag: 'NotFound' } as const
      const facts = yield* AdminReadHost.use((host) => host.issueReportFacts)
      return answerWithSchema(reportAddressResponseSchema, {
        url: runDefectReportUrl({ runId: run.id, ...run.defect }, facts),
      })
    }),
})

const NO_ARGUMENTS = { type: 'object', properties: {} } as const
const noInput = (): AdminReadDecode<undefined> => ({ _tag: 'Ok', input: undefined })

const installationReport = defineAdminRead<undefined>({
  id: 'reports.installation.read',
  method: 'get',
  path: '/api/admin/reports/installation',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'report_installation_read',
    description:
      'The blank bug report address for this installation, prefilled with its version, operating system, install channel and database and nothing else, as GET /api/admin/reports/installation answers it (admin-only, read-only; opening it files nothing).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Read the blank bug report address of this installation',
    description:
      'The new-issue address of the bug form, prefilled with the installation facts — the ' +
      'version, the operating system, the install channel and the database — and no title, no ' +
      'logs and nothing about the app, for reporting a problem when nothing failed on screen. ' +
      'Admin only.',
    operationIdBase: 'getAdminInstallationReport',
    responseSchema: reportInstallationResponseSchema,
    responseDescription: 'The report address',
  },
  subject: 'installation report',
  decode: noInput,
  read: () =>
    Effect.gen(function* () {
      const facts = yield* AdminReadHost.use((host) => host.issueReportFacts)
      return answerWithSchema(reportInstallationResponseSchema, {
        url: installationReportUrl(facts),
      })
    }),
})

const latestReport = defineAdminRead<undefined>({
  id: 'reports.latest.read',
  method: 'get',
  path: '/api/admin/reports/latest',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'report_latest_read',
    description:
      'The prefilled bug report address of the most recent internal error this server kept that is Sovrium’s to fix, with the request id it was answered under, as GET /api/admin/reports/latest answers it (admin-only, read-only; opening it files nothing).',
    inputSchema: NO_ARGUMENTS,
  },
  openapi: {
    summary: 'Read the bug report address of the latest internal error',
    description:
      'The prefilled new-issue address of the most recent internal error this server kept that ' +
      'is Sovrium’s to fix — the very address the request report read answers for it — and the ' +
      'request id it was answered under. Answered 404 when no such error is kept. Admin only.',
    operationIdBase: 'getAdminLatestReport',
    responseSchema: reportLatestResponseSchema,
    responseDescription: 'The report address and its request id',
  },
  subject: 'latest report',
  decode: noInput,
  read: () =>
    Effect.gen(function* () {
      const host = yield* AdminReadHost
      const kept = yield* host.findLatestServerFailure
      if (kept === undefined) return { _tag: 'NotFound' } as const
      const facts = yield* host.issueReportFacts
      return answerWithSchema(reportLatestResponseSchema, {
        url: serverFailureReportUrl(kept, facts),
        requestId: kept.requestId,
      })
    }),
})

/** The report reads, in the order MCP `tools/list` offers them. */
export const REPORTS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  requestReport,
  runReport,
  installationReport,
  latestReport,
]
