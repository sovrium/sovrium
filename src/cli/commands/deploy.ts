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
 *    `seed/` folder, as `sovrium seed --app <slug> --yes` does (`seed/remote.ts`).
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
import { seedAfterDeploy } from '@/cli/commands/seed/remote'
import { defineFlags, flag, type FlagsOf } from '@/cli/runtime/flag-schema'
import { CliRefusal, withFlags } from '@/cli/runtime/run-command'
import { explicitAddress, readLink } from './cloud-app-lookup'
import { assertNetworkAllowed } from './cloud-session'
import { cloudTargetFlags, signedInCloud } from './cloud-sign-in'
import { announceAndFollow } from './deploy-follow'
import { requestPromotion } from './deploy-promote'
import { DEPLOY_INTAKE, ship, shipFlags } from './deploy-ship'
import { configPathOf } from './deploy-target'
import type { SignedInCloud } from './cloud-sign-in'
import type { DeployResponse } from '@/domain/models/api/automations/automations'

/** The flags `sovrium deploy` reads. */
export const deployFlags = defineFlags({
  ...cloudTargetFlags,
  ...shipFlags,
  seed: flag.switch('--seed'),
  noWait: flag.switch('--no-wait'),
  fromPreview: flag.named('--from-preview'),
  /** `--env` in both spellings, for refusing it under `--from-preview`. */
  envNamed: flag.named('--env'),
})

type DeployFlags = FlagsOf<typeof deployFlags>

/** Everything `sovrium deploy` reads from the command line. */
export interface DeployCommandOptions {
  readonly configFile: string | undefined
  readonly flags: DeployFlags
}

/** `--seed` seeds once the deployment is live, so it cannot return before it is. */
const refuseSeedWithoutWait = (flags: DeployFlags): Effect.Effect<void, CliRefusal> =>
  flags.seed && flags.noWait
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
  flags: DeployFlags,
  accepted: { readonly deployment: DeployResponse; readonly slug: string; readonly url: string }
) =>
  Effect.gen(function* () {
    const { deployment, slug } = accepted
    const id = deployment.deploymentId
    const ended = yield* announceAndFollow(cloud, deployment, {
      slug,
      replayed: `Already deployed (revision ${id}).`,
      url: deployment.url === '' ? accepted.url : deployment.url,
      noWait: flags.noWait,
    })
    if (ended !== undefined && flags.seed) {
      yield* seedWhenLive(cloud, { id, app: slug, ended })
    }
  })

/** What a given `--from-preview` names: the preview's id, or the refusal of a flag given none. */
const previewToPromote = (flags: DeployFlags): Effect.Effect<string, CliRefusal> => {
  const { value } = flags.fromPreview
  if (value === undefined) {
    return Effect.fail(
      new CliRefusal({
        headline: '--from-preview is given no deployment id — nothing was sent.',
        guidance:
          "Name the preview, for example 'sovrium deploy --from-preview 57': the id 'sovrium preview' printed.",
      })
    )
  }
  return flags.envNamed.given
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
    const { flags } = options
    yield* refuseSeedWithoutWait(flags)
    const promoted = flags.fromPreview.given ? yield* previewToPromote(flags) : undefined
    const explicit = yield* explicitAddress(flags.app)
    yield* assertNetworkAllowed('deploy')
    const cloud = yield* signedInCloud(flags.host)
    const configPath = yield* configPathOf(options.configFile)
    if (promoted !== undefined) {
      const slug = yield* promotedApp(explicit, configPath, cloud.origin)
      const deployment = yield* requestPromotion(cloud, slug, promoted)
      return yield* followDeployment(cloud, flags, { deployment, slug, url: '' })
    }
    const { deployment, target } = yield* ship(
      cloud,
      { flags, configPath, explicit },
      DEPLOY_INTAKE
    )
    yield* followDeployment(cloud, flags, {
      deployment,
      slug: target.slug,
      url: target.app?.url ?? '',
    })
  })

/** Handle `sovrium deploy`: the config, and its flags. */
export const handleDeployCommand = withFlags(deployFlags, ({ configFile, flags }) =>
  deploy({ configFile, flags })
)
