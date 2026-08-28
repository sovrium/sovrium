/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/config/schema`.
 *
 * Reflects the live `App` object the instance booted from, **secrets redacted**,
 * so an operator can answer "what is this instance actually running?" without
 * shell access to the config file.
 *
 * Source story: [internal ref]
 *
 * ─── AUTHORISATION ──────────────────────────────────────────────────────────
 *
 * Authorised by [internal ref] **amendment A1** (2026-08-14), which reverses the
 * ADR's original rejection of read-only config viewing. A1's invariant:
 *
 *   > Reading the running configuration is observability; mutating it is
 *   > authoring.
 *
 * A1 authorises exactly two surfaces — this one and `GET /api/admin/env` — and
 * bounds them exhaustively: **no edit affordance, no write endpoint, no draft,
 * no version ledger, no history, no diff, no preview or sandbox.** Each of
 * those is authoring or authoring's apparatus. That bound is why this module
 * contains a single response schema and no request schema: there is no shape a
 * caller can send, because there is nothing to send it to.
 *
 * ─── REDACTION IS A CONDITION OF THE AUTHORISATION ──────────────────────────
 *
 * A1, verbatim: "a config-reflection endpoint that leaks a secret is out of
 * contract — it is not a defective implementation of an authorised surface, it
 * is an unauthorised surface." Redaction therefore happens **server-side,
 * before serialisation**. Masking in the UI is not redaction: the payload is
 * the boundary the operator's browser, any intermediary proxy, and the error
 * tracker all see.
 *
 * **The redactor is `redactSecretsForApp`, NOT `redactSecretsForEnv`.** This
 * distinction is the single most load-bearing fact in this contract, and it is
 * counter-intuitive enough to have been measured rather than assumed:
 *
 *   - `$env.X` references are resolved at USE time, per call site — see
 *     `run-automation.ts`, `action-handlers/auth-headers.ts`,
 *     `connections/oauth-flow.ts`, `automations/webhook-handler.ts` — and are
 *     NEVER resolved at boot into the `App` object. The in-memory `App`
 *     therefore holds the literal token string `'$env.STRIPE_KEY'`, not the
 *     secret it names.
 *   - `redactSecretsForEnv` scrubs *resolved env values*. Since nothing in the
 *     `App` object is resolved, it finds nothing to scrub here and is a no-op.
 *     Measured against a four-connection `App`: it leaked all three literal
 *     credentials verbatim.
 *   - The only way a real secret reaches the `App` object is a config author
 *     hardcoding a literal (`clientSecret: 'sk_live_…'` instead of
 *     `'$env.X'`). That case is covered ONLY by `collectConnectionSecrets`,
 *     which is composed into `redactSecretsForApp`. Measured against the same
 *     object: zero leaks.
 *
 * Consequently a redaction test written against a config that uses `$env.`
 * everywhere (e.g. `apps/partner`) proves NOTHING — there is nothing to redact
 * and the assertion passes vacuously. The E2E fixture deliberately declares a
 * hardcoded LITERAL secret for each of the four `SECRET_PROP_KEYS_BY_TYPE`
 * variants alongside an `$env`-referencing one.
 *
 * ─── `$env.X` TOKENS SURVIVE REDACTION, BY DESIGN ───────────────────────────
 *
 * `'$env.GOOGLE_OAUTH_CLIENT_SECRET'` is a *variable name*, not a credential.
 * It stays visible because it tells the operator which variable feeds the
 * field — precisely the observability A1 authorises. A future change that
 * strips `$env.` tokens would be a regression, not a hardening.
 *
 * @see [internal ref] (A1)
 * @see src/application/use-cases/automations/redact-secrets.ts
 */

import { z } from '@hono/zod-openapi'

/**
 * The redaction placeholder every scrubbed value is replaced with.
 *
 * Exported as a named constant so the endpoint, the UI, and the specs assert
 * the same literal instead of three independently-drifting string literals.
 * The value is fixed by `redactSecretsForApp`, which does
 * `split(secret).join('***')`.
 *
 * Fixed-width and independent of the secret's length — it must not become a
 * length oracle.
 */
export const REDACTION_PLACEHOLDER = '***'

/**
 * Response shape of `GET /api/admin/config/schema`.
 *
 * ### Why `app` is typed as an opaque record rather than a mirrored Zod shape
 *
 * `AppSchema` (Effect Schema, `src/domain/models/app/`) is the single source of
 * truth for the configuration surface — 22 top-level properties, 40+ field
 * types, deeply recursive component and automation unions. Re-declaring that in
 * Zod purely to type this response would create a **second** definition of the
 * config contract that drifts on every schema change, and it would drift
 * SILENTLY: the endpoint would keep returning a correct body while the Zod
 * mirror slowly stopped describing it.
 *
 * The endpoint reflects whatever `AppSchema` validated at boot. `z.record` is
 * the honest type for that, and the payload's *shape* is already guaranteed
 * upstream — it was decoded by `AppSchema` before the process finished booting.
 * What this contract owns is the two things Effect Schema does NOT guarantee:
 * that the object has been through the redactor, and when it was read.
 */
export const configSchemaResponseSchema = z
  .object({
    app: z
      .record(z.string(), z.unknown())
      .describe(
        'The live App configuration object this instance booted from, after server-side secret redaction. Shape is defined by AppSchema (Effect Schema); typed opaquely here to avoid a second, drifting definition of the config contract. Redacted values are replaced with the literal "***"; `$env.VAR` reference tokens are NOT redacted (a variable name is not a credential).'
      ),
    generatedAt: z.iso
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp of when this reflection was read. Unlike config/version.startedAt this is per-request, because it timestamps the read rather than the process.'
      ),
  })
  .openapi('ConfigSchemaResponse')

/** @public */
export type ConfigSchemaResponse = z.infer<typeof configSchemaResponseSchema>
