/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/config/version`.
 *
 * Phase-0 admin read endpoint exercising the audit-log keystone primitives
 * (RBAC middleware, `adminRoute` OpenAPI helper, audit emit, anti-enumeration)
 * with the smallest plausible response body.
 *
 * Source story: docs/user-stories/as-business-admin/config/config-version.md
 *
 * @see plan-design §10 (locked 2026-05-09) — first endpoint to author
 * @see keystone plan §12 Q1 — three-tier RBAC (admin / operator / auditor)
 */

import { z } from '@hono/zod-openapi'

/**
 * Sovrium runtime mode literal.
 *
 * Distinguishes the two database runtimes Sovrium supports:
 * - `postgres`   — full Postgres backend with audit-log archive replay,
 *                   pgvector RAG, real-time subscriptions, etc.
 * - `sqlite-aio` — All-In-One Docker image with SQLite + local storage;
 *                   some Postgres-only endpoints return 501 with
 *                   `error: 'requires-postgres'`.
 *
 * Operators read this field to distinguish parity issues at-a-glance:
 * a bug filed against AIO that tries to hit a Postgres-only feature is
 * resolved without needing shell access to confirm the runtime mode.
 */
export const sovriumRuntimeSchema = z
  .enum(['postgres', 'sqlite-aio'])
  .describe('Active database runtime backing this Sovrium process')

/** @public */
export type SovriumRuntime = z.infer<typeof sovriumRuntimeSchema>

/**
 * Response shape of `GET /api/admin/config/version`.
 *
 * All five fields are operator-grade reflection — no domain data, no
 * per-table information, no PII. The endpoint is callable by every admin
 * tier (admin / operator / auditor) per design §2.6.
 *
 * Field-by-field rationale:
 * - `version`     — answers "what build am I running?"; gated by semver regex
 *                   so OpenAPI consumers can rely on the format
 * - `commit`      — answers "which commit produced this binary?"; falls back
 *                   to literal `'unknown'` when `SOVRIUM_COMMIT_SHA` env var
 *                   is unset (binary built without commit injection)
 * - `runtime`     — answers "which database backend is wired up?"; critical
 *                   for AIO/Postgres parity debugging
 * - `nodeVersion` — answers "what runtime version executes this code?";
 *                   semantically the Bun version, named `nodeVersion` for
 *                   OpenAPI tooling familiarity (Postman / Insomnia / spec
 *                   viewers expect this name)
 * - `startedAt`   — answers "when did this process boot?"; captured once at
 *                   module import and frozen for the process lifetime; lets
 *                   operators correlate audit-log entries to a specific
 *                   process instance across restarts
 *
 * The shape is exposed under the OpenAPI name `ConfigVersionResponse` so
 * downstream tooling generates a stable type name.
 */
export const configVersionResponseSchema = z
  .object({
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+(-.*)?$/)
      .describe(
        'Semantic version string from package.json baked into the binary at build time (e.g. "0.3.0" or "1.0.0-beta.4")'
      ),
    commit: z
      .string()
      .regex(/^([0-9a-f]{7,40}|unknown)$/)
      .describe(
        'Short git commit SHA (7-40 lowercase hex chars) injected at build time via SOVRIUM_COMMIT_SHA, or the literal "unknown" when the env var is unset'
      ),
    runtime: sovriumRuntimeSchema,
    nodeVersion: z
      .string()
      .min(1)
      .describe(
        'Bun runtime version powering this Sovrium process. Field name retained for OpenAPI tooling familiarity (the value is Bun.version, not Node.js)'
      ),
    startedAt: z.iso
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp captured once at process boot; identical across all calls within a single process lifetime'
      ),
  })
  .openapi('ConfigVersionResponse')

/** @public */
export type ConfigVersionResponse = z.infer<typeof configVersionResponseSchema>
