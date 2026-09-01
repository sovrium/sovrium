/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `link/create`, `link/update` and `link/delete` action handlers — mint,
 * re-point and retire a tracked short link from a workflow.
 *
 * ── These handlers own no write rules ──────────────────────────────────────
 *
 * Every one of them calls the SAME `createLink` / `updateLink` / `deleteLink`
 * use-case the admin console's mutation routes call, and that is the entire
 * design. A handler with its own write path would have to re-derive the
 * reserved-slug refusal, the config-declared-slug refusal and the soft-delete
 * semantics, and a second copy of a guard is a guard that eventually disagrees
 * with the first. The direction it disagrees in is the one that matters here:
 * an automation minting over a slug `app.links[]` owns, discovered weeks later
 * from a campaign report with a hole in it.
 *
 * So the only things these handlers do are read props, hand them over, and
 * render the answer.
 *
 * ── Templates are already resolved ─────────────────────────────────────────
 *
 * The run loop's `resolveActionPropsForDispatch` pass walks the props deeply
 * before dispatch, so `product-{{trigger.record.handle}}` is concrete by the
 * time anything here runs. That pass maps STRINGS only, which is what lets the
 * readers below keep `null` distinguishable from absence — the two are
 * different instructions on a sparse update and collapsing them would make an
 * operator note impossible to remove once written.
 *
 * The shape of the resolved value is checked by the use-case, not here: a
 * template is deliberately not a legal slug, so the check has to happen after
 * interpolation, and putting it in the shared write path is what makes it
 * impossible for a caller to skip. See `use-cases/links/resolved-value.ts`.
 *
 * ── The output is the reason the action exists ─────────────────────────────
 *
 * Without an address handed back, a workflow could mint a link and have no way
 * to send it to anyone — which is the only reason it was minting one. Both
 * URLs are ABSOLUTE, because they are destined for an email body, an SMS or a
 * PDF, where a root-relative `/l/x` has no page to resolve against and is a
 * dead string. That failure surfaces at the recipient, never in a test, which
 * is why the origin is taken from the `ServerOrigin` port — the origin the
 * instance actually bound — rather than assembled from `PORT`.
 *
 * Wave: [internal ref].
 */

import { Effect } from 'effect'
import { ServerOrigin } from '@/application/ports/services/server-origin'
import {
  createLink,
  deleteLink,
  updateLink,
  UTM_FIELDS,
  type LinkMutationConflictError,
  type LinkUtmPatch,
  type LinkValueRejectedError,
} from '@/application/use-cases/links'
import type { ActionHandler, ActionOutcome } from './shared'
import type {
  LinkDbError,
  LinkNotFoundError,
  LinkUtmRecord,
} from '@/application/ports/repositories/links/link-repository'

/** The fixed, non-configurable base path a link is served at. */
const LINK_PREFIX = '/l/'

/** The QR suffix the `/l/:token` handler discriminates on. */
const QR_SUFFIX = '.svg'

/** Read a prop that must be a concrete string, or `undefined` when absent. */
const optionalString = (
  props: Readonly<Record<string, unknown>>,
  key: string
): string | undefined => (typeof props[key] === 'string' ? (props[key] as string) : undefined)

/**
 * Read a prop where `null` is a distinct instruction from absence.
 *
 * Absent leaves the column alone; `null` clears it. Anything else that is not
 * a string is treated as absent rather than as a clear — an accidental number
 * should not silently erase a title.
 */
const nullableString = (
  props: Readonly<Record<string, unknown>>,
  key: string
): string | null | undefined => {
  if (!(key in props)) return undefined
  const value = props[key]
  if (typeof value === 'string') return value
  // eslint-disable-next-line unicorn/no-null -- `null` IS the instruction: it is what clears the column, and `undefined` would mean the opposite
  return value === null ? null : undefined
}

/** Read the filing tags, dropping anything a template did not resolve to text. */
const stringArray = (
  props: Readonly<Record<string, unknown>>,
  key: string
): readonly string[] | undefined => {
  const value = props[key]
  if (!Array.isArray(value)) return undefined
  return value.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * The campaign block a CREATE declares.
 *
 * A create has nothing to merge against, so a non-string value is simply not a
 * parameter rather than an instruction to remove one — the same rule
 * `utmRecordFromFlat` applies on the console path, restated for the nested
 * shape an action declares.
 */
const utmRecord = (props: Readonly<Record<string, unknown>>): LinkUtmRecord | undefined => {
  const raw = props['utm']
  if (typeof raw !== 'object' || raw === null) return undefined
  const block = raw as Record<string, unknown>
  const entries = UTM_FIELDS.map(([, key]) => [key, block[key]] as const).filter(
    (entry) => typeof entry[1] === 'string'
  )
  return entries.length === 0 ? undefined : (Object.fromEntries(entries) as LinkUtmRecord)
}

/**
 * The campaign block an UPDATE patches, SPARSELY.
 *
 * Presence is decided by the key being declared, not by its value being
 * useful: `{ term: null }` clears `term`, while a block that never mentions
 * `term` leaves it alone. `mergeUtmPatch`, inside the use-case, does the
 * merging — the step has not read the row and must not have to.
 */
const utmPatch = (props: Readonly<Record<string, unknown>>): LinkUtmPatch | undefined => {
  const raw = props['utm']
  if (typeof raw !== 'object' || raw === null) return undefined
  const block = raw as Record<string, unknown>
  const entries = UTM_FIELDS.filter(([, key]) => key in block).map(
    // eslint-disable-next-line unicorn/no-null -- anything that is not a string reads as a removal, which is what makes `null` the documented way to clear one
    ([, key]) => [key, typeof block[key] === 'string' ? (block[key] as string) : null] as const
  )
  return entries.length === 0 ? undefined : (Object.fromEntries(entries) as LinkUtmPatch)
}

/**
 * Everything the three write programs can fail with.
 *
 * Spelled as a union rather than accepted structurally so the renderer below
 * is exhaustive: a future refusal added to the use-case fails to compile here
 * instead of silently rendering as a generic message an author cannot act on.
 */
type LinkMutationFailure =
  LinkMutationConflictError | LinkValueRejectedError | LinkNotFoundError | LinkDbError

/**
 * Render a use-case refusal as a step failure.
 *
 * The conflict `code` is carried verbatim into the message because it is the
 * one token that distinguishes "the file owns that slug" from "a live link
 * already holds it" — two refusals an author fixes in completely different
 * ways. The admin route renders the same `code` into its 409 envelope; a step
 * has no status code to render it into, so the message is where it goes.
 */
const failureMessage = (operator: string, failure: Readonly<LinkMutationFailure>): string => {
  switch (failure._tag) {
    case 'LinkMutationConflictError':
      return `link.${operator} refused: ${failure.code} (slug '${failure.slug}')`
    case 'LinkValueRejectedError':
      return `link.${operator} refused: ${failure.reason}`
    case 'LinkNotFoundError':
      return `link.${operator} found no live link with slug '${failure.slug}'`
    case 'LinkDbError':
      return `link.${operator} failed: ${String(failure.cause)}`
  }
}

/** The absolute addresses a step hands to whatever sends the link onward. */
const addresses = (
  origin: string,
  slug: string
): { readonly shortUrl: string; readonly qrUrl: string } => ({
  shortUrl: `${origin}${LINK_PREFIX}${slug}`,
  qrUrl: `${origin}${LINK_PREFIX}${slug}${QR_SUFFIX}`,
})

/**
 * `link/create` — mint a link and hand back its address.
 *
 * `createdBy` is deliberately null rather than a prop: a workflow writes as
 * the system, and letting config name an arbitrary author would be an
 * attribution an operator could not trust.
 */
export const handleLinkCreate: ActionHandler = (action, app) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const slug = optionalString(props, 'slug') ?? ''
    const destination = optionalString(props, 'destination') ?? ''
    const utm = utmRecord(props)

    const result = yield* Effect.result(
      createLink({
        app,
        slug,
        destination,
        title: nullableString(props, 'title'),
        tags: stringArray(props, 'tags'),
        notes: nullableString(props, 'notes'),
        ...(utm === undefined ? {} : { utm }),
        // eslint-disable-next-line unicorn/no-null -- the port's column is nullable and a workflow has no author to record
        createdBy: null,
      })
    )
    if (result._tag === 'Failure') {
      return {
        status: 'failure',
        error: failureMessage('create', result.failure),
      } as const satisfies ActionOutcome
    }

    const origin = yield* (yield* ServerOrigin).current
    return {
      status: 'success',
      output: { slug: result.success.slug, destination, ...addresses(origin, result.success.slug) },
    } as const satisfies ActionOutcome
  })

/** `link/update` — apply a sparse edit; every prop left out is left alone. */
export const handleLinkUpdate: ActionHandler = (action, app) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const slug = optionalString(props, 'slug') ?? ''
    const utm = utmPatch(props)

    const result = yield* Effect.result(
      updateLink({
        app,
        slug,
        destination: optionalString(props, 'destination'),
        title: nullableString(props, 'title'),
        tags: stringArray(props, 'tags'),
        notes: nullableString(props, 'notes'),
        ...(utm === undefined ? {} : { utm }),
      })
    )
    if (result._tag === 'Failure') {
      return {
        status: 'failure',
        error: failureMessage('update', result.failure),
      } as const satisfies ActionOutcome
    }

    const origin = yield* (yield* ServerOrigin).current
    return {
      status: 'success',
      output: {
        slug: result.success.slug,
        destination: result.success.destination ?? '',
        ...addresses(origin, result.success.slug),
      },
    } as const satisfies ActionOutcome
  })

/**
 * `link/delete` — retire a link without erasing it.
 *
 * `changed: false` on a repeat is a SUCCESS, not a failure: the row is already
 * retired, which is what the step asked for. A workflow that runs twice must
 * not fail the second time.
 */
export const handleLinkDelete: ActionHandler = (action, app) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const slug = optionalString(props, 'slug') ?? ''

    const result = yield* Effect.result(deleteLink({ app, slug }))
    if (result._tag === 'Failure') {
      return {
        status: 'failure',
        error: failureMessage('delete', result.failure),
      } as const satisfies ActionOutcome
    }
    return {
      status: 'success',
      output: { slug, changed: result.success.changed },
    } as const satisfies ActionOutcome
  })
