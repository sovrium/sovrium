/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admission: which definition a slug resolves to, and whether this visitor may
 * pass it.
 *
 * Extracted verbatim from `route-setup/link-routes.ts` in W5c. Both questions
 * are answered BEFORE a destination is chosen and neither touches the response,
 * which is what makes them one module rather than two: a slug that resolves to
 * no definition and a gated slug with no password both end the request before
 * `resolveLinkOutcome` is ever asked where to send anyone.
 */

import { Effect, Layer } from 'effect'
import {
  LinkRepository,
  type LinkRecord,
} from '@/application/ports/repositories/links/link-repository'
import {
  buildEnvLookup,
  resolveEnvInString,
} from '@/application/use-cases/automations/resolve-env-vars'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { LinkRepositoryLive } from '@/infrastructure/database/repositories/links/link-repository-live'
import type { App } from '@/domain/models/app'
import type { ResolvableLink } from '@/domain/models/app/links/link-resolver'
import type { Context } from 'hono'

/**
 * The plaintext a gated link expects, resolved from `$env.`.
 *
 * The schema refuses a literal, so `link.password` is always a reference and
 * this is the only place the secret exists. Returns `undefined` when the link is
 * not gated; an EMPTY string when the variable is declared but unset, which
 * keeps the gate closed rather than accidentally opening it to everyone who
 * submits an empty form ({@link verifyPassword} rejects an empty expected value).
 */
export const gatePassword = (app: App, link: ResolvableLink): string | undefined =>
  link.password === undefined
    ? undefined
    : resolveEnvInString(link.password, buildEnvLookup(app.env, process.env))

/**
 * Whether the visitor supplied the right password.
 *
 * Length-independent comparison is not attempted: this is a shared link
 * password, not a per-user credential, and the rate limiting that would make a
 * timing attack the cheapest avenue does not exist here. What DOES matter is
 * that an unset variable never opens the gate.
 */
export const verifyPassword = (
  expected: string | undefined,
  supplied: string | undefined
): boolean => expected !== undefined && expected !== '' && supplied === expected

/** The password field of a submitted gate form, if any. */
export const submittedPassword = async (c: Context): Promise<string | undefined> => {
  if (c.req.method !== 'POST') return undefined
  const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>)
  const value = (body as Record<string, unknown>)['password']
  return typeof value === 'string' ? value : undefined
}

/** A resolvable definition plus the console overlay that may veto it. */
export interface ResolvedDefinition {
  readonly link: ResolvableLink
  readonly overlayDisabled: boolean
}

/** Translate a stored row into the shape the resolver already understands. */
const storedToResolvable = (row: LinkRecord): ResolvableLink => ({
  slug: row.slug,
  ...(row.destination === null ? {} : { to: row.destination }),
  ...(row.targets === null ? {} : { targets: row.targets }),
  lifecycle: {
    enabled: row.enabled,
    ...(row.validFrom === null ? {} : { validFrom: row.validFrom }),
    ...(row.validUntil === null ? {} : { validUntil: row.validUntil }),
    ...(row.maxClicks === null ? {} : { maxClicks: row.maxClicks }),
    ...(row.expiredTo === null ? {} : { expiredTo: row.expiredTo }),
  },
  ...(row.utm === null ? {} : { utm: row.utm }),
})

/**
 * Find the definition for a slug across BOTH populations.
 *
 * Config wins outright: a slug declared in `app.links[]` resolves from the file
 * and the stored row (if any) contributes only its `disabled_at` overlay. That
 * ordering is what makes the boot shadow sweep's bookkeeping true rather than
 * decorative — the sweep stamps rows the config has claimed precisely because
 * this function has stopped reading them.
 *
 * The DB is consulted ONLY on a config miss, so an app whose links are entirely
 * config-declared pays no query per redirect.
 */
export const resolveDeclaredOrStored = async (
  app: App,
  declared: ResolvableLink | undefined,
  slug: string
): Promise<ResolvedDefinition | undefined> => {
  const program = Effect.gen(function* () {
    const repository = yield* LinkRepository
    return yield* repository.findBySlug({ appName: app.name, slug })
  })

  const row = await Effect.runPromise(
    program.pipe(
      Effect.provide(LinkRepositoryLive.pipe(Layer.provide(DatabaseLive))),
      // A database that cannot answer must not take the config links down with
      // it: a config-declared link is fully resolvable from memory, so the
      // failure degrades the overlay, not the redirect.
      // effect-swallow: stated in full two lines up — a config-declared link resolves entirely from memory, so losing the database row costs the overlay and nothing else.
      Effect.orElseSucceed(() => undefined)
    )
  )

  const overlayDisabled = row?.disabledAt !== null && row?.disabledAt !== undefined

  if (declared !== undefined) return { link: declared, overlayDisabled }
  if (row === undefined || row.shadowedAt !== null) return undefined
  return { link: storedToResolvable(row), overlayDisabled }
}
