/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium deploy [config] [--app <slug>] [--host <url>] [--yes] [--env <file>] [--no-wait] [--seed]`
 * `sovrium deploy [config] --from-preview <id> [--app <slug>] [--host <url>] [--no-wait] [--seed]`
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
 *    same app is answered with the first deployment — and so it is sent again,
 *    for up to 2 minutes, while the cloud answers 429 or 503;
 * 5. remember the app in the project's link file once the request is accepted;
 * 6. unless `--no-wait`, read the deployment record every 2 seconds for up to
 *    10 minutes — waiting longer while the cloud answers 429 or 503 — printing
 *    each state and each new attempt the cloud makes,
 *    until it is `live`, `failed` or `replaced` — and on `live`, wait for the
 *    app's address to answer before saying so;
 * 7. under `--seed`, once it is live, seed it `if-empty` from the bundle's
 *    `seed/` folder, as `sovrium seed --app <slug> --yes` does (`seed-remote.ts`).
 *
 * The archive never travels in the webhook body: a body is kept with its run.
 * Every answer is decoded through the deploy wire contract before it is read.
 * Steps 1 to 5 live in `deploy-ship.ts`, shared with `sovrium preview`; step
 * 6 in `deploy-follow.ts`.
 *
 * `--from-preview <id>` replaces steps 1 to 5 with one request
 * (`deploy-promote.ts`): the cloud deploys the bundle preview `<id>` runs as
 * the release — nothing is bundled or uploaded — and the command follows it
 * as any deployment. The app is `--app`, else the project's link; never the
 * config name. `--env` is refused there, before any request.
 */

import { Effect } from 'effect'
import { readValueFlag } from '@/cli/runtime/flag-vocabulary'
import { explicitAddress, readLink } from './cloud-app-lookup'
import { CliRefusal, assertNetworkAllowed, runCliProgram } from './cloud-session'
import { signedInCloud } from './cloud-sign-in'
import { announceAndFollow } from './deploy-follow'
import { requestPromotion } from './deploy-promote'
import { DEPLOY_INTAKE, ship } from './deploy-ship'
import { configPathOf } from './deploy-target'
import { seedAfterDeploy } from './seed-remote'
import type { SignedInCloud } from './cloud-sign-in'
import type { DeployResponse } from '@/domain/models/api/automations/automations'

/** Everything `sovrium deploy` reads from the command line. */
export interface DeployCommandOptions {
  readonly configFile: string | undefined
  readonly argv: readonly string[]
}

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

/** `--seed`, once the deployment ended: seed one that went live, else say why not. */
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
 * Announce the deployment the cloud accepted, follow it unless `--no-wait`,
 * and under `--seed` seed it once live — the same for a shipped bundle and a
 * promoted preview.
 */
const followDeployment = (
  cloud: SignedInCloud,
  argv: readonly string[],
  accepted: { readonly deployment: DeployResponse; readonly slug: string; readonly url: string }
) =>
  Effect.gen(function* () {
    const { deployment, slug } = accepted
    const id = deployment.deploymentId
    const ended = yield* announceAndFollow(cloud, deployment, {
      slug,
      replayed: `Already deployed (revision ${id}).`,
      url: deployment.url === '' ? accepted.url : deployment.url,
      noWait: argv.includes('--no-wait'),
    })
    if (ended !== undefined && argv.includes('--seed')) {
      yield* seedWhenLive(cloud, { id, app: slug, ended })
    }
  })

/** What a given `--from-preview` names: the preview's id, or the refusal of a flag given none. */
const previewToPromote = (argv: readonly string[]): Effect.Effect<string, CliRefusal> => {
  const { value } = readValueFlag(argv, '--from-preview')
  if (value === undefined) {
    return Effect.fail(
      new CliRefusal({
        headline: '--from-preview is given no deployment id — nothing was sent.',
        guidance:
          "Name the preview, for example 'sovrium deploy --from-preview 57': the id 'sovrium preview' printed.",
      })
    )
  }
  return readValueFlag(argv, '--env').given
    ? Effect.fail(
        new CliRefusal({
          headline: '--env cannot set variables while deploying a preview — nothing was sent.',
          guidance: "Set them with 'sovrium env push <file>', then run the command again.",
        })
      )
    : Effect.succeed(value)
}

/** The app a preview is promoted on: `--app`, else the link for this cloud — never the config name. */
const promotedApp = (explicit: string | undefined, configPath: string, origin: URL) =>
  Effect.gen(function* () {
    if (explicit !== undefined) return explicit
    const link = yield* readLink(configPath)
    if (link !== undefined && URL.parse(link.host)?.origin === origin.origin) return link.app
    return yield* new CliRefusal({
      headline:
        'No app to deploy the preview on: the project is not linked to an app on this cloud — nothing was sent.',
      guidance:
        "Name the app with --app, for example 'sovrium deploy --from-preview 57 --app atelier-crm'.",
    })
  })

/**
 * Sign-in check, ship — or, under `--from-preview`, promote — and (unless
 * `--no-wait`) follow the deployment to its end; under `--seed`, then seed it
 * as `sovrium seed --app <slug> --yes` does.
 */
const deploy = (options: DeployCommandOptions) =>
  Effect.gen(function* () {
    const { argv } = options
    yield* refuseSeedWithoutWait(argv)
    const promoted = readValueFlag(argv, '--from-preview').given
      ? yield* previewToPromote(argv)
      : undefined
    const explicit = yield* explicitAddress(argv)
    yield* assertNetworkAllowed('deploy')
    const cloud = yield* signedInCloud(argv)
    const configPath = yield* configPathOf(options.configFile)
    if (promoted !== undefined) {
      const slug = yield* promotedApp(explicit, configPath, cloud.origin)
      const deployment = yield* requestPromotion(cloud, slug, promoted)
      return yield* followDeployment(cloud, argv, { deployment, slug, url: '' })
    }
    const { deployment, target } = yield* ship(cloud, { argv, configPath, explicit }, DEPLOY_INTAKE)
    yield* followDeployment(cloud, argv, {
      deployment,
      slug: target.slug,
      url: target.app?.url ?? '',
    })
  })

/** Handle `sovrium deploy`. Exits 1 on any refusal; returns on success. */
export const handleDeployCommand = async (options: DeployCommandOptions): Promise<void> =>
  runCliProgram(deploy(options))
