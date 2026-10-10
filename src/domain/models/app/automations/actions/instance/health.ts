/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { InstanceSlugSchema } from './instance-slug'

/**
 * Instance Health Action (type: instance, operator: health)
 *
 * Sends `GET http://127.0.0.1:<port>/api/health`, where `<port>` is the one the
 * last `apply` recorded in `status.json` (the release's `PORT`). The address is
 * built here and is always loopback, so this never goes through the outbound
 * URL checks an `http` step does — and never reaches anything but this host.
 *
 * It asks again at a short interval until the app answers or `timeoutMs` runs
 * out, so an app still booting is waited for. It never goes through the app's
 * socket, so it never wakes a suspended app.
 *
 * An app that does not answer, or answers with an error, is a successful step
 * with `ok: false`: the caller branches on it. A slug with no recorded port
 * fails the step.
 */
export const InstanceHealthActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('health').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: InstanceSlugSchema,
    timeoutMs: Schema.optional(
      Schema.Number.pipe(
        Schema.annotate({
          description:
            'How long to wait for the answer, in milliseconds, from 100 to 60000. Default 10000; the probe asks again until the app answers or this runs out',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 100, maximum: 60_000 }))
      )
    ),
  }).annotate({
    description: 'The supervised app to probe, and how long to wait for it.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceHealthAction',
    title: 'Instance Health Action',
    description: "Probe a supervised app's health endpoint over loopback",
  })
)

/** @public */
export type InstanceHealthAction = Schema.Schema.Type<typeof InstanceHealthActionSchema>
