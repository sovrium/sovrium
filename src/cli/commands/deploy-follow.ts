/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium deploy` and `sovrium preview` waiting for their deployment: the
 * answer announced, then the record read every two seconds (longer while the
 * cloud is busy), each state and attempt printed once, and — on `live` — the
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
import type { DeployResponse } from '@/domain/models/api/automations/automations'

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

/** How long the command waits for `live`, `failed` or `replaced`. */
const WAIT_LIMIT_MS = 10 * 60 * 1000

/** The refusal once the 10 minutes run out with the deployment not yet at an end. */
const stillWaiting = (id: string, status: string): CliRefusal =>
  new CliRefusal({
    headline: `Deployment ${id} is still ${describeDeploymentStatus(status)} after 10 minutes; the command stopped waiting.`,
    guidance: 'The deployment may still go live; check it in the cloud.',
  })

/**
 * One read of the deployment record, waited through while the cloud is busy —
 * `status` is the last one read, for the refusal once the deadline passes.
 */
const readDeployment = (
  { origin, apiKey }: SignedInCloud,
  wait: { readonly id: string; readonly deadline: number; readonly status: string }
) =>
  readCloudRecord({
    origin,
    apiKey,
    table: 'deployments',
    id: wait.id,
    label: `deployment ${wait.id}`,
    decode: Schema.decodeUnknownOption(deploymentRecordFieldsSchema),
    stillRunning: `deployment ${wait.id} is still in progress there`,
    guidance: 'The deployment may still go live; check it in the cloud.',
    deadline: wait.deadline,
    expired: () => stillWaiting(wait.id, wait.status),
  })

/** What is said once the address answers: `Live at`, and the console line when there is one. */
const arrivalLines = (
  deployment: {
    readonly adminLine?: string
    readonly arrived?: (address: string) => readonly string[]
  },
  address: string
): readonly string[] =>
  deployment.arrived?.(address) ?? [
    `Live at ${address}.`,
    ...(deployment.adminLine === undefined ? [] : [deployment.adminLine]),
  ]

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
    /** The verb a failed deployment is run again with; `deploy` when absent. */
    readonly verb?: string
    /** What is said once the address answers, in place of `Live at <address>.` */
    readonly arrived?: (address: string) => readonly string[]
  },
  printed: PrintedProgress
): Effect.Effect<'live' | 'replaced', CliRefusal> =>
  Effect.gen(function* () {
    const fields = yield* readDeployment(cloud, { ...deployment, status: printed.status })
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
      yield* Effect.forEach(arrivalLines(deployment, address), say, { discard: true })
      return 'live' as const
    }
    yield* Effect.forEach(progressLines(deployment.id, printed, read), say, { discard: true })
    // A newer deployment of the app went live: this one is over, and nothing failed.
    if (fields.status === 'replaced') return 'replaced' as const
    if (fields.status === 'failed') {
      return yield* new CliRefusal({
        headline: `Deployment ${deployment.id} failed on ${cloud.origin.origin}.`,
        ...(fields.report == null ? {} : { detail: fields.report.split('\n') }),
        guidance: `Fix what the report names, then run 'sovrium ${deployment.verb ?? 'deploy'}' again.`,
      })
    }
    if (Date.now() > deployment.deadline) return yield* stillWaiting(deployment.id, fields.status)
    yield* Effect.sleep(POLL_INTERVAL_MS)
    return yield* follow(cloud, deployment, {
      status: fields.status,
      attempt: fields.attempt ?? printed.attempt,
    })
  })

/** How a command speaks of the deployment the cloud accepted, and where it waits for it. */
export interface Announcement {
  /** The app the deployment belongs to, named while it waits for a machine. */
  readonly slug: string
  /** Said in place of the first state when the cloud replayed a known request. */
  readonly replayed: string
  /** The address `live` is checked at, when the record names none. */
  readonly url: string
  /** Return once announced, saying `noWaitLines`, instead of following it. */
  readonly noWait: boolean
  readonly noWaitLines?: readonly string[]
  /** As {@link follow}'s `verb` and `arrived`. */
  readonly verb?: string
  readonly arrived?: (address: string) => readonly string[]
}

/**
 * Announce an accepted deployment — its first state (or the replay), a wait
 * for a machine, the cloud's hint, its attempt — then, unless `noWait`,
 * {@link follow} it for up to 10 minutes. Returns how it ended, or `undefined`
 * under `noWait`.
 */
export const announceAndFollow = (
  cloud: SignedInCloud,
  answer: DeployResponse,
  announcement: Announcement
): Effect.Effect<'live' | 'replaced' | undefined, CliRefusal> =>
  Effect.gen(function* () {
    const id = answer.deploymentId
    yield* say(
      answer.replayed
        ? announcement.replayed
        : `Deployment ${id}: ${describeDeploymentStatus(answer.status)}`
    )
    if (answer.placement === 'waiting') {
      yield* say(
        `Deployment ${id}: waiting for a machine — it starts once one takes ${announcement.slug}.`
      )
    }
    if (answer.hint !== undefined) yield* say(`Deployment ${id}: ${answer.hint}`)
    const first = { attempt: answer.attempt, previous: answer.previousAttempt }
    yield* Effect.forEach(attemptLines(id, undefined, first), say, { discard: true })
    if (announcement.noWait) {
      yield* Effect.forEach(announcement.noWaitLines ?? [], say, { discard: true })
      return undefined
    }
    const adminLine = adminLineOf(answer)
    return yield* follow(
      cloud,
      {
        id,
        url: announcement.url,
        deadline: Date.now() + WAIT_LIMIT_MS,
        ...(adminLine === undefined ? {} : { adminLine }),
        ...(announcement.verb === undefined ? {} : { verb: announcement.verb }),
        ...(announcement.arrived === undefined ? {} : { arrived: announcement.arrived }),
      },
      { status: answer.status, attempt: answer.attempt }
    )
  })
