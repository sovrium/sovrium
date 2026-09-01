/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Minting, re-pointing and retiring a runtime link.
 *
 * These three programs are the ONE place the write rules live. The admin
 * console reaches them through `POST/PATCH/DELETE /api/admin/links`; an
 * automation step reaches them directly. Both therefore refuse a reserved slug
 * the same way, refuse a config-declared slug the same way, and soft-delete the
 * same way — which is the entire point of the module existing, because a second
 * caller re-deriving those guards is a caller that will eventually get one of
 * them wrong and write over a link the file owns.
 *
 * Every refusal is a typed failure, never a status code: mapping a conflict to
 * 409 is the HTTP caller's job, and an automation step has no status codes to
 * map it to.
 *
 * The programs depend on the `LinkRepository` PORT and nothing else — no live
 * database handle, no Hono context — so an automation runtime provides the same
 * Layer the route does and gets identical behaviour.
 */

import { Effect } from 'effect'
import {
  LinkNotFoundError,
  LinkRepository,
  type CreateLinkInput,
  type LinkDbError,
  type LinkRecord,
  type UpdateLinkInput,
} from '@/application/ports/repositories/links/link-repository'
import { ensureSlugMintable, ensureSlugNotConfigDeclared } from './config-slugs'
import { LinkMutationConflictError } from './errors'
import { ensureDestinationWellFormed, ensureSlugWellFormed } from './resolved-value'
import { mergeUtmPatch, type LinkUtmPatch } from './utm'
import type { LinkValueRejectedError } from './errors'
import type { App } from '@/domain/models/app'

/**
 * What a caller supplies to mint a link.
 *
 * `appName` is replaced by the whole `app`, because the reservation guard needs
 * to read `app.links[]` and deriving the name from it is free.
 */
export interface CreateLinkCommand extends Omit<CreateLinkInput, 'appName'> {
  readonly app: App
}

/**
 * What a caller supplies to edit one.
 *
 * There is no `slug` change: a rename would break every share of the old
 * address and orphan the click history, which is keyed on the slug.
 *
 * `utm` is a sparse PATCH rather than a replacement block, and it is merged
 * against the stored value inside the program — the caller has not read the row
 * and must not have to.
 */
export interface UpdateLinkCommand extends Omit<UpdateLinkInput, 'appName' | 'utm'> {
  readonly app: App
  readonly utm?: LinkUtmPatch | undefined
}

/** The outcome of a soft delete: `changed: false` is an idempotent repeat. */
export interface DeleteLinkResult {
  readonly changed: boolean
}

/**
 * Mint a runtime link.
 *
 * The repository's own slug conflict is folded into the shared conflict
 * vocabulary so a caller branches on one error type rather than two that mean
 * the same thing to a user.
 */
export const createLink = (
  command: CreateLinkCommand
): Effect.Effect<
  LinkRecord,
  LinkMutationConflictError | LinkValueRejectedError | LinkDbError,
  LinkRepository
> =>
  Effect.gen(function* () {
    const { app, ...input } = command
    // Shape before ownership: "that is not a slug" is a more useful answer than
    // "that slug is taken" for a value that could never have been one.
    yield* ensureSlugWellFormed(input.slug)
    yield* ensureDestinationWellFormed(input.slug, input.destination)
    yield* ensureSlugMintable(app, input.slug)

    const repository = yield* LinkRepository
    return yield* repository
      .create({ appName: app.name, ...input })
      .pipe(
        Effect.catchTag('LinkSlugConflictError', () =>
          Effect.fail(new LinkMutationConflictError({ code: 'LINK_SLUG_TAKEN', slug: input.slug }))
        )
      )
  })

/**
 * Re-point or re-label an existing link.
 *
 * A slug with no live row fails with the port's `LinkNotFoundError` whether the
 * row was never there or the repository discovered it mid-write, so callers map
 * one absence to one answer instead of two.
 */
export const updateLink = (
  command: UpdateLinkCommand
): Effect.Effect<
  LinkRecord,
  LinkMutationConflictError | LinkValueRejectedError | LinkNotFoundError | LinkDbError,
  LinkRepository
> =>
  Effect.gen(function* () {
    const { app, utm: utmPatch, ...input } = command
    yield* ensureSlugWellFormed(input.slug)
    yield* ensureDestinationWellFormed(input.slug, input.destination)
    yield* ensureSlugNotConfigDeclared(app, input.slug)

    const repository = yield* LinkRepository
    const current = yield* repository.findBySlug({
      appName: app.name,
      slug: input.slug,
      source: 'db',
    })
    if (current === undefined) return yield* new LinkNotFoundError({ slug: input.slug })

    const utm = mergeUtmPatch(utmPatch, current.utm)
    return yield* repository.update({
      appName: app.name,
      ...input,
      ...(utm === undefined ? {} : { utm }),
    })
  })

/**
 * Retire a link without erasing it.
 *
 * Soft delete: the row survives so the click history it is keyed to survives
 * with it. A second call is a no-op reporting `changed: false`, which is what
 * lets a caller treat idempotency as success rather than as a failed retry.
 */
export const deleteLink = (input: {
  readonly app: App
  readonly slug: string
}): Effect.Effect<
  DeleteLinkResult,
  LinkMutationConflictError | LinkValueRejectedError | LinkNotFoundError | LinkDbError,
  LinkRepository
> =>
  Effect.gen(function* () {
    const { app, slug } = input
    yield* ensureSlugWellFormed(slug)
    yield* ensureSlugNotConfigDeclared(app, slug)

    const repository = yield* LinkRepository
    const current = yield* repository.findBySlug({
      appName: app.name,
      slug,
      source: 'db',
      includeArchived: true,
    })
    if (current === undefined) return yield* new LinkNotFoundError({ slug })
    if (current.deletedAt !== null) return { changed: false }

    yield* repository.archive({ appName: app.name, slug })
    return { changed: true }
  })
