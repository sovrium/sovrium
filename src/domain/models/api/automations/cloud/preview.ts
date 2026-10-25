/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { deployRequestSchema, deployResponseSchema } from '../automations'

/**
 * The two cloud doors beside the deploy webhook: a preview, and the promotion
 * of a preview to the release.
 *
 * Like the rest of the deploy contract, no route of the engine serves them:
 * the cloud is an ordinary Sovrium app whose config declares the webhooks
 * (`auth: { type: session }`, so a session or an `x-api-key`).
 *
 * - `POST /api/automations/preview/webhook` takes the deploy request
 *   (`deployRequestSchema`) after the same upload, with an `Idempotency-Key`
 *   that mixes in the kind, and answers {@link previewResponseSchema}: the
 *   deploy answer plus the share address and the day it stops answering. Its
 *   refusals are the deploy door's. A cloud older than previews answers the
 *   route itself 404.
 * - `POST /api/automations/deployment-promote/webhook` takes
 *   {@link promoteRequestSchema}, no bundle and no upload, and answers as the
 *   deploy door does (`deployResponseSchema`; the `kind` and `promotedFrom`
 *   it adds are not read). It refuses 404 `unknown-app` or `unknown-preview`,
 *   409 `no-live-preview` or {@link previewNotLiveRefusalSchema}, and 422
 *   `missing-env`.
 */

/**
 * The preview door's answer: 201 for a preview it just recorded, 200 with
 * `replayed: true` for one already recorded under that `Idempotency-Key`.
 *
 * @public
 */
export const previewResponseSchema = Schema.Struct({
  ...deployResponseSchema.fields,
  kind: Schema.Literal('preview').annotate({
    description: "'preview': a deployment at the app's share address, not at its own",
  }),
  previewUrl: Schema.String.annotate({
    description:
      "The https address the preview answers at once live — the share address, the cloud's to choose. The CLI prints it as given and never builds it",
  }).check(Schema.isMinLength(1)),
  expiresAt: Schema.String.annotate({
    description:
      'When the preview stops answering, as an ISO 8601 instant; every new preview of the app pushes it back',
  }).check(Schema.isMinLength(10)),
})

/** @public */
export type PreviewResponse = Schema.Schema.Type<typeof previewResponseSchema>

/**
 * The promotion request: the app, and the id of the preview of it whose
 * bundle becomes the release. The CLI always names the preview.
 *
 * @public
 */
export const promoteRequestSchema = Schema.Struct({
  app: deployRequestSchema.fields.app,
  deploymentId: Schema.String.annotate({
    description: 'Id of the preview deployment to promote, as `sovrium preview` printed it',
  }).check(Schema.isMinLength(1)),
})

/** @public */
export type PromoteRequest = Schema.Schema.Type<typeof promoteRequestSchema>

/**
 * The promotion's refusal of a preview that is not live yet (409
 * `preview-not-live`): a preview `queued`, applying or `failed` is not
 * promoted; `live` and `replaced` are.
 *
 * @public
 */
export const previewNotLiveRefusalSchema = Schema.Struct({
  error: Schema.Literal('preview-not-live').annotate({
    description: "'preview-not-live': the preview has not gone live",
  }),
  status: Schema.String.annotate({ description: "The preview's state, as the cloud records it" }),
  message: optionalField(Schema.String.annotate({ description: 'The refusal, for a person' })),
})

/** @public */
export type PreviewNotLiveRefusal = Schema.Schema.Type<typeof previewNotLiveRefusalSchema>
