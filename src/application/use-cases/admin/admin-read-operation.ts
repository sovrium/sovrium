/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape of one admin read operation — a `GET /api/admin/*` read described
 * once, so every surface that answers it is derived rather than re-written.
 *
 * One operation carries everything a surface needs and nothing a surface owns:
 *
 *   - the HTTP method and path the admin route mounts,
 *   - the MCP tool suffix, description and JSON input shape,
 *   - the request schemas and the response wire schema the OpenAPI fragment publishes,
 *   - the use-case binding: decode the raw request, run the read, and write the
 *     admin audit event the read owes (or none),
 *   - the one noun failure messages are built from.
 *
 * The binding is Hono-free and transport-free: it reads a plain record of raw parameters (the
 * query string and path params over HTTP, the tool arguments over MCP) and answers a closed
 * {@link AdminReadResult}. Mapping that result to a status code or a JSON-RPC error is each
 * surface's own job, in its own adapter — the HTTP one in `presentation/api/admin/`, the MCP one
 * in `presentation/api/mcp/`. Neither adapter knows any operation by name.
 *
 * The registry of operations is `admin-read-registry.ts`.
 */

import { Effect, Result, Schema } from 'effect'
import { EmitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import type { AdminReadError, AdminReadServices } from './admin-read-services'
import type { AuditLogRepository } from '@/application/ports/repositories/admin/audit-log-repository'
import type {
  AuthDatabaseError,
  AuthRepository,
} from '@/application/ports/repositories/auth/auth-repository'
import type { AuditTransport } from '@/domain/models/api/admin/audit-log/entry'
import type { Severity } from '@/domain/models/api/admin/envelope/severity'
import type { App } from '@/domain/models/app'

// ─── The surface-neutral contract ─────────────────────────────────────────────

/**
 * Why a request was refused before any read ran.
 *
 *   - `malformed` — a parameter outside what the read accepts.
 *   - `inverted-window` — a `from` later than its `to`.
 *   - `validation` — the request schema refused the parameters; the schema
 *     error is carried so the HTTP surface can answer its field-level body.
 */
export type AdminReadInvalidReason = 'malformed' | 'inverted-window' | 'validation'

/**
 * A refused request. `message` and `code` are the route's own words when it
 * names its refusal (`INVALID_FAMILY`); absent, each surface uses its default.
 */
export interface AdminReadInvalidInput {
  readonly _tag: 'InvalidInput'
  readonly reason: AdminReadInvalidReason
  readonly message?: string
  readonly code?: string
  /** The request schema's error, for `reason: 'validation'`. */
  readonly schemaError?: unknown
}

/**
 * A body that is TEXT, not JSON — the markdown and CSV exports. Each surface
 * answers `body` verbatim: HTTP with `contentType` (plus any `headers`, such as
 * a download's `Content-Disposition`), MCP as the tool's text part.
 */
export interface AdminReadTextBody {
  readonly kind: 'text'
  readonly contentType: string
  readonly body: string
  /** HTTP-only response headers; MCP ignores them. */
  readonly headers?: Readonly<Record<string, string>>
}

/** Wrap a text body so both surfaces answer it verbatim rather than as JSON. */
export const adminReadText = (
  contentType: string,
  body: string,
  headers?: Readonly<Record<string, string>>
): AdminReadTextBody => ({
  kind: 'text',
  contentType,
  body,
  ...(headers === undefined ? {} : { headers }),
})

/**
 * A NAMED policy refusal of a resource the caller may otherwise read (a body
 * reveal while capture is off) — naming the gate enumerates nothing. HTTP
 * answers `status` with `body`; MCP carries `reason` in the error message.
 */
export interface AdminReadRefusal {
  readonly _tag: 'Refused'
  readonly status: 403
  readonly body: unknown
  readonly reason: string
}

/** Whether an `Ok` body is a text body rather than a JSON value. */
export const isAdminReadText = (body: unknown): body is AdminReadTextBody =>
  typeof body === 'object' &&
  body !== null &&
  (body as { readonly kind?: unknown }).kind === 'text' &&
  typeof (body as { readonly body?: unknown }).body === 'string' &&
  typeof (body as { readonly contentType?: unknown }).contentType === 'string'

/**
 * What an admin read answers, whatever surface asked.
 *
 *   - `Ok` — the body, already validated against the response wire schema.
 *   - `InvalidInput` — a parameter the request schema refuses (HTTP 400).
 *   - `NotFound` — the anti-enumeration answer: an unknown id and a malformed
 *     one alike, and no audit event (HTTP 404).
 *   - `Refused` — a named policy refusal (see {@link AdminReadRefusal}).
 *   - `ValidationFailed` — the assembled body failed its own wire schema
 *     (HTTP 500, logged with the schema error).
 */
export type AdminReadResult =
  | { readonly _tag: 'Ok'; readonly body: unknown }
  | AdminReadInvalidInput
  | { readonly _tag: 'NotFound' }
  | AdminReadRefusal
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/** The store failures and services an admin read may involve (one list per area). */
export type { AdminReadError, AdminReadServices } from './admin-read-services'

/** One request, as either surface hands it over. */
export interface AdminReadRequest {
  readonly app: App
  /**
   * Raw parameters, already projected onto the operation's declared
   * {@link AdminReadOperation.parameterNames} — nothing else reaches the decoder.
   */
  readonly raw: Readonly<Record<string, unknown>>
  /** The authenticated admin the audit event is attributed to. */
  readonly actorUserId: string
  /** The canal the audit event records. */
  readonly transport: AuditTransport
}

/** The tool's JSON Schema input shape, as advertised over MCP `tools/list`. */
export interface AdminReadToolInputSchema {
  readonly type: 'object'
  readonly properties: Readonly<Record<string, unknown>>
  readonly required?: ReadonlyArray<string>
}

/** What the OpenAPI fragment publishes for the operation. */
export interface AdminReadOpenApi {
  readonly summary: string
  readonly description: string
  readonly operationIdBase: string
  readonly querySchema?: Schema.Top
  readonly paramsSchema?: Schema.Top
  readonly responseSchema: Schema.Top
  readonly responseDescription: string
  /** Literal OpenAPI query parameters, for a read with no query schema; ignored beside one. */
  readonly queryParameters?: ReadonlyArray<Readonly<Record<string, unknown>>>
  /** The 400 description, for a read that refuses a query without a query schema. */
  readonly badRequestDescription?: string
  /** `false` for a lenient query schema the read never refuses: no 400 is published. */
  readonly refusesQuery?: false
  /** A non-JSON media type (`text/markdown`): the 200 is then a plain string. */
  readonly responseContentType?: string
  /**
   * Named base schemas the response EXTENDS (an `allOf` reference by name) that
   * no other operation publishes, so the document declares them alongside it —
   * the bucket and submission admin items extend `Bucket` and `FormSubmission`.
   */
  readonly baseSchemas?: ReadonlyArray<Schema.Top>
}

/** How the HTTP surface caches a successful read. Default: `no-store`. */
export interface AdminReadHttpOptions {
  /**
   * Tag the 200 with an ETag and answer `If-None-Match` with 304, leaving out
   * the listed top-level keys (a per-request `generatedAt`) from the tag.
   */
  readonly conditional?: { readonly ignoreKeys?: ReadonlyArray<string> }
}

/** One admin read, described once. */
export interface AdminReadOperation {
  /** Stable identifier — the registry key and the span attribute. */
  readonly id: string
  readonly method: 'get'
  /** The route path in Hono form (`/api/admin/x/:id`). */
  readonly path: string
  /** Path parameter names, in path order. */
  readonly pathParams: ReadonlyArray<string>
  /** Query parameter names the route reads — an ALLOW-LIST. */
  readonly queryParams: ReadonlyArray<string>
  /** Every name the decoder may see: path params then query params. */
  readonly parameterNames: ReadonlyArray<string>
  readonly tool: {
    /** The name after `{app}_admin_`. */
    readonly suffix: string
    readonly description: string
    readonly inputSchema: AdminReadToolInputSchema
  }
  readonly openapi: AdminReadOpenApi
  readonly http?: AdminReadHttpOptions
  /** The noun failure messages are built from (`Failed to build <subject>`). */
  readonly subject: string
  /** The admin audit action a successful read writes, or `undefined` for none. */
  readonly auditAction: string | undefined
  /** Decode, read, audit. Never fails on input; fails only on the store. */
  readonly run: (
    request: AdminReadRequest
  ) => Effect.Effect<AdminReadResult, AdminReadError, AdminReadServices>
}

// ─── Building an operation ────────────────────────────────────────────────────

/** A decoded request, or the reason it was refused. */
export type AdminReadDecode<I> =
  { readonly _tag: 'Ok'; readonly input: I } | AdminReadInvalidInput | { readonly _tag: 'NotFound' }

/** One more audit event a successful read owes, on the same resource. */
export interface AdminReadExtraAudit {
  readonly action: string
  readonly severity: Severity
}

/**
 * What a read itself answers, before the audit step. An `Ok` may name further
 * audit events the read owes beyond its own (the critical body-reveal event).
 */
export type AdminReadOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: unknown
      readonly alsoAudit?: ReadonlyArray<AdminReadExtraAudit>
    }
  | { readonly _tag: 'NotFound' }
  | AdminReadRefusal
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/** An operation as authored: typed by its decoded input `I`. */
export interface AdminReadDefinition<I> extends Omit<
  AdminReadOperation,
  'run' | 'parameterNames' | 'auditAction'
> {
  /** Decode the raw parameters; `app` is the live config, for existence checks. */
  readonly decode: (raw: Readonly<Record<string, unknown>>, app: App) => AdminReadDecode<I>
  readonly read: (
    app: App,
    input: I,
    request: AdminReadRequest
  ) => Effect.Effect<AdminReadOutcome, AdminReadError, AdminReadServices>
  /** The audit event a successful read writes; omit when the route writes none. */
  readonly audit?: {
    readonly action: string
    readonly resourceId: (app: App, input: I, request: AdminReadRequest) => string
  }
}

/**
 * Write the admin audit event a successful read owes, attributed to the
 * caller. An unreadable actor fails the read, as it always failed the route;
 * the write itself is total (the store absorbs and logs its own failures).
 */
const emitReadAudit = (
  request: AdminReadRequest,
  resourceId: string,
  events: ReadonlyArray<AdminReadExtraAudit>
): Effect.Effect<void, AuthDatabaseError, AuthRepository | AuditLogRepository> =>
  Effect.gen(function* () {
    const actor = yield* resolveActor(request.actorUserId)
    yield* Effect.forEach(
      events,
      (event) =>
        EmitAuditEvent({
          action: event.action,
          actor,
          resourceId,
          severity: event.severity,
          result: 'success',
          transport: request.transport,
        }),
      { discard: true }
    )
  })

/** The audit events an answered read owes: its own, then any the read named. */
const readAuditEvents = (
  action: string,
  outcome: Extract<AdminReadOutcome, { readonly _tag: 'Ok' }>
): ReadonlyArray<AdminReadExtraAudit> => [
  { action, severity: 'info' },
  ...(outcome.alsoAudit ?? []),
]

/**
 * Close an authored definition over its input type, yielding the
 * surface-neutral {@link AdminReadOperation} both adapters consume.
 *
 * The audit event is written ONLY on `Ok`: a refused, not-found or
 * schema-failed read writes none — the not-found case in particular, since an
 * audit row per probe would itself be an enumeration surface.
 */
export const defineAdminRead = <I>(definition: AdminReadDefinition<I>): AdminReadOperation => {
  const { decode, read, audit, ...described } = definition
  return {
    ...described,
    parameterNames: [...definition.pathParams, ...definition.queryParams],
    auditAction: audit?.action,
    run: (request) =>
      Effect.gen(function* () {
        const decoded = decode(request.raw, request.app)
        if (decoded._tag !== 'Ok') return decoded
        const outcome = yield* read(request.app, decoded.input, request)
        if (outcome._tag === 'Ok' && audit !== undefined) {
          yield* emitReadAudit(
            request,
            audit.resourceId(request.app, decoded.input, request),
            readAuditEvents(audit.action, outcome)
          )
        }
        return outcome
      }).pipe(
        Effect.withSpan('admin.read-operation', {
          attributes: { 'admin.read.operation': definition.id, transport: request.transport },
        })
      ),
  }
}

// ─── Decoding a query through its wire schema ─────────────────────────────────

/**
 * The raw parameters as a query string would carry them: absent keys dropped,
 * and a number or boolean an MCP client sent written as the string an HTTP
 * query would have carried — so one schema decodes both surfaces alike.
 */
export const asQueryRecord = (
  raw: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(raw)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [
        key,
        typeof value === 'number' || typeof value === 'boolean' ? String(value) : value,
      ])
  )

/**
 * Decode the raw parameters through a request schema. A refusal carries the
 * schema error, so the HTTP surface answers the field-level 400 its validator
 * always answered.
 */
export const decodeAdminReadQuery = <A, I>(
  schema: Schema.Codec<A, I, never, never>,
  raw: Readonly<Record<string, unknown>>
): AdminReadDecode<A> => {
  const decoded = Schema.decodeUnknownResult(schema)(asQueryRecord(raw))
  return Result.isSuccess(decoded)
    ? { _tag: 'Ok', input: decoded.success }
    : { _tag: 'InvalidInput', reason: 'validation', schemaError: decoded.failure }
}

/**
 * Validate an assembled body against its response wire schema: `Ok` with the
 * decoded body, or `ValidationFailed` carrying the schema error.
 */
export const answerWithSchema = <S extends Schema.Top>(
  schema: S,
  body: unknown
): AdminReadOutcome => {
  const decoded = decodeSafe(schema)(body)
  return decoded.success
    ? { _tag: 'Ok', body: decoded.data }
    : { _tag: 'ValidationFailed', error: decoded.error }
}

/**
 * Params schema for path segments with no wire schema. Return type inferred ON PURPOSE: an explicit
 * generic `Schema.Struct<Record<K, Schema.String>>` makes `functional/prefer-immutable-types` cache
 * it as "Mutable" process-wide, and every Effect Schema struct linted after it reports so too.
 */
export const adminReadPathParams = <const K extends string>(
  descriptions: Readonly<Record<K, string>>
) =>
  Schema.Struct(
    Object.fromEntries(
      Object.entries<string>(descriptions).map(([name, description]) => [
        name,
        Schema.String.annotate({ description }),
      ])
    ) as Record<K, Schema.String>
  )
