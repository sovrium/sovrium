/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/audit-log/facets` — the values the audit
 * log's Actor and Action filters offer.
 *
 * WHY A READ OF ITS OWN
 * ---------------------
 * A filter control lists choices before the operator has narrowed anything,
 * so it cannot take them from the page of entries it filters: the first 200
 * rows name the actors of the last hour, not of last Tuesday. Nor can it take
 * them from a static list. The action catalogue names every action the binary
 * CAN write, most of which a given instance never has, and a choice that
 * always matches nothing is a dead end; the users list misses every actor
 * that is not an account (an API key, the MCP server, a background sweep).
 * So this read answers from the log itself: the actors and the actions that
 * appear in it, each with how many entries carry it.
 *
 * BOUNDED BY CONSTRUCTION
 * -----------------------
 * Two grouped queries over the log, each capped at {@link AUDIT_FACET_LIMIT}
 * values, most frequent first. The response carries no entry, no metadata and
 * no resource id: only who and what, which the list already shows in its
 * Actor and Action columns.
 *
 * Admin tier, like the list (404 for anyone else, S1).
 */

import { Schema } from 'effect'

/** The most values each facet lists. @public */
export const AUDIT_FACET_LIMIT = 200

const facetCount = Schema.Int.annotate({
  description: 'How many entries of the log carry this value.',
}).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1)))

/** One actor the log names, as the Actor filter offers it. @public */
export const auditLogActorFacetSchema = Schema.Struct({
  id: Schema.String.annotate({
    description:
      'The `actor.id` the entries carry, the value the list reads as `?actorId=`. Actors whose entries carry no id (an erased account) are not listed: there is nothing to filter them by.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  label: Schema.String.annotate({
    description:
      'The actor as the list shows it: the account email, else its name, else the actor type (`api-key`, `system`).',
    examples: ['camille.roux@atelier-nord.fr'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
  count: facetCount,
}).annotate({ identifier: 'AuditLogActorFacet' })

/** One action the log holds, as the Action filter offers it. @public */
export const auditLogActionFacetSchema = Schema.Struct({
  action: Schema.String.annotate({
    description:
      'The action, exactly as the entries carry it, the value the list reads as `?action=`.',
    examples: ['user.role.changed'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
  count: facetCount,
}).annotate({ identifier: 'AuditLogActionFacet' })

/** Response shape of `GET /api/admin/audit-log/facets`. @public */
export const auditLogFacetsResponseSchema = Schema.Struct({
  actors: Schema.Array(auditLogActorFacetSchema)
    .annotate({
      description:
        'The actors the log names, most entries first, at most 200. Empty on an empty log.',
    })
    .pipe(Schema.check(Schema.isMaxLength(AUDIT_FACET_LIMIT))),
  actions: Schema.Array(auditLogActionFacetSchema)
    .annotate({
      description:
        'The actions the log holds, most entries first, at most 200. Empty on an empty log.',
    })
    .pipe(Schema.check(Schema.isMaxLength(AUDIT_FACET_LIMIT))),
}).annotate({ identifier: 'AuditLogFacetsResponse' })

/** @public */
export type AuditLogFacetsResponse = typeof auditLogFacetsResponseSchema.Type
