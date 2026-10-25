/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shipping pipeline behind `sovrium deploy` and `sovrium preview`: bundle the app into a
 * temporary file, settle the app it goes to, set its variables, upload the
 * archive to the cloud's `deployments` bucket, then post the small intake
 * request with an `Idempotency-Key` and link the project to the app.
 *
 * The intake it posts to is an {@link Intake} descriptor — its printed verb,
 * webhook path, refusal outcome and answer schema — so a sibling verb can ship
 * the same bundle through another door: `DEPLOY_INTAKE` for a live
 * deployment, `PREVIEW_INTAKE` for a preview at the app's share address.
 * `deploy.ts` and `preview.ts` follow what comes back.
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
import { previewResponseSchema } from '@/domain/models/api/automations/cloud/preview'
import { bucketUploadResponseSchema } from '@/domain/models/api/buckets'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { formatBytes, inflect } from '@/infrastructure/logging/cli-output'
import { buildValidatedBundle } from './bundle'
import { resolveAddress, writeLink } from './cloud-app-lookup'
import {
  CliRefusal,
  callCloud,
  callCloudThroughBusy,
  describeUnreachable,
  say,
} from './cloud-session'
import { pushEnvFile, refuseMissingEnv, settleTarget } from './deploy-target'
import type { SignedInCloud } from './cloud-sign-in'
import type { BundleManifest } from '@/application/use-cases/server/bundle-manifest'
import type { DeployResponse } from '@/domain/models/api/automations/automations'
import type { PreviewResponse } from '@/domain/models/api/automations/cloud/preview'

/** How long the intake request is sent again while the cloud answers 429 or 503. */
const INTAKE_BUSY_LIMIT_MS = 2 * 60 * 1000

/** The upload is abandoned after this long without a byte moving. */
const UPLOAD_STALL_MS = 60_000

/** The cloud door a shipped bundle goes through, and how the command speaks of it. */
export interface Intake<R> {
  /** The printed verb, and the `command` the bundle is built for. */
  readonly verb: 'deploy' | 'preview'
  /** The webhook path the intake request is posted to. */
  readonly path: string
  /** What did not happen, closing every refusal after the bundle is built. */
  readonly outcome: string
  /** The answer of an accepted request. */
  readonly response: Schema.Decoder<R>
}

/** `sovrium deploy`'s door: a live deployment. */
export const DEPLOY_INTAKE: Intake<DeployResponse> = {
  verb: 'deploy',
  path: '/api/automations/deploy/webhook',
  outcome: 'nothing was deployed',
  response: deployResponseSchema,
}

/** `sovrium preview`'s door: the same bundle, at the app's share address. */
export const PREVIEW_INTAKE: Intake<PreviewResponse> = {
  verb: 'preview',
  path: '/api/automations/preview/webhook',
  outcome: 'nothing was previewed',
  response: previewResponseSchema,
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
 * The `Idempotency-Key` an intake is sent with. A deploy keeps
 * {@link deployIdempotencyKey}; a preview mixes in its kind — sha256 of the
 * app, `preview` and the same manifest text — so a preview and a deploy of one
 * bundle are never answered with each other.
 *
 * @public
 */
export const intakeIdempotencyKey = (
  verb: Intake<unknown>['verb'],
  app: string,
  manifest: BundleManifest
): string => {
  if (verb === 'deploy') return deployIdempotencyKey(app, manifest)
  const { createdAt: _createdAt, ...content } = manifest
  return createHash('sha256')
    .update(`${app}\n${verb}\n${JSON.stringify(content)}`)
    .digest('hex')
}

/** The `message` of an engine error envelope, when the body is one. */
const errorMessageOf = (body: unknown): string | undefined =>
  Option.getOrUndefined(
    Option.map(Schema.decodeUnknownOption(errorResponseSchema)(body), (error) => error.message)
  )

const keyRefused = (origin: URL, outcome: string): CliRefusal =>
  new CliRefusal({
    headline: `${origin.origin} did not accept the stored API key — ${outcome}.`,
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
const bundleInto = (directory: string, configFile: string, verb: Intake<unknown>['verb']) =>
  Effect.tryPromise({
    try: async () => {
      const summary = await buildValidatedBundle({
        configFile,
        outputPath: join(directory, 'bundle.tar.gz'),
        command: verb,
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
const upload = (
  { origin, apiKey }: SignedInCloud,
  app: string,
  bytes: Uint8Array<ArrayBuffer>,
  outcome: string
) =>
  Effect.gen(function* () {
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: 'application/gzip' }), `${app}.tar.gz`)
    const answer = yield* callCloud(
      new URL('/api/buckets/deployments/files', origin),
      { method: 'POST', headers: { 'x-api-key': apiKey }, body: form },
      UPLOAD_STALL_MS
    ).pipe(Effect.mapError(describeUnreachable(outcome)))
    const stored = Schema.decodeUnknownOption(bucketUploadResponseSchema)(answer.body)
    if (answer.status === 201 && Option.isSome(stored)) return stored.value.key
    if (answer.status === 401) return yield* keyRefused(origin, outcome)
    const said = errorMessageOf(answer.body)
    return yield* new CliRefusal({
      headline:
        answer.status === 413
          ? `The archive (${formatBytes(bytes.byteLength)}) is over the upload limit of ${origin.origin} — ${outcome}.`
          : `${origin.origin} refused the archive (HTTP ${answer.status}) — ${outcome}.`,
      ...(said === undefined ? {} : { detail: [said] }),
      guidance:
        answer.status === 413
          ? 'Make the public/ and seed/ files smaller, then run the command again.'
          : 'Check that the cloud offers a deployments bucket to your account, then run it again.',
    })
  })

/** The headers of the intake request: JSON, the key, and its `Idempotency-Key`. */
const intakeHeaders = (apiKey: string, idempotencyKey: string) => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
  'Idempotency-Key': idempotencyKey,
})

/** The refusal of an answer that is not an accepted intake request. */
const intakeRefusal = (
  answer: { readonly status: number; readonly body: unknown },
  { app, host }: { readonly app: string; readonly host: string },
  { verb, outcome }: Intake<unknown>
): CliRefusal => {
  const refusal = Schema.decodeUnknownOption(deployRefusalSchema)(answer.body)
  const unknownApp = Option.isSome(refusal) && refusal.value.error === 'unknown-app'
  if (answer.status === 404 && unknownApp) {
    return new CliRefusal({
      headline: `No app ${app} on your account at ${host}.`,
      guidance: `Run 'sovrium ${verb}' to create it, or create it at ${host}/apps.`,
    })
  }
  // A 404 that names no app is the route itself: a cloud released before previews.
  if (answer.status === 404 && verb === 'preview') {
    return new CliRefusal({
      headline: `This cloud has no previews yet — ${host} does not answer sovrium preview.`,
      guidance: "Deploy with 'sovrium deploy', or ask the cloud's operator when previews come.",
    })
  }
  const missingEnv = Schema.decodeUnknownOption(deployMissingEnvRefusalSchema)(answer.body)
  return new CliRefusal({
    headline: `${host} refused the ${verb === 'preview' ? 'preview' : 'deployment'} (HTTP ${answer.status}) — ${outcome}.`,
    ...(Option.isSome(refusal) ? { detail: [refusal.value.message] } : {}),
    guidance: Option.isSome(missingEnv)
      ? `Set the variables it names with 'sovrium ${verb} --env <file>' or 'sovrium env push <file>', then ${verb} again.`
      : answer.status === 404
        ? "Check the app's address, and run 'sovrium login' if your key was revoked."
        : 'Run the command again; if it persists, the cloud may be misconfigured.',
  })
}

/**
 * Step 2: the intake request, answered with the deployment (new, or replayed).
 * Sent again while the cloud is busy: the `Idempotency-Key` makes a second send
 * the same request, answered with the deployment the first one recorded.
 */
const requestIntake = <R>(
  { origin, apiKey }: SignedInCloud,
  request: Schema.Schema.Type<typeof deployRequestSchema>,
  idempotencyKey: string,
  intake: Intake<R>
) =>
  Effect.gen(function* () {
    const { outcome } = intake
    const body = yield* Schema.encodeEffect(deployRequestSchema)(request).pipe(
      Effect.mapError(
        (issue) =>
          new CliRefusal({
            headline: `The ${intake.verb} request would not be valid (${issue.message}) — the archive is uploaded, ${outcome}.`,
            guidance: 'Run the command again; if it persists, report it as a bug.',
          })
      )
    )
    const answer = yield* callCloudThroughBusy(
      new URL(intake.path, origin),
      {
        method: 'POST',
        headers: intakeHeaders(apiKey, idempotencyKey),
        body: JSON.stringify(body),
      },
      { deadline: Date.now() + INTAKE_BUSY_LIMIT_MS, onBusy: () => Effect.void }
    ).pipe(Effect.mapError(describeUnreachable(`the archive is uploaded, ${outcome}`)))
    const deployment = Schema.decodeUnknownOption(intake.response)(answer.body)
    if ((answer.status === 200 || answer.status === 201) && Option.isSome(deployment)) {
      return deployment.value
    }
    return yield* intakeRefusal(answer, { app: request.app, host: origin.origin }, intake)
  })

const temporaryDirectory = (verb: Intake<unknown>['verb']) =>
  Effect.tryPromise({
    try: () => mkdtemp(join(tmpdir(), `sovrium-${verb}-`)),
    catch: (cause) =>
      new CliRefusal({
        headline: 'Sovrium could not create a temporary directory — nothing was sent.',
        detail: [cause instanceof Error ? cause.message : String(cause)],
        guidance: 'Check that the temporary directory is writable, then run the command again.',
      }),
  })

/** What one run ships: the command line, the config, and the app `--app` names. */
export interface ShipRequest {
  readonly argv: readonly string[]
  readonly configPath: string
  readonly explicit: string | undefined
}

/**
 * Bundle into `directory`, settle the app, set its variables, upload and
 * request the deployment through `intake`, then link the project to the app.
 */
const shipFrom = <R>(
  directory: string,
  cloud: SignedInCloud,
  request: ShipRequest,
  intake: Intake<R>
) =>
  Effect.gen(function* () {
    const { argv, configPath } = request
    const { summary, bytes, manifestText, document } = yield* bundleInto(
      directory,
      configPath,
      intake.verb
    )
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
    const objectKey = yield* upload(cloud, app, bytes, intake.outcome)
    yield* say(`Uploaded to ${cloud.origin.origin}.`)
    const deployment = yield* requestIntake(
      cloud,
      {
        app,
        objectKey,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        configHash: manifest.configHash,
        engineVersion: manifest.engine.minVersion,
        manifest: manifestText,
      },
      intakeIdempotencyKey(intake.verb, app, manifest),
      intake
    )
    if (address.source !== 'link') yield* writeLink(configPath, cloud.origin.origin, app)
    return { deployment, target }
  })

/** {@link shipFrom} in a temporary directory, removed either way. */
export const ship = <R>(cloud: SignedInCloud, request: ShipRequest, intake: Intake<R>) =>
  Effect.gen(function* () {
    const directory = yield* temporaryDirectory(intake.verb)
    return yield* shipFrom(directory, cloud, request, intake).pipe(
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
