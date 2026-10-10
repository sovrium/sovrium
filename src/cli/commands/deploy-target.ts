/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The parts of `sovrium deploy` around the upload: settling which app it
 * deploys to (creating it when the address is free), refusing a bundle whose
 * required variables the app lacks, and checking the app's address answers
 * before the command says it is live.
 *
 * - **An existing app**, reached by the config `name` with no link yet: a
 *   terminal confirms once, a script goes on and says which app it uses.
 * - **A free address**: a terminal asks, a script needs `--yes`. The app is
 *   created through the cloud's `new-app` form (`POST
 *   /api/forms/new-app/submissions`, `{ name, slug }`, same key) — the cloud's
 *   one creation path and its one set of checks — then looked up again until
 *   the cloud has given it its address.
 * - **The address check**: once the cloud reports `live`, `GET
 *   <address>/api/health` every second for up to 30 seconds.
 */

import { resolve } from 'node:path'
import { Effect, Option, Schema } from 'effect'
import { declaredEnvOf } from '@/application/use-cases/env/validate-required-env-vars'
import { confirmOrFail, isInteractive } from '@/cli/runtime/confirm-prompt'
import { getFlagValue, getFlagValues } from '@/cli/runtime/flag-vocabulary'
import { PLATFORM_ENV_NAME_PATTERN } from '@/domain/models/api/automations/cloud/app-env'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { discoverConfigFile } from './app-prelude'
import { lookUpAddress, refuseReserved } from './cloud-app-lookup'
import {
  CliRefusal,
  callCloud,
  describeUnreachable,
  resolveCloudOrigin,
  say,
} from './cloud-session'
import { preparePush, readEnvFile, sendPlan } from './env-push'
import type { AddressLookup, ResolvedAddress } from './cloud-app-lookup'
import type { SignedInCloud } from './cloud-sign-in'
import type { AppAddressApp } from '@/domain/models/api/automations/cloud/app-address'

/** How long a new app may take to get its address before the command gives up on it. */
const NEW_APP_WAIT_MS = 15_000

/** How often a new app is looked up again while it gets its address. */
const NEW_APP_POLL_MS = 500

/** How long the app's address may take to answer once the cloud reports it live. */
const ADDRESS_WINDOW_MS = 30_000

/** How often the address is read while it does not answer. */
const ADDRESS_POLL_MS = 1000

/** Inactivity deadline of one read of the address. */
const ADDRESS_STALL_MS = 5000

/** The app a deployment goes to, as the lookup described it — `undefined` against a cloud without one. */
export interface DeployTarget {
  readonly slug: string
  readonly app: AppAddressApp | undefined
  /** Names of the variables set on the app, when the cloud reports them. */
  readonly envNames: readonly string[] | undefined
}

/** `<slug>.<cloud host>`: the address the cloud serves a new app at. */
const addressOf = (cloud: SignedInCloud, slug: string): string => `${slug}.${cloud.origin.hostname}`

/** The `fieldErrors` of a form refusal, by field name. */
const fieldErrorsSchema = Schema.Struct({
  fieldErrors: Schema.Array(Schema.Struct({ name: Schema.String })),
})

/** Submit the cloud's `new-app` form as the caller: the one way an app is created. */
const submitNewApp = (cloud: SignedInCloud, name: string, slug: string) =>
  Effect.gen(function* () {
    const host = cloud.origin.origin
    const answer = yield* callCloud(new URL('/api/forms/new-app/submissions', cloud.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cloud.apiKey },
      body: JSON.stringify({ name, slug }),
    }).pipe(Effect.mapError(describeUnreachable('nothing was created or uploaded')))
    if (answer.status === 201) return
    const fields = Schema.decodeUnknownOption(fieldErrorsSchema)(answer.body)
    const lostTheRace =
      answer.status === 409 ||
      (Option.isSome(fields) && fields.value.fieldErrors.some((field) => field.name === 'slug'))
    const said = Option.getOrUndefined(
      Option.map(Schema.decodeUnknownOption(errorResponseSchema)(answer.body), (e) => e.message)
    )
    return yield* new CliRefusal({
      headline: lostTheRace
        ? `The address ${slug} was taken on ${host} in the meantime — nothing was uploaded.`
        : `${host} did not create the app ${slug} (HTTP ${answer.status}) — nothing was uploaded.`,
      ...(said === undefined ? {} : { detail: [said] }),
      guidance: lostTheRace
        ? 'Choose another address with --app.'
        : `Create it at ${host}/apps, then run 'sovrium deploy --app ${slug}'.`,
    })
  })

/** Look the new app up until the cloud has given it its address. */
const awaitNewApp = (
  cloud: SignedInCloud,
  slug: string,
  deadline: number
): Effect.Effect<Extract<AddressLookup, { kind: 'yours' }>, CliRefusal> =>
  Effect.gen(function* () {
    const found = yield* lookUpAddress(cloud, slug).pipe(
      // A row created a moment ago may answer the lookup before its address is written.
      // effect-swallow: an in-between answer is read again until the deadline below
      Effect.orElseSucceed((): AddressLookup => ({ kind: 'free' }))
    )
    if (found.kind === 'yours') return found
    if (Date.now() > deadline) {
      return yield* new CliRefusal({
        headline: `The app ${slug} was created on ${cloud.origin.origin}, but it has no address yet — nothing was uploaded.`,
        guidance: `Run 'sovrium deploy --app ${slug}' again in a minute.`,
      })
    }
    yield* Effect.sleep(NEW_APP_POLL_MS)
    return yield* awaitNewApp(cloud, slug, deadline)
  })

/** Create the free address as the caller's app, once confirmed. */
const createApp = (cloud: SignedInCloud, address: ResolvedAddress, name: string, yes: boolean) =>
  Effect.gen(function* () {
    const { slug } = address
    yield* confirmOrFail({
      yes,
      question: `Create ${addressOf(cloud, slug)}?`,
      refusal: new CliRefusal({
        headline: `${slug} is not one of your apps on ${cloud.origin.origin}, and creating it was not confirmed — nothing was created or uploaded.`,
        guidance: `Run the command again with --yes to create ${slug}, or name one of your apps with --app.`,
      }),
    })
    yield* submitNewApp(cloud, name, slug)
    const created = yield* awaitNewApp(cloud, slug, Date.now() + NEW_APP_WAIT_MS)
    yield* say(`Created ${slug} on ${cloud.origin.origin}.`)
    return created
  })

/**
 * The app a deployment goes to: looked up, confirmed or created. A cloud with
 * no lookup is deployed to as before, by the address alone.
 */
export const settleTarget = (
  cloud: SignedInCloud,
  address: ResolvedAddress,
  options: { readonly appName: string; readonly yes: boolean }
): Effect.Effect<DeployTarget, CliRefusal> =>
  Effect.gen(function* () {
    const { slug } = address
    yield* refuseReserved(slug)
    const looked = yield* lookUpAddress(cloud, slug)
    if (looked.kind === 'unsupported') return { slug, app: undefined, envNames: undefined }
    const found =
      looked.kind === 'free'
        ? yield* createApp(cloud, address, options.appName, options.yes)
        : looked
    if (looked.kind === 'yours' && address.source === 'name') {
      const existing = `your existing app ${slug} (${found.app.url})`
      if (!options.yes && isInteractive()) {
        yield* confirmOrFail({
          yes: false,
          question: `Deploy to ${existing}?`,
          refusal: new CliRefusal({
            headline: `Not deployed to ${existing} — nothing was uploaded.`,
            guidance: 'Name the app to deploy to with --app.',
          }),
        })
      } else {
        yield* say(`Deploying to ${existing}.`)
      }
    }
    return { slug, app: found.app, envNames: found.envNames }
  })

/**
 * Refuse, before uploading, a bundle whose config requires variables the app
 * does not have. Names only; the platform's own names never count as missing.
 * A cloud that does not report the app's variables leaves the check to its intake.
 */
export const refuseMissingEnv = (
  cloud: SignedInCloud,
  target: DeployTarget,
  required: readonly string[],
  justSet: readonly string[]
): Effect.Effect<void, CliRefusal> => {
  if (target.envNames === undefined) return Effect.void
  const have = new Set([...target.envNames, ...justSet])
  const missing = required.filter(
    (name) => !PLATFORM_ENV_NAME_PATTERN.test(name) && !have.has(name)
  )
  if (missing.length === 0) return Effect.void
  const page =
    target.app?.id === undefined
      ? `${cloud.origin.origin}/apps`
      : `${cloud.origin.origin}/apps/${target.app.id}?tab=env`
  const them = missing.length === 1 ? 'it' : 'them'
  return Effect.fail(
    new CliRefusal({
      headline: `${target.slug} needs ${missing.join(', ')}, which ${missing.length === 1 ? 'is' : 'are'} not set on the app — nothing was uploaded.`,
      guidance: `Set ${them} from a file with 'sovrium deploy --env <file>', or at ${page}, then deploy again.`,
    })
  )
}

/**
 * Whether `<origin>/api/health` answers 2xx right now. The request carries no
 * key and follows no redirect (`callCloud`): a 3xx is an address that does not
 * answer, never a hop to wherever it points.
 */
const addressAnswers = (origin: URL): Effect.Effect<boolean> =>
  callCloud(new URL('/api/health', origin), { method: 'GET' }, ADDRESS_STALL_MS).pipe(
    Effect.map((answer) => answer.status >= 200 && answer.status < 300),
    // effect-swallow: an address that does not answer yet is read again until the window closes
    Effect.orElseSucceed(() => false)
  )

/** Read the address every second until it answers or `deadline` passes. */
const pollAddress = (
  origin: URL,
  address: string,
  deploymentId: string,
  deadline: number
): Effect.Effect<void, CliRefusal> =>
  Effect.gen(function* () {
    if (yield* addressAnswers(origin)) return
    if (Date.now() >= deadline) {
      return yield* new CliRefusal({
        headline: `Deployment ${deploymentId}: deployment applied but the URL does not answer — ${address}/api/health gave no answer within 30 seconds.`,
        guidance:
          'The release is in place; check the app in the cloud, then run the command again.',
      })
    }
    yield* Effect.sleep(ADDRESS_POLL_MS)
    return yield* pollAddress(origin, address, deploymentId, deadline)
  })

/**
 * Wait for the app's address to answer, for up to 30 seconds after the cloud
 * reported the deployment live. Fails naming the deployment when it does not.
 *
 * The address is the cloud's answer, so it goes through the same transport
 * rules as the cloud itself (`resolveCloudOrigin`: `https` only, save a private
 * host under `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`, and the outbound guard) before
 * it is read.
 */
export const awaitAddress = (
  address: string,
  deploymentId: string
): Effect.Effect<void, CliRefusal> =>
  Effect.gen(function* () {
    const origin = yield* resolveCloudOrigin(address).pipe(
      Effect.mapError(
        () =>
          new CliRefusal({
            headline: `Deployment ${deploymentId}: deployment applied, but the cloud gave the address "${address}", which is not an https:// address Sovrium checks.`,
            guidance: 'The release is in place; check the app in the cloud.',
          })
      )
    )
    return yield* pollAddress(origin, address, deploymentId, Date.now() + ADDRESS_WINDOW_MS)
  })

/**
 * `--env <file>`: set the variables the config declares from that file on the
 * app before anything is uploaded. Returns the names now set.
 */
export const pushEnvFile = (
  argv: readonly string[],
  cloud: SignedInCloud,
  target: DeployTarget,
  document: Readonly<Record<string, unknown>>
): Effect.Effect<readonly string[], CliRefusal> =>
  Effect.gen(function* () {
    const file = getFlagValue(argv, '--env')
    if (file === undefined) return []
    const appId = target.app?.id
    if (appId === undefined) {
      return yield* new CliRefusal({
        headline: `${cloud.origin.origin} did not say which app ${target.slug} is, so --env cannot set its variables — nothing was uploaded.`,
        guidance: "Set the app's variables on its page in the cloud, then deploy without --env.",
      })
    }
    const entries = yield* readEnvFile(resolve(file))
    const declared = declaredEnvOf(document).map((entry) => entry.key)
    const plan = yield* preparePush(entries, declared, getFlagValues(argv, '--plain'))
    return yield* sendPlan(cloud, appId, plan, argv.includes('--overwrite'))
  })

/** The config file this deploy reads: the one named, or the one in the current directory. */
export const configPathOf = (configFile: string | undefined): Effect.Effect<string> =>
  // effect-promise: total -- discovery falls back to the default name and never rejects
  Effect.promise(async () => resolve(configFile ?? (await discoverConfigFile())))
