/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium deploy` waiting for its deployment: the record read every two
 * seconds, each state and attempt printed once, and — on `live` — the app's
 * address checked before the command says so.
 */

import { Effect, Schema } from 'effect'
import { deploymentRecordFieldsSchema } from '@/domain/models/api/automations/automations'
import { CliRefusal, readCloudRecord, say } from './cloud-session'
import {
  attemptLines,
  describeDeploymentStatus,
  progressLines,
  type PrintedProgress,
  type ReadProgress,
} from './deploy-progress'
import { awaitAddress } from './deploy-target'
import type { SignedInCloud } from './cloud-sign-in'

/**
 * The line naming the app's operator console, from the deploy answer — only
 * when the cloud reports both its address and that its admins sign in with
 * their Sovrium Cloud account.
 */
export const adminLineOf = (answer: {
  readonly adminUrl?: string | undefined
  readonly platformSso?: boolean | undefined
}): string | undefined =>
  answer.platformSso === true && answer.adminUrl !== undefined && answer.adminUrl !== ''
    ? `Admin: ${answer.adminUrl} — sign in with Sovrium Cloud`
    : undefined

/** How often the deployment is read while the command waits. */
const POLL_INTERVAL_MS = 2000

/** One read of the deployment record. */
const readDeployment = (origin: URL, apiKey: string, id: string) =>
  readCloudRecord({
    origin,
    apiKey,
    table: 'deployments',
    id,
    label: `deployment ${id}`,
    decode: Schema.decodeUnknownOption(deploymentRecordFieldsSchema),
    stillRunning: `deployment ${id} is still in progress there`,
    guidance: 'The deployment may still go live; check it in the cloud.',
  })

/**
 * Read the deployment until it is `live`, `failed` or `replaced`, printing each
 * state it enters and each new attempt the cloud makes, and return which of
 * the two good ends it reached. A state this version
 * does not know is printed and waited through. Recursive so what was last
 * printed is a parameter.
 */
export const follow = (
  cloud: SignedInCloud,
  deployment: {
    readonly id: string
    readonly url: string
    readonly deadline: number
    /** The console line printed under `Live at`, when the cloud's answer names one. */
    readonly adminLine?: string
  },
  printed: PrintedProgress
): Effect.Effect<'live' | 'replaced', CliRefusal> =>
  Effect.gen(function* () {
    const fields = yield* readDeployment(cloud.origin, cloud.apiKey, deployment.id)
    const read: ReadProgress = {
      status: fields.status,
      attempt: fields.attempt,
      previous: fields.previous_attempt,
    }
    if (fields.status === 'live') {
      // An attempt that went live between two reads is still announced before it.
      yield* Effect.forEach(attemptLines(deployment.id, printed.attempt, read), say, {
        discard: true,
      })
      const address = fields.url == null || fields.url === '' ? deployment.url : fields.url
      yield* awaitAddress(address, deployment.id)
      yield* say(`Live at ${address}.`)
      if (deployment.adminLine !== undefined) yield* say(deployment.adminLine)
      return 'live' as const
    }
    yield* Effect.forEach(progressLines(deployment.id, printed, read), say, { discard: true })
    // A newer deployment of the app went live: this one is over, and nothing failed.
    if (fields.status === 'replaced') return 'replaced' as const
    if (fields.status === 'failed') {
      return yield* new CliRefusal({
        headline: `Deployment ${deployment.id} failed on ${cloud.origin.origin}.`,
        ...(fields.report == null ? {} : { detail: fields.report.split('\n') }),
        guidance: "Fix what the report names, then run 'sovrium deploy' again.",
      })
    }
    if (Date.now() > deployment.deadline) {
      return yield* new CliRefusal({
        headline: `Deployment ${deployment.id} is still ${describeDeploymentStatus(fields.status)} after 10 minutes; the command stopped waiting.`,
        guidance: 'The deployment may still go live; check it in the cloud.',
      })
    }
    yield* Effect.sleep(POLL_INTERVAL_MS)
    return yield* follow(cloud, deployment, {
      status: fields.status,
      attempt: fields.attempt ?? printed.attempt,
    })
  })
