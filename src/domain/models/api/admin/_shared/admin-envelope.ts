/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Canonical `_admin` envelope (CC-1).
 *
 * Every admin endpoint whose response items have a public counterpart
 * (automations runs, forms, buckets, etc.) MUST nest these operator-grade
 * extras under a single `_admin: { ... }` key on each item — never alongside
 * the public fields.
 *
 * Two canonical fields cover the operator's universal triage needs:
 *
 * - `lastModifiedBy`  — "who last touched this row?" Returned as the canonical
 *   `actorSchema` block. Null when the row was created by a system action
 *   (no prior mutation).
 *
 * - `deletedAt`       — "is this row soft-deleted?" Always present, null for
 *   active rows. Locked together with the `?include_deleted=true` opt-in so
 *   operators can sanity-check the filter applied without parsing the
 *   request URL.
 *
 * One optional `metadata` slot captures **domain-specific** extras (bucket
 * file count, form submission count, automation run trigger source). The
 * canonical block stays stable across every consumer; new domains add their
 * extras under `metadata.<key>` instead of expanding the canonical surface.
 * This guards against schema drift: the operator's expectation of which
 * fields an admin row carries is invariant across domains.
 *
 * **Field-naming lock** (cite this section in code review for any rename):
 *
 * - `lastModifiedBy`  — uses the existing `actorSchema` from `_shared/actor.ts`.
 *   NOT a string user id, NOT an email. The `actor` block is reused so the
 *   shape matches every admin actor field exactly.
 * - `deletedAt`       — ISO 8601 datetime, nullable. Mirrors the existing
 *   `record.deleted_at` pattern from the public records API.
 * - `metadata`        — escape hatch for domain-specific extras. Optional so
 *   domains without extras (the runs list) do not need to emit an empty bag.
 *
 * @see [internal ref] D3 — admin endpoint as superset of public via `_admin` namespace
 */

import { z } from '@hono/zod-openapi'
import { actorSchema } from './actor'

/**
 * Canonical `_admin` envelope nested into every admin list/detail item that
 * has a public counterpart.
 *
 * This is the SCHEMA — consumers `.extend({ _admin: adminEnvelopeSchema })`
 * the public item schema rather than redefining a parallel admin schema.
 * That extension pattern is what gives [internal ref] D3 its drift guarantee:
 * canonical fields live in ONE source (the public schema) and the admin
 * variant adds operator extras without duplicating row shape.
 */
export const adminEnvelopeSchema = z
  .object({
    lastModifiedBy: actorSchema
      .nullable()
      .describe(
        'Canonical actor block for the most recent mutation against this resource. Null when the resource has not been mutated since creation.'
      ),
    deletedAt: z.iso
      .datetime()
      .nullable()
      .describe(
        'ISO 8601 UTC timestamp of soft-delete; null for active rows. Always present so the dashboard renders the soft-delete badge consistently — `_admin.deletedAt !== null` is the single source of truth across every domain.'
      ),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Domain-specific operator extras nested here so the canonical block stays stable across domains. Used by buckets (fileCount, totalBytes), forms (submissionCount), AI tool calls (cost-USD), etc. Omit when the domain has no extras.'
      ),
  })
  .openapi('AdminEnvelope')

/**
 * Resolved `_admin` envelope value type (post-default, post-parse).
 *
 * Use this instead of `z.input<...>` so callers see the runtime shape — the
 * `metadata` field is `Record<string, unknown> | undefined`, NOT the input
 * shape that would also accept `null` if the schema declared a default.
 * @public
 */
export type AdminEnvelope = z.infer<typeof adminEnvelopeSchema>
