/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The generated operation sets — every endpoint of a provider's API, as
 * `ConnectionOperation` values an operator can install onto a connection.
 *
 * ─── HOW A SET ATTACHES TO A CONNECTION ENTRY ──────────────────────────────
 *
 * By SLUG: the set `stripe` belongs to the entry `connection/stripe`. The set
 * never carries credentials and never installs a connection; it carries only
 * operations, their groups and their provenance. `library add stripe/<op>`
 * installs the connection entry if absent (it is the set's requirement, as a
 * recipe requires its connection) and appends the named operations to that
 * connection's `operations[]`; the connection entry's `baseUrl` is the one the
 * operations are called against. The set's own `baseUrl` is the vendor's,
 * recorded so the connection entry and the set can be checked against each
 * other.
 *
 * Operation ids are `<provider>/<name>`: `stripe/post-customers`. The name is
 * the operation's `name` field, unique within its set by construction.
 *
 * ─── LAZY, AND ONLY FROM THE TWO PERMITTED CALLERS ─────────────────────────
 *
 * [internal ref] A1.2 applies unchanged: this module is reached through an
 * `await import()` from the `library` commands or the docs renderer, never on
 * the `sovrium start` boot path. Importing it costs one path string per
 * provider — the `with { type: 'file' }` imports below embed the gzipped bytes
 * in the binary without reading them — and a set is read and decompressed only
 * when {@link loadOperationSet} is called for it.
 *
 * ─── ONE LITERAL SPECIFIER PER PROVIDER ────────────────────────────────────
 *
 * For the catalogue's reason: a computed specifier is not followed by the
 * bundler, and a directory listing sees `$bunfs` in the binary. The
 * `Library Operations` gate reconciles this table against the pinned sources
 * and the generated directory in both directions, so adding a provider fails
 * the build until its line is here.
 */

import brevo from '../generated/brevo.json.gz' with { type: 'file' }
import hubspot from '../generated/hubspot.json.gz' with { type: 'file' }
import lemlist from '../generated/lemlist.json.gz' with { type: 'file' }
import lucca from '../generated/lucca.json.gz' with { type: 'file' }
import mistral from '../generated/mistral.json.gz' with { type: 'file' }
import pennylane from '../generated/pennylane.json.gz' with { type: 'file' }
import stripe from '../generated/stripe.json.gz' with { type: 'file' }
import whatsapp from '../generated/whatsapp.json.gz' with { type: 'file' }
import type { ConnectionOperation } from '@/domain/models/app/connections/operations'

/** Provider slug → the embedded path of its gzipped set. */
const SET_PATHS = {
  brevo,
  hubspot,
  lemlist,
  lucca,
  mistral,
  pennylane,
  stripe,
  whatsapp,
} as const satisfies Readonly<Record<string, string>>

export type OperationProvider = keyof typeof SET_PATHS

/** Every provider that ships an operation set, sorted. */
export const OPERATION_PROVIDERS: readonly OperationProvider[] = Object.keys(SET_PATHS)
  .toSorted()
  .map((key) => key as OperationProvider)

/** A licence as the vendor states it, and where it states it. */
export interface OperationSetLicence {
  readonly where: string
  readonly name: string
  readonly url?: string
}

/** One provider's operations. Everything beside `operations` is metadata, never installed. */
export interface LibraryOperationSet {
  /** Bumped on any breaking change of this shape. */
  readonly format: number
  readonly provider: string
  /** The provider's name as the manual prints it. */
  readonly title: string
  /** The vendor's API reference — linked instead of any vendor prose. */
  readonly docsUrl: string
  /** The vendor's API root, as its specification or the overrides state it. */
  readonly baseUrl?: string
  readonly auth?: {
    readonly type: 'oauth2' | 'apiKey' | 'basic' | 'bearer' | 'tokenExchange'
    readonly header?: string
  }
  readonly rateLimit?: {
    readonly requestsPerSecond?: number
    readonly requestsPerMinute?: number
  }
  readonly source: {
    /** The UTC date the specification was pinned. */
    readonly fetchedOn: string
    /** Empty when the vendor states no licence for its specification. */
    readonly licence: readonly OperationSetLicence[]
    readonly files: readonly { readonly url: string; readonly sha256: string }[]
  }
  /** Group (the vendor's tag, or the path's resource) → operation names, both sorted. */
  readonly groups: Readonly<Record<string, readonly string[]>>
  /** Sorted by name; each is installable as written. */
  readonly operations: readonly ConnectionOperation[]
}

/** The embedded path of a provider's set, or `undefined` for a provider that ships none. */
export const operationSetPath = (provider: string): string | undefined =>
  Object.hasOwn(SET_PATHS, provider) ? SET_PATHS[provider as OperationProvider] : undefined

/**
 * Read one provider's set. Resolves `undefined` for a provider that ships
 * none, so a caller can print "no operations for X" rather than catch.
 */
export const loadOperationSet = async (
  provider: string
): Promise<LibraryOperationSet | undefined> => {
  const path = operationSetPath(provider)
  if (path === undefined) return undefined
  const bytes = await Bun.file(path).bytes()
  return JSON.parse(new TextDecoder().decode(Bun.gunzipSync(bytes))) as LibraryOperationSet
}

/** `stripe/post-customers` → `{ provider: 'stripe', name: 'post-customers' }`. */
export const parseOperationId = (
  id: string
): { readonly provider: string; readonly name: string } | undefined => {
  const match = /^([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)$/.exec(id)
  return match === null ? undefined : { provider: match[1] ?? '', name: match[2] ?? '' }
}
