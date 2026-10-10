/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium deploy [config] [--app <slug>] [--host <url>] [--yes] [--env <file>] [--no-wait] [--seed]`
 *
 * Ship an app to the Sovrium cloud this machine is signed in to:
 *
 * 1. bundle it exactly as `sovrium bundle` does, into a temporary file;
 * 2. settle the app it goes to — `--app`, the project's link, or the address
 *    the config `name` gives — creating it when the address is free, set the
 *    variables of `--env <file>`, and refuse a bundle whose required variables
 *    the app lacks (`deploy-target.ts`), all before anything is uploaded;
 * 3. upload the archive to the cloud's `deployments` bucket
 *    (`POST /api/buckets/deployments/files`) — never retried, abandoned when
 *    the transfer stalls;
 * 4. post the small deploy request to `POST /api/automations/deploy/webhook`
 *    with an `Idempotency-Key`, so unchanged content deployed twice to the
 *    same app is answered with the first deployment;
 * 5. remember the app in the project's link file once the request is accepted;
 * 6. unless `--no-wait`, read the deployment record every 2 seconds for up to
 *    10 minutes, printing each state and each new attempt the cloud makes,
 *    until it is `live`, `failed` or `replaced` — and on `live`, wait for the
 *    app's address to answer before saying so;
 * 7. under `--seed`, once it is live, seed it `if-empty` from the bundle's
 *    `seed/` folder, as `sovrium seed --app <slug> --yes` does (`seed-remote.ts`).
 *
 * The archive never travels in the webhook body: a body is kept with its run.
 * Every answer is decoded through the deploy wire contract before it is read.
 */

import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Option, Schema } from 'effect'
import {
  BUNDLE_CONFIG_ENTRY,
  BUNDLE_MANIFEST_ENTRY,
} from '@/application/use-cases/server/bundle-manifest'
import {
  deployMissingEnvRefusalSchema,
  deployRefusalSchema,
  deployRequestSchema,
  deployResponseSchema,
} from '@/domain/models/api/automations/automations'
import { bucketUploadResponseSchema } from '@/domain/models/api/buckets'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { formatBytes, inflect } from '@/infrastructure/logging/cli-output'
import { buildValidatedBundle } from './bundle'
import { explicitAddress, resolveAddress, writeLink } from './cloud-app-lookup'
import {
  CliRefusal,
  assertNetworkAllowed,
  callCloud,
  describeUnreachable,
  runCliProgram,
  say,
} from './cloud-session'
import { signedInCloud } from './cloud-sign-in'
import { adminLineOf, follow } from './deploy-follow'
import { attemptLines, describeDeploymentStatus } from './deploy-progress'
import { configPathOf, pushEnvFile, refuseMissingEnv, settleTarget } from './deploy-target'
import { seedAfterDeploy } from './seed-remote'
import type { SignedInCloud } from './cloud-sign-in'
import type { BundleManifest } from '@/application/use-cases/server/bundle-manifest'

/** How long the command waits for `live`, `failed` or `replaced`. */
const WAIT_LIMIT_MS = 10 * 60 * 1000

/** The upload is abandoned after this long without a byte moving. */
const UPLOAD_STALL_MS = 60_000

/** Everything `sovrium deploy` reads from the command line. */
export interface DeployCommandOptions {
  readonly configFile: string | undefined
  readonly argv: readonly string[]
}

/**
 * The `Idempotency-Key`: sha256 of the target app slug, a newline, and the
 * manifest without its `createdAt`. Content plus target is what "the same
 * deployment" means; the build time and the tar metadata are not.
 *
 * @public
 */
export const deployIdempotencyKey = (app: string, manifest: BundleManifest): string => {
  const { createdAt: _createdAt, ...content } = manifest
  return createHash('sha256')
    .update(`${app}\n${JSON.stringify(content)}`)
    .digest('hex')
}

/** The `message` of an engine error envelope, when the body is one. */
const errorMessageOf = (body: unknown): string | undefined =>
  Option.getOrUndefined(
    Option.map(Schema.decodeUnknownOption(errorResponseSchema)(body), (error) => error.message)
  )

const keyRefused = (origin: URL): CliRefusal =>
  new CliRefusal({
    headline: `${origin.origin} did not accept the stored API key — nothing was deployed.`,
    guidance: "Run 'sovrium login' to sign in again.",
  })

/**
 * The `manifest.json` entry of the archive just written, as its exact UTF-8
 * text, and the config document it carries. Read back from the archive rather than re-serialised: the host signs
 * these bytes, and the machine applying the release verifies them as they sit
 * in the archive.
 */
const readArchiveTexts = async (
  archive: Uint8Array
): Promise<{ readonly manifestText: string; readonly document: Record<string, unknown> }> => {
  const files = await new Bun.Archive(archive).files()
  const textOf = async (name: string): Promise<string> => {
    const entry = files.get(name)
    // Thrown inside Effect.tryPromise, whose catch turns it into the refusal.
    if (entry === undefined) throw new Error(`the archive holds no ${name}`)
    return new TextDecoder('utf-8', { fatal: true }).decode(await entry.arrayBuffer())
  }
  const document = JSON.parse(await textOf(BUNDLE_CONFIG_ENTRY)) as Record<string, unknown>
  return { manifestText: await textOf(BUNDLE_MANIFEST_ENTRY), document }
}

/** Build the bundle into a temporary directory; the caller removes it. */
const bundleInto = (directory: string, configFile: string) =>
  Effect.tryPromise({
    try: async () => {
      const summary = await buildValidatedBundle({
        configFile,
        outputPath: join(directory, 'bundle.tar.gz'),
        command: 'deploy',
        outcome: 'nothing was sent',
      })
      const bytes = Uint8Array.from(await readFile(summary.archivePath))
      return { summary, bytes, ...(await readArchiveTexts(bytes)) }
    },
    catch: (cause) =>
      new CliRefusal({
        headline: 'Sovrium could not read the archive it just wrote — nothing was sent.',
        detail: [cause instanceof Error ? cause.message : String(cause)],
        guidance: 'Check that the temporary directory is writable, then run the command again.',
      }),
  })

/** Step 1: the archive, into the cloud's `deployments` bucket. Returns its object key. */
const upload = (origin: URL, apiKey: string, app: string, bytes: Uint8Array<ArrayBuffer>) =>
  Effect.gen(function* () {
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: 'application/gzip' }), `${app}.tar.gz`)
    const answer = yield* callCloud(
      new URL('/api/buckets/deployments/files', origin),
      { method: 'POST', headers: { 'x-api-key': apiKey }, body: form },
      UPLOAD_STALL_MS
    ).pipe(Effect.mapError(describeUnreachable('nothing was deployed')))
    const stored = Schema.decodeUnknownOption(bucketUploadResponseSchema)(answer.body)
    if (answer.status === 201 && Option.isSome(stored)) return stored.value.key
    if (answer.status === 401) return yield* keyRefused(origin)
    const said = errorMessageOf(answer.body)
    return yield* new CliRefusal({
      headline:
        answer.status === 413
          ? `The archive (${formatBytes(bytes.byteLength)}) is over the upload limit of ${origin.origin} — nothing was deployed.`
          : `${origin.origin} refused the archive (HTTP ${answer.status}) — nothing was deployed.`,
      ...(said === undefined ? {} : { detail: [said] }),
      guidance:
        answer.status === 413
          ? 'Make the public/ and seed/ files smaller, then run the command again.'
          : 'Check that the cloud offers a deployments bucket to your account, then run it again.',
    })
  })

/** Step 2: the deploy request, answered with the deployment (new, or replayed). */
const requestDeployment = (
  { origin, apiKey }: SignedInCloud,
  request: Schema.Schema.Type<typeof deployRequestSchema>,
  idempotencyKey: string
) =>
  Effect.gen(function* () {
    const body = yield* Schema.encodeEffect(deployRequestSchema)(request).pipe(
      Effect.mapError(
        (issue) =>
          new CliRefusal({
            headline: `The deploy request would not be valid (${issue.message}) — the archive is uploaded, nothing was deployed.`,
            guidance: 'Run the command again; if it persists, report it as a bug.',
          })
      )
    )
    const answer = yield* callCloud(new URL('/api/automations/deploy/webhook', origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    }).pipe(Effect.mapError(describeUnreachable('the archive is uploaded, nothing was deployed')))
    const deployment = Schema.decodeUnknownOption(deployResponseSchema)(answer.body)
    if ((answer.status === 200 || answer.status === 201) && Option.isSome(deployment)) {
      return deployment.value
    }
    const host = origin.origin
    const refusal = Schema.decodeUnknownOption(deployRefusalSchema)(answer.body)
    if (answer.status === 404 && Option.isSome(refusal) && refusal.value.error === 'unknown-app') {
      return yield* new CliRefusal({
        headline: `No app ${request.app} on your account at ${host}.`,
        guidance: `Run 'sovrium deploy' to create it, or create it at ${host}/apps.`,
      })
    }
    const missingEnv = Schema.decodeUnknownOption(deployMissingEnvRefusalSchema)(answer.body)
    return yield* new CliRefusal({
      headline: `${host} refused the deployment (HTTP ${answer.status}) — nothing was deployed.`,
      ...(Option.isSome(refusal) ? { detail: [refusal.value.message] } : {}),
      guidance: Option.isSome(missingEnv)
        ? "Set the variables it names with 'sovrium deploy --env <file>' or 'sovrium env push <file>', then deploy again."
        : answer.status === 404
          ? "Check the app's address, and run 'sovrium login' if your key was revoked."
          : 'Run the command again; if it persists, the cloud may be misconfigured.',
    })
  })

const temporaryDirectory = Effect.tryPromise({
  try: () => mkdtemp(join(tmpdir(), 'sovrium-deploy-')),
  catch: (cause) =>
    new CliRefusal({
      headline: 'Sovrium could not create a temporary directory — nothing was sent.',
      detail: [cause instanceof Error ? cause.message : String(cause)],
      guidance: 'Check that the temporary directory is writable, then run the command again.',
    }),
})

/** What one deploy run ships: the command line, the config, and the app `--app` names. */
interface ShipRequest {
  readonly argv: readonly string[]
  readonly configPath: string
  readonly explicit: string | undefined
}

/**
 * Bundle into `directory`, settle the app, set its variables, upload and
 * request the deployment, then link the project to the app.
 */
const shipFrom = (directory: string, cloud: SignedInCloud, request: ShipRequest) =>
  Effect.gen(function* () {
    const { argv, configPath } = request
    const { summary, bytes, manifestText, document } = yield* bundleInto(directory, configPath)
    const { manifest } = summary
    const address = yield* resolveAddress({
      explicit: request.explicit,
      configPath,
      appName: manifest.app.name,
      origin: cloud.origin,
    })
    const target = yield* settleTarget(cloud, address, {
      appName: manifest.app.name,
      yes: argv.includes('--yes'),
    })
    const justSet = yield* pushEnvFile(argv, cloud, target, document)
    yield* refuseMissingEnv(cloud, target, manifest.requiredEnv ?? [], justSet)
    const app = target.slug
    yield* say(
      `Bundled ${manifest.app.name} (${inflect(manifest.entries.length, 'file')}, ${formatBytes(bytes.byteLength)}).`
    )
    const objectKey = yield* upload(cloud.origin, cloud.apiKey, app, bytes)
    yield* say(`Uploaded to ${cloud.origin.origin}.`)
    const deployment = yield* requestDeployment(
      cloud,
      {
        app,
        objectKey,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        configHash: manifest.configHash,
        engineVersion: manifest.engine.minVersion,
        manifest: manifestText,
      },
      deployIdempotencyKey(app, manifest)
    )
    if (address.source !== 'link') yield* writeLink(configPath, cloud.origin.origin, app)
    return { deployment, target }
  })

/** {@link shipFrom} in a temporary directory, removed either way. */
const ship = (cloud: SignedInCloud, request: ShipRequest) =>
  Effect.gen(function* () {
    const directory = yield* temporaryDirectory
    return yield* shipFrom(directory, cloud, request).pipe(
      Effect.ensuring(
        Effect.tryPromise({
          try: () => rm(directory, { recursive: true, force: true }),
          catch: () => undefined,
        }).pipe(
          // The deployment's outcome does not depend on removing it.
          // effect-swallow: a leftover temporary archive is the OS's to clear
          Effect.ignore
        )
      )
    )
  })

/** `--seed` seeds once the deployment is live, so it cannot return before it is. */
const refuseSeedWithoutWait = (argv: readonly string[]): Effect.Effect<void, CliRefusal> =>
  argv.includes('--seed') && argv.includes('--no-wait')
    ? Effect.fail(
        new CliRefusal({
          headline:
            '--seed seeds the app once the deployment is live, and --no-wait returns before it is — nothing was built or sent.',
          guidance: 'Drop one of the two flags.',
        })
      )
    : Effect.void

/** `--seed`, once {@link follow} ended: seed a deployment that went live, else say why not. */
const seedWhenLive = (
  cloud: SignedInCloud,
  deployment: { readonly id: string; readonly app: string; readonly ended: 'live' | 'replaced' }
) =>
  deployment.ended === 'live'
    ? seedAfterDeploy(cloud, deployment.app)
    : Effect.fail(
        new CliRefusal({
          headline: `Deployed, but not seeded: deployment ${deployment.id} was replaced by a newer one before it went live.`,
          guidance: `Seed the live deployment with 'sovrium seed --app ${deployment.app}'.`,
        })
      )

/**
 * Sign-in check, ship, and (unless `--no-wait`) follow the deployment to its
 * end; under `--seed`, then seed it as `sovrium seed --app <slug> --yes` does.
 */
const deploy = (options: DeployCommandOptions) =>
  Effect.gen(function* () {
    const { argv } = options
    yield* refuseSeedWithoutWait(argv)
    const explicit = yield* explicitAddress(argv)
    yield* assertNetworkAllowed('deploy')
    const cloud = yield* signedInCloud(argv)
    const configPath = yield* configPathOf(options.configFile)
    const { deployment, target } = yield* ship(cloud, { argv, configPath, explicit })
    const id = deployment.deploymentId
    yield* say(
      deployment.replayed
        ? `Already deployed (revision ${id}).`
        : `Deployment ${id}: ${describeDeploymentStatus(deployment.status)}`
    )
    if (deployment.placement === 'waiting') {
      yield* say(
        `Deployment ${id}: waiting for a machine — it starts once one takes ${target.slug}.`
      )
    }
    if (deployment.hint !== undefined) yield* say(`Deployment ${id}: ${deployment.hint}`)
    const first = { attempt: deployment.attempt, previous: deployment.previousAttempt }
    yield* Effect.forEach(attemptLines(id, undefined, first), say, { discard: true })
    const printed = { status: deployment.status, attempt: deployment.attempt }
    if (argv.includes('--no-wait')) return
    const url = deployment.url === '' ? (target.app?.url ?? '') : deployment.url
    const adminLine = adminLineOf(deployment)
    const ended = yield* follow(
      cloud,
      {
        id,
        url,
        deadline: Date.now() + WAIT_LIMIT_MS,
        ...(adminLine === undefined ? {} : { adminLine }),
      },
      printed
    )
    if (argv.includes('--seed')) yield* seedWhenLive(cloud, { id, app: target.slug, ended })
  })

/** Handle `sovrium deploy`. Exits 1 on any refusal; returns on success. */
export const handleDeployCommand = async (options: DeployCommandOptions): Promise<void> =>
  runCliProgram(deploy(options))
