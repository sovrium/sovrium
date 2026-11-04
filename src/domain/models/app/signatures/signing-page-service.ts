/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The signing page a link opens, as rules: which declared pages are signing
 * pages, the address a page moves to once its link was exchanged for a
 * session, how long that session lives, when a session still shows its page,
 * what its components read as `$signing`, and how a `$signing.<path>`
 * reference prints.
 *
 * Pure: the caller reads the rows, the record, the document and the clock.
 */

import { SIGNING_TOKEN_SEGMENT } from './signature-request-service'
import type { SigningContext } from '@/domain/models/api/signatures/common'
import type { App } from '@/domain/models/app'

/**
 * The word a signing page's address carries in its `:token` segment once the
 * link was exchanged for a session. A link token is 43 characters, so this
 * word is never one.
 */
export const SIGNING_SESSION_SEGMENT = 'session'

/** The longest a signing session lives, in seconds: thirty minutes. */
export const SIGNING_SESSION_MAX_AGE_SECONDS = 30 * 60

/**
 * The token-less address of a signing page reached at `requestPath`: the same
 * address with `session` in the segment the page's `:token` names, counted
 * from the end so a base path in front of the page keeps its place.
 */
export const signingSessionAddress = (requestPath: string, pagePath: string): string => {
  const pattern = pagePath.split('/')
  const fromEnd = pattern.length - 1 - pattern.indexOf(SIGNING_TOKEN_SEGMENT)
  const segments = requestPath.split('/')
  const at = segments.length - 1 - fromEnd
  return segments
    .map((segment, index) => (index === at ? SIGNING_SESSION_SEGMENT : segment))
    .join('/')
}

/** One page a flow opens its links on. */
export interface SigningPageRef {
  readonly name: string
  readonly path: string
}

/** The declared pages the flows of `app` name as `surface.page`, whose path carries `:token`. */
export const signingPagesOf = (app: App): readonly SigningPageRef[] => {
  const names = new Set((app.signatures ?? []).map((flow) => flow.surface.page))
  return (app.pages ?? []).flatMap((page) =>
    names.has(page.name) &&
    typeof page.path === 'string' &&
    page.path.split('/').includes(SIGNING_TOKEN_SEGMENT)
      ? [{ name: page.name, path: page.path }]
      : []
  )
}

/** Whether the page named `pageName` is the signing page of a flow of `app`. */
export const isSigningPageName = (app: App, pageName: string): boolean =>
  (app.signatures ?? []).some((flow) => flow.surface.page === pageName)

/**
 * How long a session opened at `nowMs` lives, in seconds: thirty minutes at
 * most, and never past any of `deadlines` (the request's and the link's).
 * Zero or less when one has passed.
 */
export const signingSessionLifetime = (
  nowMs: number,
  deadlines: readonly (string | undefined)[]
): number =>
  deadlines.reduce((lifetime, deadline) => {
    if (deadline === undefined) return lifetime
    const left = Math.floor((Date.parse(deadline) - nowMs) / 1000)
    return Number.isNaN(left) ? lifetime : Math.min(lifetime, left)
  }, SIGNING_SESSION_MAX_AGE_SECONDS)

/** Where a session's page stands, as its rows say. */
export interface SigningPageState {
  readonly requestStatus: string
  readonly signerStatus: string
  readonly requestExpiresAt?: string | undefined
}

/**
 * Whether a session still shows its signing page: its request has not ended
 * and is not past its deadline, and its signer is invited, verified or has
 * signed (her page then reads her as signed). Anything else is the neutral
 * not-found page.
 */
export const isSigningPageOpen = (state: SigningPageState, nowMs: number): boolean =>
  ['pending', 'signing', 'sealing'].includes(state.requestStatus) &&
  ['invited', 'verified', 'signed'].includes(state.signerStatus) &&
  (state.requestExpiresAt === undefined || Date.parse(state.requestExpiresAt) > nowMs)

/**
 * The number of pages of a PDF, read from its page tree without a parser: the
 * root `/Count`, else the `/Type /Page` objects. A frozen document is written
 * without object streams, so both are in the clear.
 */
export const pdfPageCount = (bytes: Uint8Array): number => {
  const text = new TextDecoder('latin1').decode(bytes)
  const counts = [...text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)].map((match) =>
    Number(match[1])
  )
  if (counts.length > 0) return Math.max(...counts)
  return Math.max(1, (text.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length)
}

/** A `$signing.<path>` reference in page text. */
const SIGNING_REFERENCE = /\$signing((?:\.[A-Za-z_][A-Za-z0-9_-]*)+)/g

/** A value as page text prints it: a string or number as written, a list joined, anything else empty. */
const printed = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(printed).join(', ')
  return ''
}

/** The value `path` (`signer.displayName`) names in `context`, or `undefined`. */
const valueAt = (context: SigningContext, path: readonly string[]): unknown =>
  path.reduce<unknown>(
    (node, key) =>
      node !== null && typeof node === 'object' && Object.hasOwn(node, key)
        ? (node as Readonly<Record<string, unknown>>)[key]
        : undefined,
    context
  )

/**
 * `text` with every `$signing.<path>` reference replaced by what it names in
 * `context`, through `encode` when the text is markup. A path naming nothing
 * (a record field the flow does not list, among others) prints empty.
 */
export const substituteSigningVars = (
  text: string,
  context: SigningContext,
  encode: (value: string) => string = (value) => value
): string =>
  text.includes('$signing')
    ? text.replace(SIGNING_REFERENCE, (_match, path: string) =>
        encode(printed(valueAt(context, path.slice(1).split('.'))))
      )
    : text

/** The verification channels a flow asks for, in the order they are asked. */
export const requiredChannelsOf = (
  verify: { readonly email?: boolean | undefined; readonly sms?: unknown } | undefined
): readonly ('email' | 'sms')[] => [
  ...(verify?.email === true ? (['email'] as const) : []),
  ...(verify?.sms === undefined ? [] : (['sms'] as const)),
]

/** Only the record fields a flow lists in `surface.fields`, as the record holds them now. */
export const listedRecordFields = (
  record: Readonly<Record<string, unknown>>,
  fields: readonly string[] | undefined
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    (fields ?? []).flatMap((field) =>
      Object.hasOwn(record, field) ? [[field, record[field]]] : []
    )
  )

/** What a signing page renders from: its `$signing` context, and the signer's stored signature. */
export interface SigningPage {
  readonly context: SigningContext
  /** The value stored in the signer's field, once she has signed. */
  readonly signedValue?: unknown
}
