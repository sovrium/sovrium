/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { parseEcoDesignLayer } from '@/domain/models/process-env/eco/eco-design-layer'
import { parseEcoFormAnalytics } from '@/domain/models/process-env/eco/eco-form-analytics'
import { parseEcoIndexHeader } from '@/domain/models/process-env/eco/eco-index-header'
import { parseEcoLowDataDefault } from '@/domain/models/process-env/eco/eco-low-data-default'
import { parseEcoMode } from '@/domain/models/process-env/eco/eco-mode'
import { parseEcoPageCache } from '@/domain/models/process-env/eco/eco-page-cache'
import { parseEcoPageCacheMaxMb } from '@/domain/models/process-env/eco/eco-page-cache-max-mb'

/**
 * Raised when any `ECO_*` env var is set to a value its parser does not
 * recognise.
 *
 * `message` is carried EXPLICITLY alongside `cause`, and it is the field
 * `formatRuntimeError` prints as prose — so the parser's descriptive text
 * ("Invalid ECO_MODE: expected …") is what reaches the operator's terminal,
 * whatever `cause` happens to hold. A refusal that does not name the variable
 * it refused is barely better than the silent fallback it replaced: the
 * operator knows only that something about eco config is wrong, which is the
 * one thing they could already guess.
 *
 * The two fields carry the same sentence here (`cause` is the `Error` the
 * parser threw); the formatter drops `cause` rather than printing it twice.
 *
 * Exported for one reason only: `validateOperatorEnv` names this tag in its
 * declared error channel, and a `.d.ts` cannot reference a name its declaring
 * module keeps to itself. No caller catches it by tag — an operator reads it.
 */
export class EcoEnvError extends Data.TaggedError('EcoEnvError')<{
  readonly message: string
  readonly cause: unknown
}> {}

/**
 * Every `ECO_*` parser, as a list rather than nine call statements.
 *
 * A list is what makes the set auditable: adding a tenth `ECO_*` variable and
 * forgetting to validate it is the failure mode this whole change exists to
 * prevent, and a missing entry here is far easier to see than a missing line
 * in a block of near-identical calls.
 *
 * `ECO_AI_PROVIDER_PRECEDENCE` is deliberately absent — its vocabulary is open
 * (any non-keyword token is a provider ID), so it has no unrecognised value to
 * reject.
 *
 * `ECO_AI_MAX_CARBON_CLASS`, `ECO_RETENTION_PURGE_DAYS` and `ECO_IMAGE_FORMAT`
 * were removed from this list because the variables themselves were removed:
 * the first two had no enforcement point anywhere in the binary, and the third
 * was replaced by a hardcoded AVIF default. `ECO_FORM_ANALYTICS` joins the list
 * for the opposite reason — it was always enforced but had no parser module, so
 * it was invisible to exactly this kind of enumeration.
 */
const ECO_ENV_PARSERS: readonly ((env: Readonly<Record<string, string | undefined>>) => unknown)[] =
  [
    parseEcoMode,
    parseEcoDesignLayer,
    parseEcoFormAnalytics,
    parseEcoIndexHeader,
    parseEcoLowDataDefault,
    parseEcoPageCache,
    parseEcoPageCacheMaxMb,
  ]

/**
 * Fail-fast on a malformed `ECO_*` operator variable.
 *
 * The parsers themselves throw on a set-but-unrecognised value, but every one
 * of them is called LAZILY — on a dashboard read, on a page render, on an image
 * transform, on a request passing through the eco-index middleware. Without
 * this pass a typo would surface minutes or hours after boot, at a call site
 * that has nothing to do with the misconfiguration, on whichever request
 * happened to touch that lever first. Worse, the levers that are read rarely
 * (`ECO_RETENTION_PURGE_DAYS` on the purge sweep) could go unnoticed until the
 * sweep ran.
 *
 * Calling every parser once at startup collapses that into a single, immediate
 * refusal naming the offending variable. It mirrors
 * `validateStoragePublicAccessEnv` in both shape and intent, and mirrors — in
 * the environment — the contract [internal ref] established for the app config:
 *
 * > The app config refuses an unknown KEY. The environment refuses an unknown
 * > VALUE.
 *
 * Unset vars are untouched: every parser returns its documented default for an
 * absent variable, so a deployment that configures no `ECO_*` var at all boots
 * exactly as before.
 */
export const validateEcoEnv: Effect.Effect<void, EcoEnvError> = Effect.try({
  try: () => ECO_ENV_PARSERS.map((parse) => parse(process.env)),
  catch: (cause) =>
    new EcoEnvError({
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    }),
}).pipe(Effect.asVoid)
