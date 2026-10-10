/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which hosted app a project means, and what the cloud says about it — shared
 * by `sovrium deploy` and `sovrium env`.
 *
 * ### Which app
 *
 * The first that applies: `--app`; the project's link file
 * (`<project>/.sovrium/cloud.json`) when it was written for THIS cloud; the
 * address derived from the config `name` ({@link deriveAppSlug}). The link
 * never chooses the cloud: a link for another host is ignored.
 *
 * ### The lookup
 *
 * `POST /api/automations/app-address/webhook` `{ slug }` with the caller's
 * key, decoded through the app-address wire contract: one of the caller's
 * apps, free, taken (409), or refused (422). A cloud older than the lookup
 * answers 404, which reads as "unsupported" — the caller decides what that
 * means for it.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Effect, Option, Schema } from 'effect'
import { readValueFlag } from '@/cli/runtime/flag-vocabulary'
import { deployRequestSchema } from '@/domain/models/api/automations/automations'
import {
  APP_ADDRESS_PATTERN,
  RESERVED_APP_ADDRESSES,
  appAddressRefusalSchema,
  appAddressResponseSchema,
  cloudLinkSchema,
} from '@/domain/models/api/automations/cloud/app-address'
import { deriveAppSlug } from '@/domain/models/app/name-service'
import { renderStderr } from '@/infrastructure/logging/cli-output'
import { CliRefusal, callCloud, describeUnreachable, say } from './cloud-session'
import { resolveProjectRoot } from './option-parsing'
import type { SignedInCloud } from './cloud-sign-in'
import type { AppAddressApp, CloudLink } from '@/domain/models/api/automations/cloud/app-address'

/** Where the address came from: `--app`, the project's link, or the config `name`. */
export type AddressSource = 'flag' | 'link' | 'name'

/** The address a command means, and why. */
export interface ResolvedAddress {
  readonly slug: string
  readonly source: AddressSource
}

/** What the cloud said about an address. */
export type AddressLookup =
  | {
      readonly kind: 'yours'
      readonly app: AppAddressApp
      readonly envNames: readonly string[] | undefined
      readonly env: readonly { readonly name: string; readonly kind: 'plain' | 'secret' }[]
    }
  | { readonly kind: 'free' }
  | { readonly kind: 'unsupported' }

/** `<project>/.sovrium/cloud.json` — beside the config, or at an unpacked bundle's root. */
export const linkPathOf = (configPath: string): string =>
  join(resolveProjectRoot(configPath), '.sovrium', 'cloud.json')

/** The project's link, when there is one this version can read. A broken file reads as none. */
export const readLink = (configPath: string): Effect.Effect<CloudLink | undefined> =>
  Effect.tryPromise({
    try: async () => JSON.parse(await readFile(linkPathOf(configPath), 'utf8')) as unknown,
    catch: () => undefined,
  }).pipe(
    Effect.map((raw) => Option.getOrUndefined(Schema.decodeUnknownOption(cloudLinkSchema)(raw))),
    // effect-swallow: a missing or unreadable link only means the project is not linked yet
    Effect.orElseSucceed(() => undefined)
  )

/**
 * Remember that the project deploys to `app` on `host`. A failed write is a
 * warning: the deployment it follows went through.
 */
export const writeLink = (configPath: string, host: string, app: string): Effect.Effect<void> => {
  const path = linkPathOf(configPath)
  const link: CloudLink = { version: 1, host, app, linkedAt: new Date().toISOString() }
  return Effect.tryPromise({
    try: async () => {
      await mkdir(join(path, '..'), { recursive: true })
      await writeFile(path, `${JSON.stringify(link, undefined, 2)}\n`, 'utf8')
    },
    catch: (cause) => (cause instanceof Error ? cause.message : String(cause)),
  }).pipe(
    Effect.catch((reason) =>
      renderStderr(
        `Warning: could not remember the app in ${path} (${reason}); name it with --app next time.`
      )
    )
  )
}

const nameItWithApp = "Name the app with --app, for example 'sovrium deploy --app atelier-crm'."

/**
 * The address `--app` names — `--app <slug>` or `--app=<slug>` — checked
 * against the deploy rule before anything is built. A `--app` with no slug is
 * refused, never read as absent: falling back to the link or the config name
 * would send the command to an app nobody named.
 */
export const explicitAddress = (
  argv: readonly string[]
): Effect.Effect<string | undefined, CliRefusal> => {
  const { given, value: app } = readValueFlag(argv, '--app')
  if (given && app === undefined) {
    return Effect.fail(
      new CliRefusal({
        headline: '--app is given no app address — nothing was sent.',
        guidance: nameItWithApp,
      })
    )
  }
  return app === undefined ||
    Option.isSome(Schema.decodeOption(deployRequestSchema.fields.app)(app))
    ? Effect.succeed(app)
    : Effect.fail(
        new CliRefusal({
          headline: `"${app}" is not an app slug: 2 to 28 characters, lowercase letters, digits and '-', starting and ending with a letter or digit — nothing was sent.`,
          guidance: nameItWithApp,
        })
      )
}

/** The address the config `name` gives, or the refusal naming why it gives none. */
const addressFromName = (name: string): Effect.Effect<string, CliRefusal> => {
  const slug = deriveAppSlug(name)
  if (APP_ADDRESS_PATTERN.test(slug)) return Effect.succeed(slug)
  return Effect.fail(
    new CliRefusal({
      headline:
        slug === ''
          ? `The config name "${name}" gives no app address — nothing was sent.`
          : slug.length > 28
            ? `The config name "${name}" gives the address ${slug}, longer than the 28 characters an address may have — nothing was sent.`
            : `The config name "${name}" gives the address ${slug}, and an address is 3 to 28 lowercase letters, digits and '-' — nothing was sent.`,
      guidance: `${nameItWithApp} An address is never shortened to fit.`,
    })
  )
}

/**
 * `--app`, else the link written for this cloud, else the config `name`.
 * Says which address the name gave when it differs from the name.
 */
export const resolveAddress = (input: {
  readonly explicit: string | undefined
  readonly configPath: string
  readonly appName: string
  readonly origin: URL
  /** Print which address the name gave; off for output a script parses. */
  readonly announce?: boolean
}): Effect.Effect<ResolvedAddress, CliRefusal> =>
  Effect.gen(function* () {
    if (input.explicit !== undefined) return { slug: input.explicit, source: 'flag' as const }
    const link = yield* readLink(input.configPath)
    if (link !== undefined && URL.parse(link.host)?.origin === input.origin.origin) {
      return { slug: link.app, source: 'link' as const }
    }
    const slug = yield* addressFromName(input.appName)
    if (slug !== input.appName && input.announce !== false)
      yield* say(`app address ${slug} (from name ${input.appName})`)
    return { slug, source: 'name' as const }
  })

/** A refusal before anything leaves the machine, for an address the cloud keeps for itself. */
export const refuseReserved = (slug: string): Effect.Effect<void, CliRefusal> =>
  (RESERVED_APP_ADDRESSES as readonly string[]).includes(slug)
    ? Effect.fail(
        new CliRefusal({
          headline: `The address ${slug} is kept by the cloud for its own use — nothing was uploaded.`,
          guidance: 'Choose another address with --app.',
        })
      )
    : Effect.void

/** A `200` answer, decoded; `undefined` for one this version cannot read. */
const lookupOf = (body: unknown): AddressLookup | undefined => {
  const decoded = Schema.decodeUnknownOption(appAddressResponseSchema)(body)
  if (Option.isNone(decoded)) return undefined
  const found = decoded.value
  return found.status === 'free'
    ? { kind: 'free' }
    : {
        kind: 'yours',
        app: found.app,
        envNames: found.envNames ?? found.env?.map((variable) => variable.name),
        env: found.env ?? [],
      }
}

/** Why the lookup refused, by its HTTP status. */
const lookupRefusalHeadline = (status: number, host: string, slug: string): string => {
  if (status === 409) return `The address ${slug} is taken by another account on ${host}`
  if (status === 422) return `${host} does not accept the address ${slug}`
  if (status === 401) return `${host} did not accept the API key in use`
  return `${host} could not look up the address ${slug} (HTTP ${status})`
}

/** Ask the cloud about `slug`: one of the caller's apps, free, unsupported, or a refusal. */
export const lookUpAddress = (
  cloud: SignedInCloud,
  slug: string
): Effect.Effect<AddressLookup, CliRefusal> =>
  Effect.gen(function* () {
    const answer = yield* callCloud(new URL('/api/automations/app-address/webhook', cloud.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cloud.apiKey },
      body: JSON.stringify({ slug }),
    }).pipe(Effect.mapError(describeUnreachable('nothing was uploaded')))
    const host = cloud.origin.origin
    if (answer.status === 404) return { kind: 'unsupported' as const }
    const found = answer.status === 200 ? lookupOf(answer.body) : undefined
    if (found !== undefined) return found
    const refusal = Schema.decodeUnknownOption(appAddressRefusalSchema)(answer.body)
    const said = Option.isSome(refusal) ? refusal.value.message : undefined
    return yield* new CliRefusal({
      headline: `${lookupRefusalHeadline(answer.status, host, slug)} — nothing was uploaded.`,
      ...(said === undefined ? {} : { detail: [said] }),
      guidance:
        answer.status === 401
          ? "Run 'sovrium login' to sign in again."
          : 'Choose another address with --app.',
    })
  })
