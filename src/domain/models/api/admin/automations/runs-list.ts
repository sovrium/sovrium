/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/automations/runs` and the sibling detail
 * endpoint `GET /api/admin/automations/runs/:runId`.
 *
 * **The keystone of the admin list-endpoint pattern.**
 *
 * This is the first list-shape admin endpoint in Phase-0 with a public
 * counterpart at `/api/automations/runs`. It locks three ADR-012 binding
 * decisions simultaneously:
 *
 * - **D2** — soft-delete visibility default off. `?include_deleted=false` is
 *   the canonical default; opting in requires `?include_deleted=true`. The
 *   parameter parses without 400 even on tables that do not yet have a
 *   soft-delete column (forward contract per plan §4.3 risk #5) — the day
 *   `automation_runs` gains `deleted_at`, the AC sharpens.
 * - **D3** — `_admin` envelope as the canonical operator-extras namespace.
 *   Each item in the response carries `_admin: { auditTrailCount,
 *   lastModifiedBy, deletedAt }` (plus optional `metadata`). The shape is
 *   defined once in `_shared/admin-envelope.ts` (CC-1) and consumed via
 *   `.extend({ _admin: adminEnvelopeSchema })` here.
 * - **D9** — the canonical `createAdminListEndpoint` helper authored
 *   alongside this story at `src/presentation/api/admin/_shared/list-endpoint.ts`.
 *
 * **Schema-drift mitigation** (plan §6.5): the public `runSchema` from
 * `src/domain/models/api/automations/automations.ts` is the canonical source
 * of truth for the run row shape. This admin module **extends** it with the
 * `_admin` block — it does NOT redefine `id`, `status`, `startedAt`, etc.
 * Future field additions to the public schema flow through automatically;
 * drift is structurally impossible.
 *
 * Source story: docs/user-stories/as-business-admin/automations/automations-runs-list.md
 *
 * @see ADR-012 D2, D3, D9 — locked by this story
 * @see plan §4.3 — per-story design for US-ADMIN-AUTOMATIONS-RUNS-LIST
 * @see plan §5.1 — CC-1 shared `_admin` envelope (authored alongside)
 * @see plan §6.5 — schema reuse rule (extend, never duplicate)
 */

import { z } from '@hono/zod-openapi'
import {
  cursorPaginationQuerySchema,
  cursorPaginationResponseSchema,
} from '@/domain/models/api/_shared/cursor-pagination'
import { adminEnvelopeSchema } from '@/domain/models/api/admin/_shared/admin-envelope'
import { runSchema, runStatusSchema } from '@/domain/models/api/automations'

/**
 * Filter query parameters accepted by `GET /api/admin/automations/runs`.
 *
 * Extends the shared cursor pagination query (`cursor`, `limit`) with the
 * runs-specific filters: `status`, `automationName`, `from`/`to`, and the
 * D2-locked `include_deleted` opt-in.
 *
 * **Default `include_deleted=false`** is the D2 lock. The dashboard never
 * surfaces soft-deleted rows by default; auditors with a compliance need
 * pass `?include_deleted=true` explicitly. The Zod `.default(false)` is
 * applied at the schema layer so handlers never see `undefined`.
 *
 * Adding `?automationId=` (the public counterpart filters by name; admin
 * gets the id-shaped variant for stable cross-referencing with audit log
 * `resource.id`) is non-breaking — appending a sibling field on the query.
 */
export const automationsRunsListQuerySchema = cursorPaginationQuerySchema
  .extend({
    status: runStatusSchema
      .optional()
      .describe(
        'Filter by run status. Mirrors the public `?status` filter on `/api/automations/runs` so admin and public callers share one vocabulary.'
      ),
    automationName: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Filter by automation definition name (matches the `name` field in the app schema `automations[]` array). Mirrors the public `?automationName` filter.'
      ),
    automationId: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Filter by automation definition UUID. Admin-only — operators reading audit log entries scope by `resource.id` and the id is the stable cross-reference. Co-existing with `?automationName` is fine; both are AND-combined when both are provided.'
      ),
    from: z.iso
      .datetime()
      .optional()
      .describe(
        'Lower bound (inclusive) on `startedAt` as ISO 8601. Pair with `to` to scope to a custom window; pair with neither to scope to all history (subject to retention).'
      ),
    to: z.iso
      .datetime()
      .optional()
      .describe(
        'Upper bound (exclusive) on `startedAt` as ISO 8601. Returns 400 when `from > to`.'
      ),
    include_deleted: z
      .union([z.boolean(), z.string()])
      .transform((value) => {
        if (typeof value === 'boolean') return value
        return value === 'true' || value === '1'
      })
      .pipe(z.boolean())
      .default(false)
      .describe(
        'Include soft-deleted runs. Default `false` — the D2 lock. Pass `?include_deleted=true` to surface tombstones for compliance review. The flag parses without 400 even when the underlying table has no soft-delete column yet (forward-contract — see story §risks).'
      ),
  })
  .openapi('AutomationsRunsListQuery')

/**
 * Resolved query parameter values (post-default-fill, post-coercion).
 *
 * Use `z.infer` rather than `z.input` so call sites see the parsed type:
 * `cursor: string | undefined`, `limit: number` (default applied), and
 * `include_deleted: boolean` (default applied). Avoids the Story-#1 cache
 * regression where a transitive `z.input` made the helper config too narrow.
 * @public
 */
export type AutomationsRunsListQuery = z.infer<typeof automationsRunsListQuerySchema>

/**
 * Single admin run item — public `runSchema` extended with the `_admin`
 * envelope.
 *
 * The order of `.extend()` matters for OpenAPI naming: the resulting schema
 * is registered under `AutomationRunAdminItem` so client SDKs generate a
 * type that says "this is an automation run with admin extras", not just
 * "extended Run". The canonical fields (`id`, `status`, `startedAt`, ...)
 * are inherited verbatim from the public `runSchema`; the only addition is
 * the `_admin` block.
 */
export const automationRunAdminItemSchema = runSchema
  .extend({
    _admin: adminEnvelopeSchema,
  })
  .openapi('AutomationRunAdminItem')

/** @public */
export type AutomationRunAdminItem = z.infer<typeof automationRunAdminItemSchema>

/**
 * Cursor-paginated response shape for the list endpoint.
 *
 * Wraps the admin item schema with the canonical `{ items, nextCursor }`
 * envelope from `_shared/cursor-pagination.ts`. `nextCursor === null`
 * signals stream end; non-null is an opaque base64 token for the next
 * `?cursor=...` request.
 */
export const automationsRunsListResponseSchema = cursorPaginationResponseSchema(
  automationRunAdminItemSchema
).openapi('AutomationsRunsListResponse')

/** @public */
export type AutomationsRunsListResponse = z.infer<typeof automationsRunsListResponseSchema>

/**
 * Path parameter for the detail endpoint `GET /api/admin/automations/runs/:runId`.
 *
 * Validates the `:runId` placeholder as a UUID — the public `runSchema.id`
 * is `z.string().uuid()`, so the admin detail endpoint shares that constraint.
 * Invalid UUIDs return 400 (parameter validation) rather than 404; the
 * 404-vs-400 distinction is OK here because the parameter shape is publicly
 * known via the OpenAPI document and a 400 leaks no extra information about
 * which run ids exist.
 */
export const automationsRunsDetailParamsSchema = z
  .object({
    runId: z
      .string()
      .uuid()
      .describe('Run id (UUID) — matches `runSchema.id` from the public runs API.'),
  })
  .openapi('AutomationsRunsDetailParams')

/** @public */
export type AutomationsRunsDetailParams = z.infer<typeof automationsRunsDetailParamsSchema>

/**
 * Detail endpoint response shape — a single admin run item.
 *
 * Re-exports the item schema under a distinct OpenAPI name so the detail
 * endpoint's response is documented separately from the list endpoint's
 * item shape, even though the runtime types are equal. Future evolution of
 * the detail-only fields (e.g. step traces, prompt/response capture) will
 * branch this schema; for now it is structurally identical to the list
 * item.
 */
export const automationsRunsDetailResponseSchema = automationRunAdminItemSchema.openapi(
  'AutomationsRunsDetailResponse'
)

/** @public */
export type AutomationsRunsDetailResponse = z.infer<typeof automationsRunsDetailResponseSchema>
