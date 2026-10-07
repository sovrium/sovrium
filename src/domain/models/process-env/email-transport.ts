/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { EMAIL_PROVIDERS } from './email'

/** The variable that selects the transport. */
export const EMAIL_PROVIDER_VAR = 'EMAIL_PROVIDER'

/** An HTTP email API, as opposed to SMTP. */
export type EmailApiProvider = Exclude<(typeof EMAIL_PROVIDERS)[number], 'smtp'>

/**
 * The transport outgoing email leaves through, resolved from the environment.
 *
 * `smtp` carries nothing: whether SMTP can send is still the presence of
 * `SMTP_HOST`, read by the nodemailer transport exactly as before. The three
 * HTTP transports carry their credentials and the base address requests go to
 * (`EMAIL_API_URL`, else the provider's own).
 */
export type EmailTransport =
  | { readonly kind: 'smtp' }
  | { readonly kind: 'brevo'; readonly apiKey: string; readonly baseUrl: string }
  | { readonly kind: 'resend'; readonly apiKey: string; readonly baseUrl: string }
  | {
      readonly kind: 'ses'
      readonly region: string
      readonly accessKeyId: string
      readonly secretAccessKey: string
      readonly baseUrl: string
    }

/** A resolved transport, or the sentence that refuses the configuration. */
export type EmailTransportResolution =
  | { readonly ok: true; readonly transport: EmailTransport }
  | { readonly ok: false; readonly message: string }

type Env = Readonly<Record<string, string | undefined>>

/** A set, trimmed value, or `undefined` for unset and blank alike. */
const read = (env: Env, name: string): string | undefined => {
  const value = env[name]?.trim()
  return value === undefined || value === '' ? undefined : value
}

const isEmailProvider = (value: string): value is (typeof EMAIL_PROVIDERS)[number] =>
  (EMAIL_PROVIDERS as readonly string[]).includes(value)

/** The base address of an HTTP transport, without a trailing slash. */
const baseUrlOf = (env: Env, fallback: string): string =>
  (read(env, 'EMAIL_API_URL') ?? fallback).replace(/\/+$/, '')

/** The credential variables each HTTP transport cannot send without. */
const REQUIRED_CREDENTIALS: Readonly<Record<EmailApiProvider, readonly string[]>> = {
  brevo: ['BREVO_API_KEY'],
  resend: ['RESEND_API_KEY'],
  ses: ['EMAIL_SES_REGION', 'EMAIL_SES_ACCESS_KEY_ID', 'EMAIL_SES_SECRET_ACCESS_KEY'],
}

/**
 * The refusal for a chosen transport that lacks credentials, naming every
 * missing variable so the operator fixes them in one pass.
 */
const missingCredentialsMessage = (
  provider: EmailApiProvider,
  missing: readonly string[]
): string => {
  const one = missing.length === 1
  return `${EMAIL_PROVIDER_VAR} is ${provider}, but ${missing.join(' and ')} ${one ? 'is' : 'are'} not set. Set ${one ? 'it' : 'them'}, or unset ${EMAIL_PROVIDER_VAR} to send over SMTP.`
}

const apiTransportOf = (provider: EmailApiProvider, env: Env): EmailTransport => {
  if (provider === 'brevo') {
    return {
      kind: 'brevo',
      apiKey: read(env, 'BREVO_API_KEY') ?? '',
      baseUrl: baseUrlOf(env, 'https://api.brevo.com/v3'),
    }
  }
  if (provider === 'resend') {
    return {
      kind: 'resend',
      apiKey: read(env, 'RESEND_API_KEY') ?? '',
      baseUrl: baseUrlOf(env, 'https://api.resend.com'),
    }
  }
  const region = read(env, 'EMAIL_SES_REGION') ?? ''
  return {
    kind: 'ses',
    region,
    accessKeyId: read(env, 'EMAIL_SES_ACCESS_KEY_ID') ?? '',
    secretAccessKey: read(env, 'EMAIL_SES_SECRET_ACCESS_KEY') ?? '',
    baseUrl: baseUrlOf(env, `https://email.${region}.amazonaws.com`),
  }
}

/**
 * Resolve `EMAIL_PROVIDER` and the credentials of the transport it names,
 * without throwing.
 *
 * Unset or blank is `smtp`, which behaves exactly as before the selector
 * existed. A provider key in the environment never selects a transport on its
 * own: `BREVO_API_KEY` is also what the Brevo library connection reads, and an
 * operator adding that connection must not silently move all their mail.
 */
export const resolveEmailTransport = (env: Env): EmailTransportResolution => {
  const raw = read(env, EMAIL_PROVIDER_VAR)?.toLowerCase() ?? 'smtp'
  if (!isEmailProvider(raw)) {
    return {
      ok: false,
      message: `${EMAIL_PROVIDER_VAR}="${raw}" names no email transport. Set it to one of ${EMAIL_PROVIDERS.join(', ')}, or unset it to send over SMTP.`,
    }
  }
  if (raw === 'smtp') return { ok: true, transport: { kind: 'smtp' } }
  const missing = REQUIRED_CREDENTIALS[raw].filter((name) => read(env, name) === undefined)
  return missing.length > 0
    ? { ok: false, message: missingCredentialsMessage(raw, missing) }
    : { ok: true, transport: apiTransportOf(raw, env) }
}

/**
 * {@link resolveEmailTransport} for the boot gate and the send path: throws,
 * naming the variable, on a value that names no transport and on a selected
 * HTTP transport whose credentials are missing — at boot, so the operator
 * learns it before the first message is lost rather than after.
 */
export const parseEmailTransport = (env: Env = process.env): EmailTransport => {
  const resolution = resolveEmailTransport(env)
  if (!resolution.ok) {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(resolution.message)
  }
  return resolution.transport
}

/**
 * Whether outgoing email can leave this process at all.
 *
 * For SMTP — the default — the presence of `SMTP_HOST` is still the switch:
 * there is no localhost fallback transport, so the host IS the configuration.
 * For an HTTP transport it is the selector plus its credentials, with or
 * without `SMTP_HOST`. A misconfigured selector answers `false`; boot refuses
 * that configuration anyway (see {@link parseEmailTransport}).
 *
 * Pure, and in the domain rather than beside the transport for a layering
 * reason: a route reads it (the mounted-app guard that hides a mail-gated
 * public path when no mail can be sent), and reaching the email area would put
 * a live transport in that route's import graph to answer a question about
 * environment variables.
 */
export const isOutgoingEmailConfigured = (env: Env): boolean => {
  const resolution = resolveEmailTransport(env)
  if (!resolution.ok) return false
  return resolution.transport.kind === 'smtp' ? read(env, 'SMTP_HOST') !== undefined : true
}
