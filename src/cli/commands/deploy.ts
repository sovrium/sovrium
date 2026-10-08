/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium deploy [config] --app <slug> [--host <url>] [--no-wait]`
 *
 * Ship an app to the Sovrium cloud this machine is signed in to:
 *
 * 1. bundle it exactly as `sovrium bundle` does, into a temporary file;
 * 2. upload the archive to the cloud's `deployments` bucket
 *    (`POST /api/buckets/deployments/files`) — never retried, abandoned when
 *    the transfer stalls;
 * 3. post the small deploy request to `POST /api/automations/deploy/webhook`
 *    with an `Idempotency-Key`, so unchanged content deployed twice to the
 *    same app is answered with the first deployment;
 * 4. unless `--no-wait`, read the deployment record every 2 seconds for up to
 *    10 minutes, printing each state, until it is `live` or `failed`.
 *
 * The archive never travels in the webhook body: a body is kept with its run.
 * Every answer is decoded through the deploy wire contract before it is read.
 */

import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Option, Schema } from 'effect'
import { BUNDLE_MANIFEST_ENTRY } from '@/application/use-cases/server/bundle-manifest'
import { getFlagValue } from '@/cli/runtime/flag-vocabulary'
import {
  deployRefusalSchema,
  deployRequestSchema,
  deployResponseSchema,
  deploymentRecordFieldsSchema,
} from '@/domain/models/api/automations/automations'
import { bucketUploadResponseSchema } from '@/domain/models/api/buckets'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { getRecordResponseSchema } from '@/domain/models/api/tables/tables'
import { formatBytes, inflect } from '@/infrastructure/logging/cli-output'
import { buildValidatedBundle } from './bundle'
import {
  CliRefusal,
  DEFAULT_CLOUD_HOST,
  assertNetworkAllowed,
  callCloud,
  describeUnreachable,
  readCredentials,
  resolveCloudOrigin,
  runCliProgram,
  say,
} from './cloud-session'
import type { BundleManifest } from '@/application/use-cases/server/bundle-manifest'
import type { DeploymentStatus } from '@/domain/models/api/automations/automations'

/** How often the deployment is read while the command waits. */
const POLL_INTERVAL_MS = 2000

/** How long the command waits for `live` or `failed`. */
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

/**
 * A state as a person reads it: `waking-up` is printed `waking up`.
 *
 * @public
 */
export const describeDeploymentStatus = (status: DeploymentStatus): string =>
  status.replace('-', ' ')

/** The `message` of an engine error envelope, when the body is one. */
const errorMessageOf = (body: unknown): string | undefined =>
  Option.getOrUndefined(
    Option.map(Schema.decodeUnknownOption(errorResponseSchema)(body), (error) => error.message)
  )

const signInFirst = (origin: URL): CliRefusal =>
  new CliRefusal({
    headline: `This machine is not signed in to ${origin.origin} — nothing was built or sent.`,
    guidance: `Run 'sovrium login --host ${origin.origin}' first.`,
  })

const keyRefused = (origin: URL): CliRefusal =>
  new CliRefusal({
    headline: `${origin.origin} did not accept the stored API key — nothing was deployed.`,
    guidance: "Run 'sovrium login' to sign in again.",
  })

/** The app slug `--app` names, checked against the intake's own rule before anything is built. */
const requireAppSlug = (argv: readonly string[]): Effect.Effect<string, CliRefusal> => {
  const app = getFlagValue(argv, '--app')
  const valid =
    app !== undefined && Option.isSome(Schema.decodeOption(deployRequestSchema.fields.app)(app))
  return valid
    ? Effect.succeed(app)
    : Effect.fail(
        new CliRefusal({
          headline:
            app === undefined
              ? 'sovrium deploy needs the hosted app to deploy to — nothing was sent.'
              : `"${app}" is not an app slug: 2 to 28 characters, lowercase letters, digits and '-', starting and ending with a letter or digit — nothing was sent.`,
          guidance: "Name it with --app, for example 'sovrium deploy --app atelier-crm'.",
        })
      )
}

/**
 * The `manifest.json` entry of the archive just written, as its exact UTF-8
 * text. Read back from the archive rather than re-serialised: the host signs
 * these bytes, and the machine applying the release verifies them as they sit
 * in the archive.
 */
const readManifestText = async (archive: Uint8Array): Promise<string> => {
  const entry = (await new Bun.Archive(archive).files()).get(BUNDLE_MANIFEST_ENTRY)
  if (entry === undefined) {
    // Thrown inside Effect.tryPromise, whose catch turns it into the refusal.
    throw new Error(`the archive holds no ${BUNDLE_MANIFEST_ENTRY}`)
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(await entry.arrayBuffer())
}

/** Build the bundle into a temporary directory; the caller removes it. */
const bundleInto = (directory: string, configFile: string | undefined) =>
  Effect.tryPromise({
    try: async () => {
      const summary = await buildValidatedBundle({
        configFile,
        outputPath: join(directory, 'bundle.tar.gz'),
        command: 'deploy',
        outcome: 'nothing was sent',
      })
      const bytes = Uint8Array.from(await readFile(summary.archivePath))
      return { summary, bytes, manifestText: await readManifestText(bytes) }
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
    const refusal = Schema.decodeUnknownOption(deployRefusalSchema)(answer.body)
    return yield* new CliRefusal({
      headline: `${origin.origin} refused the deployment (HTTP ${answer.status}) — nothing was deployed.`,
      ...(Option.isSome(refusal) ? { detail: [refusal.value.message] } : {}),
      guidance:
        answer.status === 404
          ? "Check that the cloud has a deploy intake, and run 'sovrium login' if your key was revoked."
          : 'Run the command again; if it persists, the cloud may be misconfigured.',
    })
  })

/** One read of the deployment record. */
const readDeployment = (origin: URL, apiKey: string, id: string) =>
  Effect.gen(function* () {
    const answer = yield* callCloud(
      new URL(`/api/tables/deployments/records/${encodeURIComponent(id)}`, origin),
      { method: 'GET', headers: { 'x-api-key': apiKey } }
    ).pipe(Effect.mapError(describeUnreachable(`deployment ${id} is still in progress there`)))
    const record = Schema.decodeUnknownOption(getRecordResponseSchema)(answer.body)
    const fields = Option.flatMap(record, (read) =>
      Schema.decodeUnknownOption(deploymentRecordFieldsSchema)(read.fields)
    )
    if (answer.status === 200 && Option.isSome(fields)) return fields.value
    return yield* new CliRefusal({
      headline: `Sovrium could not read deployment ${id} on ${origin.origin} (HTTP ${answer.status}).`,
      guidance: 'The deployment may still go live; check it in the cloud.',
    })
  })

/** A signed-in cloud: where it is and the key every call carries. */
interface SignedInCloud {
  readonly origin: URL
  readonly apiKey: string
}

/**
 * Read the deployment until it is `live` or `failed`, printing each state it
 * enters. Recursive so the last printed state is a parameter.
 */
const follow = (
  cloud: SignedInCloud,
  deployment: { readonly id: string; readonly url: string; readonly deadline: number },
  printed: DeploymentStatus
): Effect.Effect<void, CliRefusal> =>
  Effect.gen(function* () {
    const fields = yield* readDeployment(cloud.origin, cloud.apiKey, deployment.id)
    if (fields.status === 'live') {
      return yield* say(`Live at ${fields.url ?? deployment.url}.`)
    }
    if (fields.status !== printed) {
      yield* say(`Deployment ${deployment.id}: ${describeDeploymentStatus(fields.status)}`)
    }
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
    return yield* follow(cloud, deployment, fields.status)
  })

/** The signed-in cloud this deploy targets, or the refusal telling the developer to sign in. */
const signedInCloud = (argv: readonly string[]): Effect.Effect<SignedInCloud, CliRefusal> =>
  Effect.gen(function* () {
    const stored = yield* readCredentials
    const target = getFlagValue(argv, '--host') ?? stored?.host
    if (target === undefined) return yield* signInFirst(new URL(DEFAULT_CLOUD_HOST))
    const origin = yield* resolveCloudOrigin(target)
    // A key for one cloud is never sent to another.
    if (stored === undefined || URL.parse(stored.host)?.origin !== origin.origin) {
      return yield* signInFirst(origin)
    }
    return { origin, apiKey: stored.apiKey }
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

/** Bundle, upload and request the deployment; the temporary archive is removed either way. */
const ship = (cloud: SignedInCloud, app: string, configFile: string | undefined) =>
  Effect.gen(function* () {
    const directory = yield* temporaryDirectory
    return yield* Effect.gen(function* () {
      const { summary, bytes, manifestText } = yield* bundleInto(directory, configFile)
      const { manifest } = summary
      yield* say(
        `Bundled ${manifest.app.name} (${inflect(manifest.entries.length, 'file')}, ${formatBytes(bytes.byteLength)}).`
      )
      const objectKey = yield* upload(cloud.origin, cloud.apiKey, app, bytes)
      yield* say(`Uploaded to ${cloud.origin.origin}.`)
      return yield* requestDeployment(
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
    }).pipe(
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

/** Sign-in check, ship, and (unless `--no-wait`) follow the deployment to its end. */
const deploy = (options: DeployCommandOptions) =>
  Effect.gen(function* () {
    const { argv } = options
    const app = yield* requireAppSlug(argv)
    yield* assertNetworkAllowed('deploy')
    const cloud = yield* signedInCloud(argv)
    const deployment = yield* ship(cloud, app, options.configFile)
    yield* say(
      deployment.replayed
        ? `Already deployed (revision ${deployment.deploymentId}).`
        : `Deployment ${deployment.deploymentId}: ${describeDeploymentStatus(deployment.status)}`
    )
    if (argv.includes('--no-wait')) return
    yield* follow(
      cloud,
      {
        id: deployment.deploymentId,
        url: deployment.url,
        deadline: Date.now() + WAIT_LIMIT_MS,
      },
      deployment.status
    )
  })

/** Handle `sovrium deploy`. Exits 1 on any refusal; returns on success. */
export const handleDeployCommand = async (options: DeployCommandOptions): Promise<void> =>
  runCliProgram(deploy(options))
