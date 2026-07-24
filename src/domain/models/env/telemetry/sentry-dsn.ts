/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface SentryDsn {
  readonly scheme: string
  readonly publicKey: string
  readonly host: string
  readonly port?: number
  readonly projectId: string
  readonly envelopeUrl: string
}

const invalidDsnMessage = (raw: string): string =>
  `Invalid Sentry DSN "${raw}" — expected <scheme>://<public_key>@<host>[:port]/<project_id>`

export const parseSentryDsn = (raw: string): SentryDsn => {
  const url = toUrl(raw)
  const publicKey = url.username
  const projectId = url.pathname.replace(/^\/+/, '').split('/')[0] ?? ''
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:'

  if (!isHttp || publicKey === '' || projectId === '') {
    throw new Error(invalidDsnMessage(raw))
  }

  const scheme = url.protocol.replace(':', '')
  const host = url.hostname
  const port = url.port === '' ? undefined : Number(url.port)
  const authority = port === undefined ? host : `${host}:${port}`
  const envelopeUrl = `${scheme}://${authority}/api/${projectId}/envelope/`

  return {
    scheme,
    publicKey,
    host,
    ...(port === undefined ? {} : { port }),
    projectId,
    envelopeUrl,
  }
}

const toUrl = (raw: string): URL => {
  try {
    return new URL(raw)
  } catch {
    throw new Error(invalidDsnMessage(raw))
  }
}
