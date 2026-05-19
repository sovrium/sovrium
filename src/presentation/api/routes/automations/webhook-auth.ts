/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { resolveEnvInString } from '@/application/use-cases/automations/resolve-env-vars'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'


type Trigger = NonNullable<App['automations']>[number]['trigger']
type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

export type AuthResult = { readonly ok: true } | { readonly ok: false }

const constantTimeEquals = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a, 'utf8')
  const bufferB = Buffer.from(b, 'utf8')
  if (bufferA.length !== bufferB.length) {
    return timingSafeEqual(bufferA, bufferA) && false
  }
  return timingSafeEqual(bufferA, bufferB)
}

const resolveSecret = (
  value: string | undefined,
  envLookup: Readonly<Record<string, string>>
): string => (value === undefined ? '' : resolveEnvInString(value, envLookup))

const checkBearer = (
  c: Context,
  auth: { readonly token?: string; readonly prefix?: string },
  envLookup: Readonly<Record<string, string>>
): AuthResult => {
  const expectedToken = resolveSecret(auth.token, envLookup)
  if (expectedToken === '') return { ok: false }
  const header = c.req.header('Authorization') ?? ''
  const prefix = auth.prefix ?? 'Bearer'
  if (!header.startsWith(`${prefix} `)) return { ok: false }
  const supplied = header.slice(prefix.length + 1)
  return constantTimeEquals(supplied, expectedToken) ? { ok: true } : { ok: false }
}

const checkApiKey = (
  c: Context,
  auth: { readonly key?: string; readonly token?: string; readonly header?: string },
  envLookup: Readonly<Record<string, string>>
): AuthResult => {
  const expected = resolveSecret(auth.key ?? auth.token, envLookup)
  if (expected === '') return { ok: false }
  const headerName = auth.header ?? 'X-API-Key'
  const supplied = c.req.header(headerName) ?? ''
  if (supplied === '') return { ok: false }
  return constantTimeEquals(supplied, expected) ? { ok: true } : { ok: false }
}

const checkBasic = (
  c: Context,
  auth: { readonly username?: string; readonly password?: string },
  envLookup: Readonly<Record<string, string>>
): AuthResult => {
  const expectedUser = resolveSecret(auth.username, envLookup)
  const expectedPass = resolveSecret(auth.password, envLookup)
  if (expectedUser === '' || expectedPass === '') return { ok: false }
  const header = c.req.header('Authorization') ?? ''
  if (!header.startsWith('Basic ')) return { ok: false }
  const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8')
  const idx = decoded.indexOf(':')
  if (idx === -1) return { ok: false }
  const suppliedUser = decoded.slice(0, idx)
  const suppliedPass = decoded.slice(idx + 1)
  const userOk = constantTimeEquals(suppliedUser, expectedUser)
  const passOk = constantTimeEquals(suppliedPass, expectedPass)
  return userOk && passOk ? { ok: true } : { ok: false }
}

const checkHmac = (
  c: Context,
  rawBody: string,
  auth: {
    readonly secret?: string
    readonly algorithm?: string
    readonly header?: string
    readonly prefix?: string
  },
  envLookup: Readonly<Record<string, string>>
): AuthResult => {
  const secret = resolveSecret(auth.secret, envLookup)
  if (secret === '') return { ok: false }
  const algorithm = auth.algorithm ?? 'sha256'
  const headerName = auth.header ?? 'X-Signature'
  const supplied = c.req.header(headerName) ?? ''
  if (supplied === '') return { ok: false }
  const computed = createHmac(algorithm, secret).update(rawBody).digest('hex')
  const expected = (auth.prefix ?? '') + computed
  return constantTimeEquals(supplied, expected) ? { ok: true } : { ok: false }
}

export const runWebhookAuth = (
  c: Context,
  trigger: WebhookTrigger,
  rawBody: string,
  envLookup: Readonly<Record<string, string>>
): AuthResult => {
  const { auth } = trigger
  if (auth === undefined) return { ok: true }
  if (auth.type === 'bearer') return checkBearer(c, auth, envLookup)
  if (auth.type === 'apiKey') return checkApiKey(c, auth, envLookup)
  if (auth.type === 'basic') return checkBasic(c, auth, envLookup)
  if (auth.type === 'hmac') return checkHmac(c, rawBody, auth, envLookup)
  return { ok: false }
}
