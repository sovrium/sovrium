/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { APIError, createAuthEndpoint, getSessionFromCtx } from 'better-auth/api'
import { Option, Schema } from 'effect'
import {
  DEVICE_NAME_MAX_LENGTH,
  DEVICE_RETURN_HEADER,
  DEVICE_RETURN_LOOPBACK,
  SOVRIUM_CLI_CLIENT_ID,
  deviceDecisionRequestSchema,
  deviceDecisionResponseSchema,
  isLoopbackRedirectUri,
} from '@/domain/models/api/auth/auth'
import type { DeviceCode } from 'better-auth/plugins'

/**
 * The loopback return of the device flow: a CLI on the person's own computer
 * names a listener on `127.0.0.1` when it asks for a code, the claimant decides
 * in one click at `/device/decide`, and the browser carries a single-use code
 * back to that listener. Expiry, polling, denial and the one-time claim stay
 * the plugin's own; this module adds only what the return needs.
 */

/** The grant-owned columns, as the adapter reads them back. */
export interface LoopbackFields extends Record<string, unknown> {
  readonly redirectUri?: string | null
  readonly deviceName?: string | null
  readonly returnCodeHash?: string | null
  readonly requestedAt?: Date | string | null
}

type LoopbackDeviceCode = DeviceCode & LoopbackFields

/** The plugin's schema fields for the four nullable loopback columns. */
export const LOOPBACK_DEVICE_CODE_FIELDS = {
  redirectUri: { type: 'string', required: false },
  deviceName: { type: 'string', required: false },
  returnCodeHash: { type: 'string', required: false },
  requestedAt: { type: 'date', required: false },
} as const

/** A single-use return code lives two minutes at most once issued. */
const RETURN_CODE_TTL_MS = 2 * 60 * 1000

const badRequest = (error: string, description: string): APIError =>
  new APIError('BAD_REQUEST', { error, error_description: description })

const invalidRequest = (description: string): APIError => badRequest('invalid_request', description)

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex')

/**
 * The raw body of the code request. The plugin's request schema strips the
 * fields it does not declare, and declaring them would take a Zod shape, so the
 * loopback fields are read from the untouched request (`cloneRequest` is on for
 * `/device/code`). JSON and form bodies are both accepted, as the plugin does.
 */
const readRawBody = async (request: Request | undefined): Promise<Record<string, unknown>> => {
  if (request === undefined) return {}
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  const text = await request.clone().text()
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(text))
  }
  try {
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const isAbsent = (value: unknown): boolean => value === undefined || value === null

/** The loopback fields of a code request, or the refusal they earn. */
const loopbackFieldsOf = (
  body: Record<string, unknown>
): { readonly redirectUri?: string; readonly deviceName?: string } => {
  const { redirect_uri: redirectUri, device_name: deviceName } = body
  if (
    !isAbsent(redirectUri) &&
    (typeof redirectUri !== 'string' || !isLoopbackRedirectUri(redirectUri))
  ) {
    throw invalidRequest(
      'redirect_uri must be http://127.0.0.1:<port>/callback or http://[::1]:<port>/callback, port 1024-65535'
    )
  }
  if (
    !isAbsent(deviceName) &&
    (typeof deviceName !== 'string' ||
      deviceName.length === 0 ||
      deviceName.length > DEVICE_NAME_MAX_LENGTH)
  ) {
    throw invalidRequest(`device_name must be 1 to ${DEVICE_NAME_MAX_LENGTH} characters`)
  }
  return {
    ...(typeof redirectUri === 'string' ? { redirectUri } : {}),
    ...(typeof deviceName === 'string' ? { deviceName } : {}),
  }
}

/**
 * The grant's `authorizeRequest`: for `sovrium-cli`, persist when the request
 * was made and — on a loopback request — where it returns and from which
 * machine, and promise the return with the header. A foreign client gets no
 * authorization, so the plugin's own `validateClient` refuses it.
 */
export const authorizeLoopbackRequest = async (input: {
  readonly ctx: { readonly request?: Request; setHeader: (name: string, value: string) => void }
  readonly request: { readonly client_id?: string }
}) => {
  if (input.request.client_id !== SOVRIUM_CLI_CLIENT_ID) return undefined
  const fields = loopbackFieldsOf(await readRawBody(input.ctx.request))
  if (fields.redirectUri !== undefined) {
    input.ctx.setHeader(DEVICE_RETURN_HEADER, DEVICE_RETURN_LOOPBACK)
  }
  return {
    clientId: SOVRIUM_CLI_CLIENT_ID,
    deviceCodeFields: {
      redirectUri: fields.redirectUri ?? null,
      deviceName: fields.deviceName ?? null,
      requestedAt: new Date(),
    },
  }
}

const isoOf = (value: Date | string | null | undefined, fallback: Date): string => {
  const date = value === null || value === undefined ? fallback : new Date(value)
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString()
}

/**
 * The grant's `getVerificationContext`, shown to the claimant only: whether
 * deciding returns the browser to the CLI, when the request was made, and the
 * machine it named. A row written before the loopback return has no
 * `requested_at`; its expiry is the closest honest time there is.
 */
export const loopbackVerificationContext = (record: Record<string, unknown>) => {
  const row = record as LoopbackDeviceCode
  return {
    mode: typeof row.redirectUri === 'string' ? 'loopback' : 'code',
    requested_at: isoOf(row.requestedAt, new Date(row.expiresAt)),
    ...(typeof row.deviceName === 'string' ? { device_name: row.deviceName } : {}),
  }
}

/**
 * The return-code check of `/device/api-key`, run before the one-time claim. A
 * request approved at `/device/decide` carries a return-code hash and redeems
 * with its code only: none answers `authorization_pending` (the browser has
 * not come back yet), a wrong one `invalid_grant`. Neither spends the request.
 * An expired request is left to the plugin, which answers `expired_token`; one
 * approved at the plain `/device/approve` carries no hash and polls as before.
 */
export const assertReturnCode = (record: LoopbackDeviceCode, code: string | undefined): void => {
  const expected = record.returnCodeHash
  if (typeof expected !== 'string' || new Date(record.expiresAt) < new Date()) return
  if (code === undefined) {
    throw badRequest('authorization_pending', 'Waiting for the browser to return to the CLI')
  }
  const actual = Buffer.from(sha256Hex(code), 'utf8')
  const stored = Buffer.from(expected, 'utf8')
  if (actual.length !== stored.length || !timingSafeEqual(actual, stored)) {
    throw badRequest('invalid_grant', 'Invalid return code')
  }
}

const normalizeUserCode = (userCode: string): string =>
  userCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

const decodeDecision = Schema.decodeUnknownOption(deviceDecisionRequestSchema)
const encodeDecision = Schema.encodeSync(deviceDecisionResponseSchema)

/** Where the browser goes next: the request's own listener, with the outcome. */
const redirectToOf = (redirectUri: string, param: 'code' | 'error', value: string): string => {
  const url = new URL(redirectUri)
  url.searchParams.set(param, value)
  return url.toString()
}

/** A loopback request the caller may decide: theirs, live, pending, with somewhere to return. */
type DecidableRequest = LoopbackDeviceCode & { readonly redirectUri: string }

/**
 * Refuse a decision the caller may not make. A code that does not exist and a
 * code the caller did not claim — nobody's yet, or somebody else's — answer
 * alike, before anything else is read off the row: the endpoint is no oracle
 * for which user codes are live. Only the claimant learns more: that the code
 * expired, that the request is a code-flow one (it has nowhere to return to),
 * or that it was already decided.
 */
const assertDecidable = (record: LoopbackDeviceCode | null, userId: string): DecidableRequest => {
  if (!record?.userId || record.userId !== userId) throw invalidRequest('Invalid user code')
  if (new Date(record.expiresAt) < new Date()) {
    throw badRequest('expired_token', 'User code has expired')
  }
  if (typeof record.redirectUri !== 'string') {
    throw invalidRequest('This request does not return to a CLI; approve it at /device/approve')
  }
  if (record.status !== 'pending') throw invalidRequest('Device code already processed')
  return record as DecidableRequest
}

/** The row update a decision makes: approval binds a return code and shortens the request's life. */
const decisionUpdate = (record: DecidableRequest, code: string | undefined) =>
  code === undefined
    ? { status: 'denied' }
    : {
        status: 'approved',
        returnCodeHash: sha256Hex(code),
        expiresAt: new Date(
          Math.min(new Date(record.expiresAt).getTime(), Date.now() + RETURN_CODE_TTL_MS)
        ),
      }

/**
 * `POST /device/decide` — the claimant's one-click decision on a loopback
 * request. Needs the session of the person who claimed the code (the plugin's
 * own claim, at the `GET /device` lookup), and decides a loopback request
 * once: the update is a compare-and-set on `pending` and the claimant, so two
 * decisions cannot both land.
 *
 * Approving stores the sha256 of a fresh 32-byte code, shortens the request's
 * life to two minutes at most, and answers the listener address carrying the
 * code; denying answers it carrying `error=access_denied`.
 */
export const buildDecideEndpoint = () =>
  createAuthEndpoint('/device/decide', { method: 'POST', requireHeaders: true }, async (ctx) => {
    const session = await getSessionFromCtx(ctx)
    if (!session) {
      throw new APIError('UNAUTHORIZED', {
        error: 'unauthorized',
        error_description: 'Sign in to decide this request',
      })
    }
    const request = decodeDecision(ctx.body)
    if (Option.isNone(request)) {
      throw invalidRequest("userCode and decision ('approve' or 'deny') are required")
    }
    const { userCode, decision } = request.value
    // Exact match on what the adapter returns, as the plugin's own lookup
    // does: a case-insensitive collation must not widen a code to its neighbours.
    const findByUserCode = async (value: string) => {
      const found = await ctx.context.adapter.findOne<LoopbackDeviceCode>({
        model: 'deviceCode',
        where: [{ field: 'userCode', value }],
      })
      return found?.userCode === value ? found : null
    }
    const record = assertDecidable(
      (await findByUserCode(userCode)) ?? (await findByUserCode(normalizeUserCode(userCode))),
      session.user.id
    )
    const code = decision === 'approve' ? randomBytes(32).toString('base64url') : undefined
    const decided = await ctx.context.adapter.incrementOne<LoopbackDeviceCode>({
      model: 'deviceCode',
      where: [
        { field: 'id', value: record.id },
        { field: 'status', value: 'pending' },
        { field: 'userId', value: session.user.id },
      ],
      increment: {},
      set: decisionUpdate(record, code),
    })
    if (!decided) throw invalidRequest('Device code already processed')
    ctx.setHeader('Cache-Control', 'no-store')
    ctx.setHeader('Pragma', 'no-cache')
    return ctx.json(
      encodeDecision({
        redirectTo:
          code === undefined
            ? redirectToOf(record.redirectUri, 'error', 'access_denied')
            : redirectToOf(record.redirectUri, 'code', code),
      })
    )
  })
