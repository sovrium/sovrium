/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium deploy --from-preview <id>`'s request: deploy the bundle a preview
 * runs as the app's release, through the cloud's `deployment-promote` door —
 * no bundle, no upload. The answer is a deploy answer, followed as one.
 */

import { createHash } from 'node:crypto'
import { Effect, Option, Schema } from 'effect'
import {
  deployMissingEnvRefusalSchema,
  deployRefusalSchema,
  deployResponseSchema,
} from '@/domain/models/api/automations/automations'
import {
  previewNotLiveRefusalSchema,
  promoteRequestSchema,
} from '@/domain/models/api/automations/cloud/preview'
import { CliRefusal, callCloudThroughBusy, describeUnreachable } from './cloud-session'
import type { SignedInCloud } from './cloud-sign-in'
import type { DeployResponse } from '@/domain/models/api/automations/automations'

/** How long the promotion is sent again while the cloud answers 429 or 503. */
const PROMOTE_BUSY_LIMIT_MS = 2 * 60 * 1000

const PROMOTE_PATH = '/api/automations/deployment-promote/webhook'

const OUTCOME = 'nothing was deployed'

/** Where a developer gets an id to promote. */
const MAKE_A_PREVIEW = "Run 'sovrium preview' to make one, then deploy from the id it prints."

/**
 * The `Idempotency-Key` of a promotion: sha256 of the app, `promote` and the
 * preview's id — promoting one preview twice is one request.
 *
 * @public
 */
export const promoteIdempotencyKey = (app: string, deploymentId: string): string =>
  createHash('sha256').update(`${app}\npromote\n${deploymentId}`).digest('hex')

/** What the promotion is about, for the refusals that name it. */
interface Promotion {
  readonly app: string
  readonly deploymentId: string
  readonly host: string
}

/** The refusals the promotion door names by code, keyed `<status> <error>`. */
const NAMED_REFUSALS: Readonly<Record<string, (promotion: Promotion) => CliRefusal>> = {
  '404 unknown-preview': ({ app, deploymentId, host }) =>
    new CliRefusal({
      headline: `No preview ${deploymentId} of ${app} on ${host}.`,
      guidance: MAKE_A_PREVIEW,
    }),
  '404 unknown-app': ({ app, host }) =>
    new CliRefusal({
      headline: `No app ${app} on your account at ${host}.`,
      guidance: `Check the app's address, or create it at ${host}/apps.`,
    }),
  '409 no-live-preview': ({ app, host }) =>
    new CliRefusal({
      headline: `${app} has no live preview on ${host} — ${OUTCOME}.`,
      guidance: MAKE_A_PREVIEW,
    }),
}

/** A refusal the door did not name: an older cloud's missing route, or an unexpected answer. */
const unnamedRefusal = (
  answer: { readonly status: number; readonly body: unknown },
  { host }: Promotion,
  said: string | undefined
): CliRefusal => {
  // A 404 that names nothing is the route itself: a cloud released before promotion.
  if (answer.status === 404) {
    return new CliRefusal({
      headline: `This cloud cannot deploy a preview yet — ${host} does not answer sovrium deploy --from-preview.`,
      guidance: "Deploy the project with 'sovrium deploy' instead.",
    })
  }
  const missingEnv = Option.isSome(
    Schema.decodeUnknownOption(deployMissingEnvRefusalSchema)(answer.body)
  )
  return new CliRefusal({
    headline: `${host} refused the deployment (HTTP ${answer.status}) — ${OUTCOME}.`,
    ...(said === undefined ? {} : { detail: [said] }),
    guidance: missingEnv
      ? "Set the variables it names with 'sovrium env push <file>', then deploy again."
      : 'Run the command again; if it persists, the cloud may be misconfigured.',
  })
}

/** The refusal of an answer that is not an accepted promotion. */
const refusalOf = (
  answer: { readonly status: number; readonly body: unknown },
  promotion: Promotion
): CliRefusal => {
  const notLive = Schema.decodeUnknownOption(previewNotLiveRefusalSchema)(answer.body)
  if (answer.status === 409 && Option.isSome(notLive)) {
    const { app, deploymentId } = promotion
    return new CliRefusal({
      headline: `Preview ${deploymentId} of ${app} is not live (${notLive.value.status}) — wait for it, or promote a live one.`,
      guidance: `Run 'sovrium deploy --from-preview ${deploymentId}' again once the preview is live.`,
    })
  }
  const refusal = Option.getOrUndefined(
    Schema.decodeUnknownOption(deployRefusalSchema)(answer.body)
  )
  const named = NAMED_REFUSALS[`${answer.status} ${refusal?.error ?? ''}`]
  return named === undefined
    ? unnamedRefusal(answer, promotion, refusal?.message)
    : named(promotion)
}

/**
 * Ask the cloud to deploy preview `deploymentId` of `app` as its release,
 * answered with the release (new, or the one made the first time). Sent again
 * while the cloud is busy: the `Idempotency-Key` makes a second send the same
 * request.
 */
export const requestPromotion = (
  { origin, apiKey }: SignedInCloud,
  app: string,
  deploymentId: string
): Effect.Effect<DeployResponse, CliRefusal> =>
  Effect.gen(function* () {
    const body = yield* Schema.encodeEffect(promoteRequestSchema)({ app, deploymentId }).pipe(
      Effect.mapError(
        (issue) =>
          new CliRefusal({
            headline: `The promotion request would not be valid (${issue.message}) — ${OUTCOME}.`,
            guidance: 'Run the command again; if it persists, report it as a bug.',
          })
      )
    )
    const answer = yield* callCloudThroughBusy(
      new URL(PROMOTE_PATH, origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Idempotency-Key': promoteIdempotencyKey(app, deploymentId),
        },
        body: JSON.stringify(body),
      },
      { deadline: Date.now() + PROMOTE_BUSY_LIMIT_MS, onBusy: () => Effect.void }
    ).pipe(Effect.mapError(describeUnreachable(OUTCOME)))
    const release = Schema.decodeUnknownOption(deployResponseSchema)(answer.body)
    if ((answer.status === 200 || answer.status === 201) && Option.isSome(release)) {
      return release.value
    }
    return yield* refusalOf(answer, { app, deploymentId, host: origin.origin })
  })
