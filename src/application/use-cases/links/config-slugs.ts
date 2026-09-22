/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading the running config's link declarations, and the reservation policy
 * that follows from them.
 *
 * `app.links[]` entries are resolved from memory and are rows nowhere, so the
 * only way to know a slug is spoken for by the file is to ask the file. Every
 * mutation path asks the same way, here, rather than each keeping its own copy
 * of the rule — a create that reserved a slug the update path would happily
 * overwrite is config mutation through a data-shaped side door.
 */

import { Effect } from 'effect'
import { RESERVED_LINK_SLUGS } from '@/domain/models/app/links/slug'
import { LinkMutationConflictError } from './errors'
import type { App } from '@/domain/models/app'
import type { Link } from '@/domain/models/app/links'

/** Every slug the running config declares. */
export const configSlugs = (app: App): ReadonlySet<string> =>
  new Set((app.links ?? []).map((link) => link.slug))

/** The config entry claiming a slug, when the file claims it at all. */
export const declaredLink = (app: App, slug: string): Link | undefined =>
  (app.links ?? []).find((link) => link.slug === slug)

/**
 * Refuse a slug the file owns.
 *
 * The guard every mutation shares. Update and delete need only this one: a
 * reserved slug could never have been minted in the first place, so a row can
 * never be sitting on one.
 */
export const ensureSlugNotConfigDeclared = (
  app: App,
  slug: string
): Effect.Effect<void, LinkMutationConflictError> =>
  configSlugs(app).has(slug)
    ? Effect.fail(new LinkMutationConflictError({ code: 'LINK_IS_CONFIG_DECLARED', slug }))
    : Effect.void.pipe(Effect.withSpan('links.ensure-slug-not-config-declared'))

/**
 * Refuse a slug that may not be MINTED — reserved first, then config-declared.
 *
 * The order is load-bearing and not alphabetical: a reserved slug is refused
 * whether or not the file also declares it, and naming the reservation is the
 * more useful of the two messages, because "edit the file" is advice that would
 * not help.
 */
export const ensureSlugMintable = (
  app: App,
  slug: string
): Effect.Effect<void, LinkMutationConflictError> =>
  RESERVED_LINK_SLUGS.has(slug)
    ? Effect.fail(new LinkMutationConflictError({ code: 'LINK_RESERVED_SLUG', slug }))
    : ensureSlugNotConfigDeclared(app, slug).pipe(Effect.withSpan('links.ensure-slug-mintable'))
